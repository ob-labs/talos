/**
 * Talos Client - Entry Layer Client
 *
 * Implements ITalosClient interface to provide unified API for communicating
 * with the Talos daemon via Socket protocol.
 *
 * DESIGN PRINCIPLES:
 * - Encapsulates all Socket communication logic
 * - Provides high-level API matching ITalosClient interface
 * - Handles connection management, timeouts, and error translation
 * - Supports event subscription for SSE streams
 */

import { connect } from "net";
import { promises as fs } from "fs";
import * as path from "path";
import { homedir } from "os";

import type {
  ITalosClient,
  ILogger,
  ITask,
  StartTaskRequest,
  StopTaskRequest,
  ResumeTaskRequest,
  TaskFilters,
  HealthCheckResult,
  EventCallback,
  LogLevel,
  SocketMessage,
} from "@talos/types";

/**
 * Talos Client options
 */
export interface TalosClientOptions {
  /** Socket file path (default: ~/.talos/talos.sock) */
  socketPath?: string;
  /** Protocol version (default: '1.0') */
  protocolVersion?: string;
  /** Logger instance */
  logger?: ILogger;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Connection timeout in milliseconds (default: 5000) */
  connectionTimeout?: number;
}

/**
 * Socket request message (internal format)
 */
interface SocketRequest {
  action: string;
  [key: string]: unknown;
}

/**
 * Socket response message (internal format)
 */
interface SocketResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Event subscription
 */
interface EventSubscription {
  id: string;
  eventType: string;
  callback: EventCallback;
}

/**
 * Talos Client Implementation
 *
 * Implements ITalosClient interface using Socket communication.
 */
export class TalosClient implements ITalosClient {
  private socketPath: string;
  private protocolVersion: string;
  private logger: ILogger;
  private timeout: number;
  private connectionTimeout: number;
  private connected: boolean = false;
  private subscriptions: Map<string, EventSubscription> = new Map();

  constructor(options: TalosClientOptions = {}) {
    this.socketPath = options.socketPath || path.join(homedir(), ".talos", "talos.sock");
    this.protocolVersion = options.protocolVersion || "1.0";
    this.logger = options.logger || this.createDefaultLogger();
    this.timeout = options.timeout || 30000;
    this.connectionTimeout = options.connectionTimeout || 5000;
  }

