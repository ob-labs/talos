/**
 * Talos - Coordinator for task execution
 *
 * Talos orchestrates all managers and services, delegating business logic to specialized components.
 */

import type { IProcessManager, ILogger, IEventBus } from "@talos/types";
import type { ITaskLifecycleManager, IHealthChecker, ISocketServer } from "@talos/types";
import type { ProcessExitEvent, ToolType } from "@talos/types";
import type { TaskMetadata } from "@/storage/task-dto";
import { promises as fs } from "fs";
import * as path from "path";
import { homedir } from "os";

import { StorageManager } from "@/storage/storage-manager";
import { TaskRepository } from "@/domain/repositories/TaskRepository";
import { WorkspaceRepository } from "@/repositories/workspace-repository";

/**
 * Workspace context (repository root path)
 */
interface WorkspaceContext {
  path: string;
}

/**
 * Task info with workspace context
 */
interface TaskInfo {
  task: TaskMetadata;
  workspace: WorkspaceContext;
}

export class Talos {
  private readonly taskLifecycleManager: ITaskLifecycleManager;
  private readonly healthChecker: IHealthChecker;
  private readonly socketServer: ISocketServer;
  private readonly processManager: IProcessManager;
  private readonly storageManager: StorageManager;
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;
  private readonly basePath: string;
  private readonly pidPath: string;
  private workspaceRepository: WorkspaceRepository;
  private isRunning = false;

  constructor(options: {
    taskLifecycleManager: ITaskLifecycleManager;
    healthChecker: IHealthChecker;
    socketServer: ISocketServer;
    processManager: IProcessManager;
    storageManager: StorageManager;
    eventBus: IEventBus;
    logger: ILogger;
    basePath?: string;
  }) {
    this.taskLifecycleManager = options.taskLifecycleManager;
    this.healthChecker = options.healthChecker;
    this.socketServer = options.socketServer;
    this.processManager = options.processManager;
    this.storageManager = options.storageManager;
    this.eventBus = options.eventBus;
    this.logger = options.logger;
    this.basePath = options.basePath || path.join(homedir(), ".talos");
    this.pidPath = path.join(this.basePath, "talos.pid");
    this.workspaceRepository = new WorkspaceRepository();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.logger.info("Starting Talos coordinator", { basePath: this.basePath });
    await fs.writeFile(this.pidPath, String(process.pid));

    this.processManager.on("process:exit", (event: any) => {
      this.handleProcessExit(event).catch((error) => {
        this.logger.error("Failed to handle process exit", error, { pid: event.pid });
      });
    });

    await this.restoreTasks();
    await this.healthChecker.start();
    await this.socketServer.start();
    this.isRunning = true;
    this.logger.info("Talos coordinator started successfully");
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.info("Stopping Talos coordinator");
    await this.healthChecker.stop();
    await this.socketServer.stop();

    const runningTasks = await this.getAllRunningTasks();
    for (const { task } of runningTasks) {
      try {
        await this.taskLifecycleManager.stopTask(task.processId!);
      } catch (error) {
        this.logger.error("Failed to stop task", error as Error, { processId: task.processId });
      }
    }

    try {
      await fs.unlink(this.pidPath);
    } catch {
      // Ignore if file doesn't exist
    }

    this.isRunning = false;
    this.logger.info("Talos coordinator stopped");
  }

  /**
   * Find task by process ID across all workspaces
   *
   * Uses WorkspaceRepository and TaskRepository to find tasks.
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
              processId: task.processId || task.id,
              pid: task.pid,
              status: task.status,
              command: task.command,
              tool: task.tool as ToolType | undefined,
              workspace: task.workspace,
              prd: task.getPrdId(),
              branch: task.branch,
              worktree: extractWorktreeName(task.worktree.path),
              workingDir: task.worktree.path,
              createdAt: task.timestamp,
              startedAt: task.startedAt,
            },
            workspace: { path: ws.path },
          };
        }
      } catch (error) {
        // Skip workspaces with errors
        continue;
      }
    }

    return null;
  }

  /**
   * Get all running tasks from all workspaces
   */
  private async getAllRunningTasks(): Promise<Array<{ task: TaskMetadata; workspace: WorkspaceContext }>> {
    const workspaces = await this.workspaceRepository.findAll();
    const allRunningTasks: Array<{ task: TaskMetadata; workspace: WorkspaceContext }> = [];

    for (const workspace of workspaces) {
      try {
        const taskRepository = new TaskRepository(workspace.path);
        const runningTasks = await taskRepository.findAll({ status: "running" });

        for (const task of runningTasks) {
          // Require worktree to be set - skip tasks without worktree
          if (!task.worktree) {
            this.logger.warn(`Task ${task.id} has no worktree set, skipping`);
            continue;
          }

          allRunningTasks.push({
            task: {
              id: task.id,
              processId: task.processId || task.id,
              pid: task.pid,
              status: task.status,
              command: task.command,
              tool: task.tool as ToolType | undefined,
              workspace: task.workspace,
              prd: task.getPrdId(),
              branch: task.branch,
              worktree: extractWorktreeName(task.worktree.path),
              workingDir: task.worktree.path,
              createdAt: task.timestamp,
              startedAt: task.startedAt,
            },
            workspace: { path: workspace.path },
          });
        }
      } catch (error) {
        // Skip workspaces with invalid config
      }
    }

    return allRunningTasks;
  }

