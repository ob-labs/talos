/**
 * UI Notifier
 *
 * Sends UI notifications to users via logger and event bus.
 * Streams real-time progress, errors, and completion events to connected clients.
 *
 * RESPONSIBILITIES:
 * - Format and log UI notification messages
 * - Publish UI events to event bus for consumption by clients
 * - Provide structured notification interface for task orchestration
 *
 * DEPENDENCIES:
 * - logger: ILogger - Logging
 * - eventBus: IEventBus - Event publishing
 *
 * EVENTS PUBLISHED:
 * - ui:progress: Progress update events
 * - ui:error: Error notification events
 * - ui:completion: Task completion events
 */

import type { IUINotifier, ILogger, IEventBus } from "@talos/types";

/**
 * UINotifier Options
 */
export interface UINotifierOptions {
  logger: ILogger;
  eventBus: IEventBus;
}

/**
 * UI Notifier Class
 *
 * Implements IUINotifier interface for sending UI notifications.
 * Notifications are logged and published as events for consumption by clients.
 */
export class UINotifier implements IUINotifier {
  private logger: ILogger;
  private eventBus: IEventBus;

  constructor(options: UINotifierOptions) {
    this.logger = options.logger;
    this.eventBus = options.eventBus;
  }

  /**
   * Notify progress update
   *
   * Formats progress message, logs via logger, publishes 'ui:progress' event.
   *
   * @param taskId - Task identifier
   * @param progress - Progress value between 0 and 1
   * @param message - Optional progress message
   */
  async notifyProgress(taskId: string, progress: number, message?: string): Promise<void> {
    const progressPercent = Math.round(progress * 100);
    const formattedMessage = message
      ? `[${taskId}] Progress: ${progressPercent}% - ${message}`
      : `[${taskId}] Progress: ${progressPercent}%`;

    // Log progress message
    this.logger.info(formattedMessage);

    // Publish event
    this.eventBus.emit("ui:progress", {
      taskId,
      progress,
      progressPercent,
      message,
      timestamp: Date.now()
    });
  }

  /**
   * Notify error occurrence
   *
   * Formats error message, logs via logger.error, publishes 'ui:error' event.
   *
   * @param taskId - Task identifier
   * @param error - Error message or error object
   * @param context - Optional context about the error
   */
  async notifyError(taskId: string, error: string | Error, context?: Record<string, unknown>): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error;
    const formattedMessage = `[${taskId}] Error: ${errorMessage}`;

    // Log error
    this.logger.error(formattedMessage, error instanceof Error ? error : undefined, context);

    // Publish event
    this.eventBus.emit("ui:error", {
      taskId,
      error: errorMessage,
      context,
      timestamp: Date.now()
    });
  }

  /**
   * Notify task completion
   *
   * Formats completion message, logs via logger.info, publishes 'ui:completion' event.
   *
   * @param taskId - Task identifier
   * @param success - Whether task completed successfully
   * @param result - Optional result data
   */
  async notifyCompletion(taskId: string, success: boolean, result?: unknown): Promise<void> {
    const status = success ? "completed successfully" : "failed";
    const formattedMessage = `[${taskId}] Task ${status}`;

    // Log completion message
    this.logger.info(formattedMessage);

    // Publish event
    this.eventBus.emit("ui:completion", {
      taskId,
      success,
      result,
      timestamp: Date.now()
    });
  }
}
