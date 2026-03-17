/**
 * HealthChecker - Periodic health monitoring for tasks
 *
 * Responsibilities:
 * - Periodic health checks (default 10s interval) for running tasks
 * - Process alive detection and zombie cleanup
 * - State transition: running → completed/failed based on exit status
 *
 * Uses WorkspaceRepository + TaskRepository for task access.
 *
 * @example
 * const healthChecker = new HealthChecker({ processManager, processRegistry, eventBus, logger });
 * await healthChecker.start();
 * await healthChecker.checkTaskHealth('task-123');
 * await healthChecker.stop();
 */

import type { ILogger } from "@talos/types";
import type { IEventBus } from "@talos/types";
import type { IHealthChecker } from "@talos/types";
import type { IProcessManager } from "@talos/types";
import { ProcessRegistry } from "@/infrastructure/process/ProcessRegistry";
import { Task } from "@/domain/entities/Task";
import { TaskRepository } from "@/domain/repositories/TaskRepository";
import { WorkspaceRepository } from "@/repositories/workspace-repository";
import { getTaskExitPath } from "@/infrastructure/constant";

/**
 * Health checker dependencies
 */
export interface HealthCheckerDependencies {
  /**
   * Process manager for checking process health
   */
  processManager: IProcessManager;

  /**
   * Process registry for tracking process metadata
   */
  processRegistry: ProcessRegistry;

  /**
   * Event bus for publishing task events
   */
  eventBus: IEventBus;

  /**
   * Logger for logging health check operations
   */
  logger: ILogger;
}

/**
 * Task health status
 */
export interface TaskHealthStatus {
  /**
   * Whether the task process is alive
   */
  alive: boolean;

  /**
   * Error message if process failed (optional)
   */
  error?: string;
}

/**
 * Task info with workspace context
 */
interface TaskWithContext {
  task: Task;
  repoRoot: string;
}

/**
 * HealthChecker - Periodic health monitoring service
 */
export class HealthChecker implements IHealthChecker {
  private processManager: IProcessManager;
  private processRegistry: ProcessRegistry;
  private eventBus: IEventBus;
  private logger: ILogger;
  private workspaceRepository: WorkspaceRepository;

  /**
   * Periodic health check timer
   */
  private healthCheckTimer?: NodeJS.Timeout;

  /**
   * Default health check interval (10 seconds)
   */
  private readonly DEFAULT_INTERVAL_MS = 10000;

  constructor(deps: HealthCheckerDependencies) {
    this.processManager = deps.processManager;
    this.processRegistry = deps.processRegistry;
    this.eventBus = deps.eventBus;
    this.logger = deps.logger;
    this.workspaceRepository = new WorkspaceRepository();
  }

  /**
   * Start periodic health checks
   *
   * Begins checking the health of all in_progress tasks at regular intervals.
   * Default interval is 10 seconds.
   *
   * @param intervalMs - Health check interval in milliseconds (default: 10000)
   */
  async start(intervalMs?: number): Promise<void> {
    if (this.healthCheckTimer) {
      this.logger.warn("HealthChecker already started, ignoring duplicate start() call");
      return;
    }

    const interval = intervalMs ?? this.DEFAULT_INTERVAL_MS;
    this.logger.info(`🩺 HealthChecker started with interval: ${interval}ms`);

    // Perform initial health check immediately
    await this.performPeriodicHealthCheck();

    // Schedule periodic health checks
    this.healthCheckTimer = setInterval(async () => {
      await this.performPeriodicHealthCheck();
    }, interval);
  }

  /**
   * Stop periodic health checks
   *
   * Stops the periodic health check timer and performs final cleanup.
   */
  async stop(): Promise<void> {
    if (!this.healthCheckTimer) {
      this.logger.warn("HealthChecker not started, ignoring stop() call");
      return;
    }

    clearInterval(this.healthCheckTimer);
    this.healthCheckTimer = undefined;

    this.logger.info("🩺 HealthChecker stopped");
  }

