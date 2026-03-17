/**
 * Health Checker Interface
 *
 * Provides health monitoring capabilities for tasks and processes.
 * Periodically checks process health and performs cleanup actions.
 */
export interface IHealthChecker {
  /**
   * Start the health checker
   *
   * Begins periodic health checks at configured intervals.
   * Automatic zombie process detection and cleanup.
   */
  start(): Promise<void>;

  /**
   * Stop the health checker
   *
   * Stops periodic health checks and performs final cleanup.
   */
  stop(): Promise<void>;

  /**
   * Check health of a specific task
   *
   * @param processId - Process identifier to check
   * @returns Health status with alive flag and optional error message
   */
  checkTaskHealth(processId: string): Promise<{ alive: boolean; error?: string }>;
}
