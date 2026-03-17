/**
 * UI Notifier Interface
 *
 * Provides notification capabilities for UI updates.
 * Streams real-time progress, errors, and completion events to connected clients.
 */
export interface IUINotifier {
  /**
   * Notify progress update
   *
   * @param taskId - Task identifier
   * @param progress - Progress value between 0 and 1
   * @param message - Optional progress message
   */
  notifyProgress(taskId: string, progress: number, message?: string): Promise<void>;

  /**
   * Notify error occurrence
   *
   * @param taskId - Task identifier
   * @param error - Error message or error object
   * @param context - Optional context about the error
   */
  notifyError(taskId: string, error: string | Error, context?: Record<string, unknown>): Promise<void>;

  /**
   * Notify task completion
   *
   * @param taskId - Task identifier
   * @param success - Whether task completed successfully
   * @param result - Optional result data
   */
  notifyCompletion(taskId: string, success: boolean, result?: unknown): Promise<void>;
}