  /**
   * Check health of a specific task
   *
   * Loads the task entity, checks if its process is alive, and updates
   * the task state if the process has exited.
   *
   * @param processId - Process identifier (taskId) to check
   * @returns Health status with alive flag and optional error message
   */
  async checkTaskHealth(processId: string): Promise<TaskHealthStatus> {
    this.logger.info(`🩺 Checking health of task: ${processId}`);

    // 1. Get task info from repositories
    const taskWithContext = await this.findTaskByProcessId(processId);
    if (!taskWithContext) {
      const error = `Task ${processId} not found in storage`;
      this.logger.warn(error);
      return { alive: false, error };
    }

    const { task, repoRoot } = taskWithContext;

    // 2. Check if task has a PID
    if (!task.pid) {
      const error = `Task ${processId} has no PID to check`;
      this.logger.warn(error);
      return { alive: false, error };
    }

    // 3. Check if process is alive
    const isAlive = await this.processManager.isAlive(task.pid);

    if (isAlive) {
      // Task is still running and healthy
      this.logger.info(`✅ Task ${processId} is alive (PID: ${task.pid})`);
      return { alive: true };
    }

    // 4. Process has exited - determine real state
    this.logger.info(`⚠️  Task ${processId} process has exited (PID: ${task.pid})`);

    // 5. Update task state based on exit reason
    const exitJsonPath = getTaskExitPath(repoRoot, processId);
    const exitReason = "Process exited";
    let isSuccessful = false; // Default to failed

    try {
      // Try to read exit.json file created by ralph-cli
      const { promises: fs } = await import("fs");

      try {
        const exitData = await fs.readFile(exitJsonPath, "utf-8");
        const exitInfo = JSON.parse(exitData);
        isSuccessful = exitInfo.exitCode === 0;
        this.logger.info(`📄 Read exit info from ${exitJsonPath}: ${JSON.stringify(exitInfo)}`);
      } catch {
        this.logger.info(`📄 No exit.json found, using default: failed`);
      }

      // 6. Load task entity and update state
      const taskRepository = new TaskRepository(repoRoot);
      const taskEntity = await taskRepository.findById(processId);

      if (taskEntity) {
        if (isSuccessful) {
          // Task completed successfully
          if (taskEntity.status === "running") {
            taskEntity.complete();
            await taskRepository.save(taskEntity);

            this.eventBus.emit("task:completed", {
              taskId: processId,
              exitReason,
            });

            this.logger.info(`✅ Task ${processId} marked as completed`);
          }
        } else {
          // Task failed - RELOAD task status to avoid race condition with stopTask
          // If the task was manually stopped after we read it initially, we must respect that state
          const latestTaskEntity = await taskRepository.findById(processId);

          // Only mark as failed if the task is still in "running" state
          // If it's already "stopped", "completed", or "failed", don't override
          if (latestTaskEntity && latestTaskEntity.status === "running") {
            latestTaskEntity.fail(exitReason);
            await taskRepository.save(latestTaskEntity);

            this.eventBus.emit("task:failed", {
              taskId: processId,
              error: exitReason,
            });

            this.logger.info(`❌ Task ${processId} marked as failed: ${exitReason}`);
          } else if (latestTaskEntity) {
            this.logger.info(
              `⏭️  Task ${processId} not marked as failed (current status: ${latestTaskEntity.status})`
            );
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorObj = error instanceof Error ? error : undefined;
      this.logger.error(`Failed to update task ${processId} state: ${errorMessage}`, errorObj);
      return { alive: false, error: errorMessage };
    }

    return { alive: false, error: isSuccessful ? undefined : exitReason };
  }

  /**
   * Cleanup zombie processes
   *
   * Iterates through all tasks marked as in_progress and checks if their
   * processes are actually running. Updates state for dead processes.
   *
   * @returns Number of zombie processes cleaned up
   */
  async cleanupZombieProcesses(): Promise<number> {
    this.logger.info("🧹 Starting zombie process cleanup");

    let zombiesCleaned = 0;

    try {
      // Get all workspaces
      const workspaces = await this.workspaceRepository.findAll();

      for (const ws of workspaces) {
        try {
          const repoRoot = ws.path;
          const taskRepository = new TaskRepository(repoRoot);

          // Get all in_progress tasks for this workspace
          const runningTasks = await taskRepository.findAll({
            status: "running",
          });

          for (const task of runningTasks) {
            if (!task.pid) {
              continue;
            }

            // Check if process is actually alive
            const isAlive = await this.processManager.isAlive(task.pid);

            if (!isAlive) {
              // Process is dead but task state is in_progress - it's a zombie!
              this.logger.info(`🧟 Found zombie task: ${task.id} (PID: ${task.pid})`);

              // Update task state to failed
              try {
                task.fail("Process exited without proper cleanup");
                await taskRepository.save(task);

                this.eventBus.emit("task:failed", {
                  taskId: task.id,
                  error: "Process exited without proper cleanup",
                });

                zombiesCleaned++;
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(
                  `Failed to cleanup zombie task ${task.id}: ${errorMessage}`
                );
              }
            }
          }
        } catch (error) {
          // Skip workspaces with errors
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Failed to cleanup zombies in workspace ${ws.path}: ${errorMessage}`);
        }
      }

      this.logger.info(`🧹 Zombie cleanup completed: ${zombiesCleaned} zombies cleaned`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error during zombie cleanup: ${errorMessage}`);
    }

    return zombiesCleaned;
  }

  /**
   * Find task by process ID across all workspaces
   *
   * Uses WorkspaceRepository and TaskRepository to find tasks.
   *
   * @param processId - Process identifier (task ID)
   * @returns Task with workspace context, or null if not found
   */
  private async findTaskByProcessId(processId: string): Promise<TaskWithContext | null> {
    const workspaces = await this.workspaceRepository.findAll();

    for (const ws of workspaces) {
      try {
        const taskRepository = new TaskRepository(ws.path);
        const task = await taskRepository.findById(processId);

        if (task) {
          return {
            task,
            repoRoot: ws.path,
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
   * Perform periodic health check
   *
   * Checks health of all in_progress tasks and logs results.
   * This is called automatically by the periodic timer.
   */
  private async performPeriodicHealthCheck(): Promise<void> {
    try {
      // Get all workspaces and check tasks in each
      const workspaces = await this.workspaceRepository.findAll();
      let totalRunningTasks = 0;

      for (const ws of workspaces) {
        try {
          const repoRoot = ws.path;
          const taskRepository = new TaskRepository(repoRoot);
          const runningTasks = await taskRepository.findAll({
            status: "running",
          });
          totalRunningTasks += runningTasks.length;

          for (const task of runningTasks) {
            await this.checkTaskHealth(task.id);
          }
        } catch (error) {
          // Skip workspaces with errors
        }
      }

      if (totalRunningTasks > 0) {
        this.logger.info(`🩺 Health check complete: checked ${totalRunningTasks} tasks`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error during periodic health check: ${errorMessage}`);
    }
  }
}