  /**
   * Connect to Talos daemon
   *
   * @throws {Error} If connection fails
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // Check if socket file exists
      await fs.access(this.socketPath);
    } catch (error) {
      throw new Error(
        `Talos socket file not found at ${this.socketPath}. ` +
          `Please ensure Talos daemon is running (use 'talos start').`
      );
    }

    try {
      // Test connection with ping
      await this.sendRequest({ action: "ping" });
      this.connected = true;
      this.logger.info(`Connected to Talos daemon at ${this.socketPath}`);
    } catch (error) {
      throw new Error(
        `Failed to connect to Talos daemon: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Disconnect from Talos daemon
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    // Cancel all event subscriptions
    this.subscriptions.clear();
    this.connected = false;
    this.logger.info("Disconnected from Talos daemon");
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Start a new task
   *
   * @param request - Task start request
   * @returns Created task
   */
  async startTask(request: StartTaskRequest): Promise<ITask> {
    this.ensureConnected();

    const response = await this.sendRequest({
      action: "start_task",
      prdId: request.prdId,
      workingDir: request.workingDir,
      ...request.options,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to start task");
    }

    return response.data as ITask;
  }

  /**
   * Stop a running task
   *
   * @param request - Task stop request
   */
  async stopTask(request: StopTaskRequest): Promise<void> {
    this.ensureConnected();

    const response = await this.sendRequest({
      action: "stop_task",
      processId: request.taskId,
      reason: request.reason,
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to stop task");
    }
  }

  /**
   * Resume a stopped task
   *
   * @param request - Task resume request
   */
  async resumeTask(request: ResumeTaskRequest): Promise<void> {
    this.ensureConnected();

    const response = await this.sendRequest({
      action: "resume_task",
      processId: request.taskId,
      ...request.options,
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to resume task");
    }
  }

  /**
   * Get task status
   *
   * @param taskId - Task ID
   * @returns Task with current status
   */
  async getTaskStatus(taskId: string): Promise<ITask> {
    this.ensureConnected();

    const response = await this.sendRequest({
      action: "get_status",
      processId: taskId,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get task status");
    }

    return response.data as ITask;
  }

  /**
   * List all tasks
   *
   * @param filters - Optional task filters
   * @returns Array of tasks
   */
  async listTasks(filters?: TaskFilters): Promise<ITask[]> {
    this.ensureConnected();

    const response = await this.sendRequest({
      action: "list_tasks",
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to list tasks");
    }

    let tasks = response.data as ITask[];

    // Apply filters if provided
    if (filters) {
      if (filters.status) {
        tasks = tasks.filter((task) => task.status === filters.status);
      }
      if (filters.prdId) {
        tasks = tasks.filter((task) => task.prd.id === filters.prdId);
      }
    }

    return tasks;
  }

  /**
   * Remove a task and its resources
   *
   * @param taskId - Task ID to remove
   */
  async removeTask(taskId: string): Promise<void> {
    this.ensureConnected();

    const response = await this.sendRequest({
      action: "delete_task",
      processId: taskId,
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to remove task");
    }
  }

  /**
   * Clear all failed tasks
   *
   * @returns Number of tasks cleared
   */
  async clearFailedTasks(): Promise<number> {
    this.ensureConnected();

    // Get all tasks
    const tasks = await this.listTasks();

    // Filter failed tasks
    const failedTasks = tasks.filter((task) => task.status === "failed");

    // Delete each failed task
    let cleared = 0;
    for (const task of failedTasks) {
      try {
        await this.removeTask(task.id);
        cleared++;
      } catch (error) {
        this.logger.warn(`Failed to clear task ${task.id}: ${error}`);
      }
    }

    return cleared;
  }

  /**
   * Get task health check
   *
   * @param taskId - Task ID
   * @returns Health check result
   */
  async getTaskHealth(taskId: string): Promise<HealthCheckResult> {
    this.ensureConnected();

    try {
      const task = await this.getTaskStatus(taskId);

      // Simple health check based on task status
      const isHealthy = task.status === "running" || task.status === "completed";

      return {
        isHealthy,
        status: task.status,
        details: {
          taskId: task.id,
          prdId: task.prd,
        },
      };
    } catch (error) {
      return {
        isHealthy: false,
        status: "error",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Subscribe to events
   *
   * @param eventType - Type of event to subscribe to
   * @param callback - Event callback function
   * @returns Subscription ID for unsubscribing
   */

  /**
   * Shutdown Talos daemon gracefully
   *
   * Sends a shutdown request to the daemon, which will stop all tasks
   * and exit gracefully.
   */
  async shutdownDaemon(): Promise<void> {
    this.ensureConnected();

    const response = await this.sendRequest({
      action: "shutdown_daemon",
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to shutdown daemon");
    }
  }


  subscribe(eventType: string, callback: EventCallback): string {
    // Generate subscription ID
    const uuid = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const subscriptionId = uuid();

    // Store subscription
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      eventType,
      callback,
    });

    this.logger.info(`Subscribed to event type: ${eventType} (subscription: ${subscriptionId})`);

    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   *
   * @param subscriptionId - Subscription ID from subscribe()
   */
  unsubscribe(subscriptionId: string): void {
    const deleted = this.subscriptions.delete(subscriptionId);

    if (deleted) {
      this.logger.info(`Unsubscribed: ${subscriptionId}`);
    }
  }

  /**
   * Send request to Socket server
   *
   * @param request - Socket request
   * @returns Socket response
   */
  private async sendRequest(request: SocketRequest): Promise<SocketResponse> {
    return new Promise((resolve, reject) => {
      const client = connect(this.socketPath);
      let buffer = "";

      // Set timeout
      const timeoutId = setTimeout(() => {
        client.destroy();
        reject(new Error(`Request timeout after ${this.timeout}ms`));
      }, this.timeout);

      // Handle connection
      client.on("connect", () => {
        // Construct SocketMessage with version
        const message: SocketMessage = {
          version: this.protocolVersion,
          type: "request",
          payload: request,
        };

        // Send request
        client.write(JSON.stringify(message) + "\n");
      });

      // Handle response
      client.on("data", (data: Buffer) => {
        buffer += data.toString();

        // Try to parse complete messages
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const messageStr = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          try {
            const message = JSON.parse(messageStr) as SocketMessage;

            // Handle response message
            if (message.type === "response") {
              const response = message.payload as SocketResponse;
              clearTimeout(timeoutId);
              client.destroy();
              resolve(response);
              return;
            }
          } catch (error) {
            // Ignore parse errors, wait for more data
          }
        }
      });

      // Handle errors
      client.on("error", (error) => {
        clearTimeout(timeoutId);
        client.destroy();
        reject(new Error(`Socket error: ${error.message}`));
      });

      // Handle close
      client.on("close", () => {
        clearTimeout(timeoutId);
        if (buffer.length > 0) {
          try {
            const message = JSON.parse(buffer) as SocketMessage;
            if (message.type === "response") {
              const response = message.payload as SocketResponse;
              resolve(response);
            } else {
              reject(new Error("Unexpected message type"));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${buffer}`));
          }
        }
      });
    });
  }

  /**
   * Ensure client is connected
   *
   * @throws {Error} If not connected
   */
  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error("Not connected to Talos daemon. Call connect() first.");
    }
  }

  /**
   * Create default logger
   *
   * @returns Default logger implementation
   */
  private createDefaultLogger(): ILogger {
    return {
      info: (message: string) => console.log(`[INFO] ${message}`),
      warn: (message: string) => console.warn(`[WARN] ${message}`),
      error: (message: string) => console.error(`[ERROR] ${message}`),
      audit: (message: string) => console.log(`[AUDIT] ${message}`),
      setLevel: (_level: LogLevel) => {},
      getLevel: () => "info" as LogLevel,
    };
  }
}
