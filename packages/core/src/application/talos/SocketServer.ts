/**
 * SocketServer - Bidirectional socket communication for CLI/Web ↔ daemon
 *
 * Handles request/response over Unix domain sockets.
 * Actions: ping, start_task, stop_task, resume_task, get_status, list_tasks, delete_task, start_ui, stop_ui, get_ui_status, shutdown_daemon
 */

import { createServer, Server as NetServer, Socket } from "net";
import { promises as fs } from "fs";
import * as path from "path";

import type { ISocketServer } from "@talos/types";
import type { ITaskLifecycleManager } from "@talos/types";
import type { ITaskRepository } from "@talos/types";
import type { ILogger } from "@talos/types";
import type { SocketMessage } from "@talos/types";
import { StorageManager } from "../../storage";
import { TaskRepository } from "@/domain/repositories/TaskRepository";
import { Task } from "@/domain/entities/Task";
import { WorkspaceRepository } from "@/repositories/workspace-repository";
import { WORKSPACES_FILE } from "@/infrastructure/constant";
import { ProtocolManager } from "@/infrastructure/communication/socket/ProtocolManager";

/**
 * Socket request message (unchanged for backward compatibility)
 */
export interface SocketRequest {
  /** Protocol version (optional, for backward compatibility) */
  version?: string;
  action: "ping" | "start_task" | "get_status" | "list_tasks" | "stop_task" | "resume_task" | "delete_task" | "start_ui" | "stop_ui" | "get_ui_status" | "shutdown_daemon";
  processId?: string;
  reason?: string;
  force?: boolean;
  prdId?: string;
  branch?: string;
  workingDir?: string;
  /** Tool to use for task execution (claude or cursor) */
  tool?: string;
  /** Debug mode - capture full output including thinking and tool calls */
  debug?: boolean;
  /** Model to use for cursor-agent (e.g., "sonnet-4", "composer-1.5", "auto") */
  model?: string;
  /** Port for UI server */
  port?: number;
  /** Path to standalone server.js file */
  serverPath?: string;
}

/**
 * Socket response message (unchanged for backward compatibility)
 */
export interface SocketResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * UI Manager interface for UI server operations
 */
export interface IUIManager {
  startUI(port?: number, serverPath?: string): Promise<{ success: boolean; port?: number; message?: string }>;
  stopUI(): Promise<{ success: boolean; message?: string }>;
  getUIStatus(): Promise<{ running: boolean; port?: number }>;
}

/**
 * Task info with workspace context
 */
interface TaskInfo {
  task: {
    id: string;
    pid?: number;
    status: string;
    workingDir?: string;
    processId?: string;
    branch?: string;
    metadata?: {
      prdId?: string;
      [key: string]: any;
    };
  };
  workspace: {
    path: string;
  };
}

/**
 * SocketServer dependencies
 */
export interface SocketServerDependencies {
  /**
   * Task lifecycle manager for task operations
   */
  taskLifecycleManager: ITaskLifecycleManager;

  /**
   * Storage manager for daemon-level operations (desired state, UI state)
   */
  storageManager: StorageManager;

  /**
   * UI manager for UI server operations
   */
  uiManager: IUIManager;

  /**
   * Protocol manager for protocol version management
   */
  protocolManager: ProtocolManager;

  /**
   * Logger for logging
   */
  logger: ILogger;

  /**
   * Unix socket file path
   */
  socketPath: string;

  /**
   * Base path for Talos (typically ~/.talos)
   */
  basePath: string;

  /**
   * Callback to shutdown Talos daemon gracefully
   */
  shutdownCallback?: () => Promise<void>;
}

/**
 * SocketServer - Application layer service
 *
 * Implements ISocketServer interface and handles socket communication
 * using injected dependencies instead of direct Talos dependency.
 */
export class SocketServer implements ISocketServer {
  private server: NetServer;
  private socketPath: string;
  private taskLifecycleManager: ITaskLifecycleManager;
  private storageManager: StorageManager;
  private uiManager: IUIManager;
  private protocolManager: ProtocolManager;
  private logger: ILogger;
  private basePath: string;
  private shutdownCallback?: () => Promise<void>;
  private isListening: boolean = false;
  private workspaceRepository: WorkspaceRepository;

