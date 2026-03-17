import { LogLevel } from "@talos/types";
import type { LogMetadata } from "@talos/types";

/**
 * LogFormatter - Unified log formatting
 *
 * Provides consistent log format across all loggers:
 * [timestamp] [LEVEL] message
 *
 * Timestamp format: YYYY-MM-DD HH:mm:ss (local timezone)
 */
export class LogFormatter {
  /**
   * Format a log entry according to the unified format
   *
   * @param level - Log level
   * @param message - Log message
   * @param metadata - Optional metadata
   * @returns Formatted log line with newline
   *
   * @example
   * const formatter = new LogFormatter();
   * const logLine = formatter.format("INFO", "Task started", { taskId: "task-123" });
   * // Output: [2026-03-15 10:30:45] [INFO] Task started {"taskId":"task-123"}
   */
  format(level: LogLevel, message: string, metadata?: LogMetadata): string {
    const timestamp = this.formatTimestamp(new Date());
    const metadataStr = this.formatMetadata(metadata);
    const metadataSuffix = metadataStr ? ` ${metadataStr}` : "";
    return `[${timestamp}] [${level}] ${message}${metadataSuffix}\n`;
  }

  /**
   * Format a timestamp as YYYY-MM-DD HH:mm:ss (local timezone)
   *
   * @param date - Date to format
   * @returns Formatted timestamp string
   */
  private formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Format metadata as JSON string
   *
   * @param metadata - Optional metadata
   * @returns JSON string or empty string
   */
  private formatMetadata(metadata?: LogMetadata): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return "";
    }
    try {
      return JSON.stringify(metadata);
    } catch (error) {
      // If metadata can't be stringified (circular refs, etc.), return a placeholder
      return "[metadata unavailable]";
    }
  }

  /**
   * Format an error message with error details
   *
   * @param message - Error message
   * @param error - Optional error object
   * @param metadata - Optional metadata
   * @returns Formatted log line with newline
   *
   * @example
   * const logLine = formatter.formatError("Failed to start task", error, { taskId: "task-123" });
   * // Output: [2026-03-15 10:30:45] [ERROR] Failed to start task Error: Command not found...
   */
  formatError(message: string, error?: Error, metadata?: LogMetadata): string {
    let fullMessage = message;
    if (error) {
      fullMessage += ` ${error.name}: ${error.message}`;
      if (error.stack) {
        // Include stack trace for debugging (on next line)
        fullMessage += `\n${error.stack}`;
      }
    }
    return this.format(LogLevel.ERROR, fullMessage, metadata);
  }
}
