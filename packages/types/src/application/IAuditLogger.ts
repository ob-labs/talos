/**
 * Audit Logger Interface
 *
 * Provides audit logging for security and compliance.
 * Records all significant actions and state changes.
 */
export interface IAuditLogger {
  /**
   * Log an action
   *
   * @param action - Action name (e.g., "task_started", "task_stopped", "config_modified")
   * @param details - Action details including context information
   * @param userId - Optional user identifier
   */
  logAction(
    action: string,
    details: {
      taskId?: string;
      processId?: string;
      [key: string]: unknown;
    },
    userId?: string
  ): Promise<void>;

  /**
   * Get audit logs with optional filtering
   *
   * @param filter - Optional filter criteria
   * @returns Array of audit log entries
   */
  getAuditLogs(filter?: {
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
  }>>;
}