  constructor(deps: SocketServerDependencies) {
    this.socketPath = deps.socketPath;
    this.basePath = deps.basePath;
    this.taskLifecycleManager = deps.taskLifecycleManager;
    this.storageManager = deps.storageManager;
    this.uiManager = deps.uiManager;
    this.protocolManager = deps.protocolManager;
    this.logger = deps.logger;
    this.shutdownCallback = deps.shutdownCallback;
    this.workspaceRepository = new WorkspaceRepository();
    this.server = createServer();
    this.setupConnectionHandler();
  }

  /**
   * Set up connection handler
   */
  private setupConnectionHandler(): void {
    this.server.on("connection", (socket: Socket) => {
      let buffer = "";
      let negotiatedVersion: string | undefined;

      socket.on("data", (data: Buffer) => {
        buffer += data.toString();

        // Try to parse complete messages
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const message = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          this.handleMessage(message, socket, negotiatedVersion)
            .then((version) => {
              negotiatedVersion = version;
            })
            .catch((error) => {
              this.logger.error(`Error handling message: ${error}`);
              this.sendResponse(socket, {
                success: false,
                error: String(error),
              }, negotiatedVersion);
            });
        }
      });

      socket.on("error", (error) => {
        this.logger.error(`Socket error: ${error}`);
      });

      socket.on("close", () => {
        // Connection closed
      });
    });
  }

  /**
   * Handle incoming message
   *
   * @param message - JSON message string
   * @param socket - Client socket
   */
  private async handleMessage(
    message: string,
    socket: Socket,
    currentVersion?: string
  ): Promise<string> {
    try {
      const parsed = JSON.parse(message);

      // Handle SocketMessage format: {version, type, payload}
      // Extract payload as SocketRequest
      let request: SocketRequest;
      let messageVersion: string | undefined;

      if (parsed.type && parsed.payload !== undefined) {
        // New SocketMessage format
        const socketMsg = parsed as SocketMessage;
        messageVersion = socketMsg.version;
        request = socketMsg.payload as SocketRequest;
      } else {
        // Legacy format (backward compatibility)
        request = parsed as SocketRequest;
        messageVersion = request.version;
      }

      // Negotiate protocol version (first message only)
      const negotiatedVersion = currentVersion ||
        this.protocolManager.negotiateVersion(messageVersion);

      // Validate version is supported
      if (messageVersion && !this.protocolManager.isVersionSupported(messageVersion)) {
        const response = this.protocolManager.createResponse(
          {
            version: messageVersion,
            type: "request",
            payload: request,
            id: undefined,
          },
          {
            error: `Unsupported protocol version: ${messageVersion}. Supported versions: ${["1.0"].join(", ")}`,
          },
          false
        );
        this.sendResponse(socket, {
          success: false,
          error: response.payload as string,
        }, negotiatedVersion);
        return negotiatedVersion;
      }

      const response = await this.handleRequest(request);
      this.sendResponse(socket, response, negotiatedVersion);
      return negotiatedVersion;
    } catch (error) {
      // Handle version negotiation errors
      if (error instanceof Error && error.message.includes("Unsupported protocol version")) {
        this.sendResponse(socket, {
          success: false,
          error: error.message,
        }, currentVersion);
        throw error;
      }

      // Handle other errors
      this.sendResponse(socket, {
        success: false,
        error: String(error),
      }, currentVersion);
      throw error;
    }
  }

  /**
   * Handle request
   *
   * @param request - Socket request
   * @returns Socket response
   */
  private async handleRequest(request: SocketRequest): Promise<SocketResponse> {
    try {
      switch (request.action) {
        case "ping":
          return { success: true, data: { message: "pong" } };

        case "start_task":
          // CLI 请求启动任务
          if (!request.prdId || !request.workingDir) {
            return { success: false, error: "Missing prdId or workingDir" };
          }
          const startResult = await this.taskLifecycleManager.startTask(
            request.prdId,
            request.workingDir,
            request.debug ?? false,
            request.tool,
            request.model
          );
          // Return ITask-compatible structure with prd object (充血模型)
          return {
            success: true,
            data: {
              id: startResult.taskId,
              status: "running",
              title: `Execute PRD: ${request.prdId}`,
              description: `Task for PRD ${request.prdId}`,
              conversation: [],
              timestamp: Date.now(),
              startedAt: Date.now(),
              prd: { id: request.prdId },  // IPRD object (minimal for start response)
              command: `talos task start --prd ${request.prdId}`,
              tool: request.tool,
              workspace: "",  // Will be filled by task entity
              branch: "",
              processId: startResult.processId,
              pid: startResult.pid,
            }
          };

        case "get_status":
          if (!request.processId) {
            return { success: false, error: "Missing processId" };
          }
          const processInfo = await this.getProcessState(request.processId);
          if (!processInfo) {
            return { success: false, error: `Process ${request.processId} not found` };
          }
          return { success: true, data: processInfo };

        case "list_tasks":
          const processInfos = await this.listProcessStates();
          return { success: true, data: processInfos };

        case "stop_task":
          // CLI 请求停止任务
          if (!request.processId) {
            return { success: false, error: "Missing processId" };
          }
          try {
            await this.taskLifecycleManager.stopTask(request.processId);
            return { success: true, data: { message: "Task stopped successfully" } };
          } catch (error) {
            return { success: false, error: String(error) };
          }

        case "resume_task":
          // CLI 请求恢复任务
          if (!request.processId) {
            return { success: false, error: "Missing processId" };
          }
          try {
            await this.taskLifecycleManager.resumeTask(
              request.processId,
              request.debug ?? false,
              request.tool,
              request.model
            );
            return { success: true, data: { message: "Task resumed successfully" } };
          } catch (error) {
            return { success: false, error: String(error) };
          }

        case "delete_task":
          // CLI 请求删除任务
          if (!request.processId) {
            return { success: false, error: "Missing processId" };
          }
          try {
            // Find task info first using TaskRepository
            const taskInfo = await this.findTaskByProcessId(request.processId);

            if (!taskInfo) {
              return { success: false, error: `Task ${request.processId} not found` };
            }

            // Stop the task if it's running
            if (taskInfo.task.status === "running") {
              try {
                await this.taskLifecycleManager.stopTask(request.processId);
              } catch (stopError) {
                this.logger.warn(`Failed to stop task ${request.processId}: ${stopError}`);
              }
            }

            // Delete from workspace's task repository
            const taskRepository = new TaskRepository(taskInfo.workspace.path);
            await taskRepository.delete(request.processId);

            return { success: true, data: { message: "Task deleted successfully" } };
          } catch (error) {
            return { success: false, error: String(error) };
          }

        case "start_ui":
          // CLI 请求启动 UI
          const startUIResult = await this.uiManager.startUI(request.port, request.serverPath);
          return { success: startUIResult.success, data: startUIResult };

        case "stop_ui":
          // CLI 请求停止 UI
          const stopUIResult = await this.uiManager.stopUI();
          return { success: stopUIResult.success, data: stopUIResult };

        case "get_ui_status":
          // CLI 请求 UI 状态
          const uiStatus = await this.uiManager.getUIStatus();
          return { success: true, data: uiStatus };

        case "shutdown_daemon":
          // CLI 请求关闭守护进程
          if (this.shutdownCallback) {
            // Trigger shutdown asynchronously (don't wait for completion)
            this.shutdownCallback().catch((error) => {
              this.logger.error("Failed to shutdown daemon", error);
            });
            return { success: true, data: { message: "Daemon shutdown initiated" } };
          }
          return { success: false, error: "Shutdown callback not configured" };

        default:
          return { success: false, error: `Unknown action: ${(request as any).action}` };
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Find task by process ID across all workspaces
   *
   * Uses WorkspaceRepository and TaskRepository to find tasks.
   *
   * @param processId - Process identifier (task ID)
   * @returns Task info with workspace context, or null if not found
   * @throws Error if task is found but has invalid data
   */
  private async findTaskByProcessId(processId: string): Promise<TaskInfo | null> {
    const workspaces = await this.workspaceRepository.findAll();

    for (const ws of workspaces) {
      try {
        const taskRepository = new TaskRepository(ws.path);
        const task = await taskRepository.findById(processId);

        if (task) {
          // Require worktree to be set - no fallback
          if (!task.worktree) {
            throw new Error(`Task ${task.id} has no worktree set`);
          }

          return {
            task: {
              id: task.id,
              pid: task.pid,
              status: task.status,
              workingDir: task.worktree.path,
              processId: task.processId,
              branch: task.branch,
              metadata: {
                prdId: task.getPrdId(),
              },
            },
            workspace: {
              path: ws.path,
            },
          };
        }
      } catch (error) {
        // Skip workspaces with errors
        this.logger.warn(`Failed to find task in workspace ${ws.path}: ${error}`);
      }
    }

    return null;
  }

  /**
   * Get process state by processId
   *
   * Uses TaskRepository to find task and return its state
   *
   * @param processId - Process identifier
   * @returns Process state or null if not found
   */
  private async getProcessState(processId: string): Promise<{
    id: string;
    pid?: number;
    status: string;
    workingDir: string;
    prdId?: string;
    branch?: string;
  } | null> {
    const taskInfo = await this.findTaskByProcessId(processId);
    if (!taskInfo) {
      return null;
    }

    const { task } = taskInfo;
    return {
      id: task.processId || task.id,
      pid: task.pid,
      status: task.status,
      workingDir: task.workingDir!,
      prdId: task.metadata?.prdId,
      branch: task.branch,
    };
  }

  /**
   * List all process states
   *
   * Uses WorkspaceRepository and TaskRepository to collect all tasks
   *
   * @returns Array of Task entities with loaded PRD
   */
  private async listProcessStates(): Promise<Array<Task>> {
    const allTasks: Task[] = [];

    // Get all workspaces
    const workspaces = await this.workspaceRepository.findAll();

    for (const ws of workspaces) {
      try {
        const taskRepository = new TaskRepository(ws.path);
        const tasks = await taskRepository.findAll();

        for (const task of tasks) {
          // Require worktree to be set - skip tasks without worktree
          if (!task.worktree) {
            this.logger.warn(`Task ${task.id} has no worktree set, skipping`);
            continue;
          }

          // Add Task entity (has getPrdId() method)
          allTasks.push(task);
        }
      } catch (error) {
        this.logger.warn(`Failed to read tasks from workspace ${ws.path}: ${error}`);
      }
    }

    return allTasks;
  }

  /**
   * Send response to client
   *
   * Adds version field to responses for protocol versioning.
   * Maintains backward compatibility with old clients.
   *
   * @param socket - Client socket
   * @param response - Socket response
   * @param version - Protocol version (optional)
   */
  private sendResponse(socket: Socket, response: SocketResponse, version?: string): void {
    try {
      // Send in SocketMessage format when version is specified (new protocol)
      // Otherwise send in legacy format for backward compatibility
      const message = version
        ? {
            version,
            type: "response",
            payload: response,
          }
        : response;

      socket.write(JSON.stringify(message) + "\n");
    } catch (error) {
      this.logger.error(`Failed to send response: ${error}`);
    }
  }

  /**
   * Start the socket server
   *
   * Implements ISocketServer.start()
   */
  async start(): Promise<void> {
    if (this.isListening) {
      return;
    }

    // Remove existing socket file if it exists
    try {
      await fs.unlink(this.socketPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    return new Promise((resolve, reject) => {
      this.server.listen(this.socketPath, () => {
        this.isListening = true;
        this.logger.info(`Socket server listening on ${this.socketPath}`);
        resolve();
      });

      this.server.on("error", (error) => {
        reject(error);
      });
    });
  }

  /**
   * Stop the socket server
   *
   * Implements ISocketServer.stop()
   */
  async stop(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        this.isListening = false;

        // Remove socket file
        fs.unlink(this.socketPath).catch(() => {
          // Ignore error
        });

        resolve();
      });
    });
  }

  /**
   * Check if server is active
   *
   * Implements ISocketServer.isActive()
   */
  isActive(): boolean {
    return this.isListening;
  }
}
