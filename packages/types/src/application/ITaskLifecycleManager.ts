/**
 * Task Lifecycle Manager Interface
 *
 * Manages the complete lifecycle of tasks: starting, stopping, and resuming.
 * Provides a unified interface for task execution management.
 */
export interface ITaskLifecycleManager {
  /**
   * Start a new task
   *
   * @param prdId - PRD identifier
   * @param workingDir - Working directory for task execution
   * @param debug - Enable debug mode for detailed logging
   * @param tool - Tool to use for task execution (e.g., "claude", "cursor")
   * @param model - Model to use (e.g., "sonnet-4", "composer-1.5", "auto")
   * @returns Task execution result with taskId, processId, and pid
   */
  startTask(
    prdId: string,
    workingDir: string,
    debug?: boolean,
    tool?: string,
    model?: string
  ): Promise<{ taskId: string; processId: string; pid: number }>;

  /**
   * Stop a running task
   *
   * @param processId - Process identifier to stop
   * @param reason - Optional reason for stopping
   * @returns Promise that resolves when task is stopped
   */
  stopTask(processId: string, reason?: string): Promise<void>;

  /**
   * Resume a stopped task
   *
   * @param processId - Process identifier to resume
   * @param debug - Enable debug mode for detailed logging
   * @param tool - Tool to use for task execution
   * @param model - Model to use for execution
   * @returns Promise that resolves when task is resumed
   */
  resumeTask(
    processId: string,
    debug?: boolean,
    tool?: string,
    model?: string
  ): Promise<void>;
}