  private async handleProcessExit(event: ProcessExitEvent): Promise<void> {
    const { pid, exitCode, exitSignal } = event;

    // Find task by PID
    const workspaces = await this.workspaceRepository.findAll();
    let taskInfo: TaskInfo | null = null;

    for (const ws of workspaces) {
      try {
        const taskRepository = new TaskRepository(ws.path);
        const tasks = await taskRepository.findAll();
        const task = tasks.find(t => t.pid === pid);

        if (task) {
          // Require worktree to be set - no fallback
          if (!task.worktree) {
            this.logger.warn(`Task ${task.id} has no worktree set, skipping`);
            continue;
          }

          taskInfo = {
            task: {
              id: task.id,
              processId: task.processId || task.id,
              pid: task.pid,
              status: task.status,
              command: task.command,
              tool: task.tool as ToolType | undefined,
              workspace: task.workspace,
              prd: task.getPrdId(),
              branch: task.branch,
              worktree: extractWorktreeName(task.worktree.path),
              workingDir: task.worktree.path,
              createdAt: task.timestamp,
              startedAt: task.startedAt,
            },
            workspace: { path: ws.path },
          };
          break;
        }
      } catch (error) {
        // Skip workspaces with errors
        continue;
      }
    }

    if (!taskInfo) return;

    const { task, workspace } = taskInfo;
    const taskRepository = new TaskRepository(workspace.path);

    try {
      const taskEntity = await taskRepository.findById(task.id!);
      if (!taskEntity) return;

      // Reload task to get latest state (in case stopTask updated it)
      // This prevents race condition where stopTask sets status to "stopped"
      // but handleProcessExit receives the exit event and overwrites it
      const latestTask = await taskRepository.findById(task.id!);
      if (!latestTask) return;

      // Only update state if task is still running
      // If it's already stopped/completed/failed, don't override
      if (latestTask.status !== "running") {
        this.logger.info(
          `⏭️ Task ${task.id} not updated on exit (current status: ${latestTask.status})`
        );
        return;
      }

      if (exitCode === 0) {
        latestTask.complete();
      } else {
        const error = exitSignal
          ? "Process terminated by signal: " + exitSignal
          : "Process exited with code: " + exitCode;
        latestTask.fail(error);
      }

      await taskRepository.save(latestTask);
      this.eventBus.emit("task:completed", { taskId: task.id, exitCode, exitSignal, timestamp: Date.now() });
    } catch (error) {
      this.logger.error("Failed to update task state", error as Error, { taskId: task.id });
    }
  }

  private async restoreTasks(): Promise<void> {
    const runningTasks = await this.getAllRunningTasks();
    if (runningTasks.length === 0) return;

    this.logger.info("Restoring running tasks", { count: runningTasks.length });

    for (const { task, workspace } of runningTasks) {
      try {
        const alive = await this.processManager.isAlive(task.pid!);
        if (!alive) {
          const exitJsonPath = path.join(workspace.path, ".talos", "logs", (task.id ?? "unknown") + ".exit.json");
          try {
            const exitData = await fs.readFile(exitJsonPath, "utf-8");
            const { exitCode, signal } = JSON.parse(exitData);
            const taskRepository = new TaskRepository(workspace.path);
            const taskEntity = await taskRepository.findById(task.id!);
            if (taskEntity) {
              if (exitCode === 0) {
                taskEntity.complete();
              } else {
                taskEntity.fail(signal ? "Terminated by signal: " + signal : "Exited with code: " + exitCode);
              }
              await taskRepository.save(taskEntity);
            }
          } catch {
            const taskRepository = new TaskRepository(workspace.path);
            const taskEntity = await taskRepository.findById(task.id!);
            if (taskEntity) {
              taskEntity.fail("Process died during downtime");
              await taskRepository.save(taskEntity);
            }
          }
        }
      } catch (error) {
        this.logger.error("Failed to restore task", error as Error, { taskId: task.id });
      }
    }
  }

  async getProcessState(processId: string): Promise<TaskMetadata | null> {
    const taskInfo = await this.findTaskByProcessId(processId);
    return taskInfo ? taskInfo.task : null;
  }

  async listProcessStates(): Promise<TaskMetadata[]> {
    const workspaces = await this.workspaceRepository.findAll();
    const allTasks: TaskMetadata[] = [];

    for (const workspace of workspaces) {
      try {
        const taskRepository = new TaskRepository(workspace.path);
        const tasks = await taskRepository.findAll();

        for (const task of tasks) {
          // Require worktree to be set - skip tasks without worktree
          if (!task.worktree) {
            this.logger.warn(`Task ${task.id} has no worktree set, skipping`);
            continue;
          }

          allTasks.push({
            id: task.id,
            processId: task.processId || task.id,
            pid: task.pid,
            status: task.status,
            command: task.command,
            tool: task.tool as ToolType | undefined,
            workspace: task.workspace,
            prd: task.getPrdId(),
            branch: task.branch,
            worktree: extractWorktreeName(task.worktree.path),
            workingDir: task.worktree.path,
            createdAt: task.timestamp,
            startedAt: task.startedAt,
          });
        }
      } catch (error) {
        // Skip workspaces with invalid config
      }
    }

    return allTasks;
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

/**
 * Extract worktree name from path
 * 从路径中提取 worktree 名称
 *
 * @param worktreePath - Worktree path (e.g., "/path/to/repo/worktrees/feature-branch")
 * @returns Worktree name (e.g., "feature-branch")
 * @throws Error if path format is invalid
 */
function extractWorktreeName(worktreePath: string): string {
  const match = worktreePath.match(/\/worktrees\/([^/]+)$/);
  if (!match) {
    throw new Error(`Invalid worktree path: ${worktreePath}. Expected path ending with /worktrees/<name>`);
  }
  return match[1];
}
