/**
 * TaskManager - Lightweight coordinator for task execution
 *
 * Delegates to specialized services: TaskOrchestrator (execution), ProgressTracker (status),
 * MetricsCollector (metrics), AuditLogger (audit logs), SessionManager (sessions).
 */

import type {
  ITask,
  IPRD,
  ITaskOrchestrator,
  IProgressTracker,
  ISessionManager,
  IUINotifier,
  IMetricsCollector,
  IAuditLogger,
  IEventBus,
  ILogger,
} from "@talos/types";

/**
 * Task Manager Options
 */
export interface TaskManagerOptions {
  task: ITask;
  prd: IPRD;
  taskOrchestrator: ITaskOrchestrator;
  progressTracker: IProgressTracker;
  sessionManager: ISessionManager;
  uiNotifier: IUINotifier;
  metricsCollector: IMetricsCollector;
  auditLogger: IAuditLogger;
  eventBus: IEventBus;
  logger: ILogger;
}

/**
 * Task Manager Class
 *
 * Coordinates task execution by delegating to specialized services.
 * All business logic is handled by TaskOrchestrator, ProgressTracker,
 * MetricsCollector, and AuditLogger.
 */
export class TaskManager {
  private task: ITask;
  private prd: IPRD;
  private taskOrchestrator: ITaskOrchestrator;
  private progressTracker: IProgressTracker;
  private sessionManager: ISessionManager;
  private uiNotifier: IUINotifier;
  private metricsCollector: IMetricsCollector;
  private auditLogger: IAuditLogger;
  private eventBus: IEventBus;
  private logger: ILogger;

  constructor(options: TaskManagerOptions) {
    this.task = options.task;
    this.prd = options.prd;
    this.taskOrchestrator = options.taskOrchestrator;
    this.progressTracker = options.progressTracker;
    this.sessionManager = options.sessionManager;
    this.uiNotifier = options.uiNotifier;
    this.metricsCollector = options.metricsCollector;
    this.auditLogger = options.auditLogger;
    this.eventBus = options.eventBus;
    this.logger = options.logger;
  }

  /**
   * Start task execution
   *
   * Logs audit event (task_created) and starts task orchestration.
   */
  async start(): Promise<void> {
    this.logger.info(`Starting task ${this.task.id}`);

    // Log audit event
    await this.auditLogger.logAction("task_created", {
      taskId: this.task.id,
      prdId: this.prd.id,
      
    });

    // Start task orchestration
    await this.taskOrchestrator.start();

    this.logger.info(`Task ${this.task.id} started successfully`);
  }

  /**
   * Stop task execution
   *
   * Stops task orchestration and logs audit event (task_stopped).
   */
  async stop(): Promise<void> {
    this.logger.info(`Stopping task ${this.task.id}`);

    // Stop task orchestration
    await this.taskOrchestrator.stop();

    // Log audit event
    await this.auditLogger.logAction("task_stopped", {
      taskId: this.task.id,
      prdId: this.prd.id,
      
    });

    this.logger.info(`Task ${this.task.id} stopped successfully`);
  }

  /**
   * Pause task execution
   *
   * Pauses task orchestration.
   */
  async pause(): Promise<void> {
    this.logger.info(`Pausing task ${this.task.id}`);

    // Pause task orchestration
    await this.taskOrchestrator.pauseExecution();

    this.logger.info(`Task ${this.task.id} paused successfully`);
  }

  /**
   * Resume task execution
   *
   * Resumes task orchestration.
   */
  async resume(): Promise<void> {
    this.logger.info(`Resuming task ${this.task.id}`);

    // Resume task orchestration
    await this.taskOrchestrator.resumeExecution();

    this.logger.info(`Task ${this.task.id} resumed successfully`);
  }

  /**
   * Get task status
   *
   * Delegates to ProgressTracker to get task status.
   *
   * @returns Task status with progress information
   */
  async getStatus(): Promise<{
    status: string;
    progress: { completed: number; total: number };
  }> {
    // Get progress from ProgressTracker
    const progress = await this.progressTracker.getProgress(this.prd.id) as {
      completed: number;
      total: number;
    };

    return {
      status: this.task.status,
      progress,
    };
  }

  /**
   * Get task metrics
   *
   * Delegates to MetricsCollector to get task metrics.
   *
   * @returns Task metrics summary
   */
  async getMetrics(): Promise<string> {
    return await this.metricsCollector.getSummary();
  }

  /**
   * Get audit logs
   *
   * Delegates to AuditLogger to get audit logs.
   *
   * @param filter - Optional filter criteria
   * @returns Array of audit log entries
   */
  async getAuditLogs(filter?: {
    action?: string;
    taskId?: string;
    processId?: string;
    userId?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<Array<{
    timestamp: Date;
    action: string;
    details: {
      taskId?: string;
      processId?: string;
      [key: string]: unknown;
    };
    userId?: string;
  }>> {
    return await this.auditLogger.getAuditLogs({
      ...filter,
      taskId: filter?.taskId || this.task.id,
    });
  }

  /**
   * Get execution progress
   *
   * Delegates to ProgressTracker to get detailed progress.
   *
   * @returns Execution progress summary
   */
  getExecutionProgress(): {
    total: number;
    passing: number;
    incomplete: number;
    percentage: number;
  } {
    return this.progressTracker.getExecutionProgress();
  }

  /**
  /**
   * Get task
   *
   * Returns the task being managed.
   *
   * @returns Task entity
   */
  getTask(): ITask {
    return this.task;
  }

  /**
   * Get PRD
   *
   * Returns the PRD being executed.
   *
   * @returns PRD entity
   */
  getPRD(): IPRD {
    return this.prd;
  }
}
