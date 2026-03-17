/**
 * Infrastructure Layer: Logger Interface
 *
 * Defines the contract for logging operations.
 * Implementations must use unified format: [timestamp] [LEVEL] message
 */

/**
 * Log levels ordered by severity
 */
export enum LogLevel {
  /**
   * Informational messages
   */
  INFO = 'INFO',

  /**
   * Warning messages
   */
  WARN = 'WARN',

  /**
   * Error messages
   */
  ERROR = 'ERROR',

  /**
   * Audit log messages (for security and compliance)
   */
  AUDIT = 'AUDIT',
}

/**
 * Log entry metadata
 */
export interface LogMetadata {
  /**
   * Additional context information
   * Can include module, function, line number, etc.
   */
  [key: string]: unknown;
}

/**
 * Log entry structure
 */
export interface LogEntry {
  /**
   * Timestamp when the log entry was created
   */
  timestamp: Date;

  /**
   * Log level
   */
  level: LogLevel;

  /**
   * Log message
   */
  message: string;

  /**
   * Optional metadata
   */
  metadata?: LogMetadata;

  /**
   * Optional error object
   */
  error?: Error;
}

/**
 * Logger Interface
 *
 * Provides abstraction over logging operations.
 * Implementations must use unified format: [timestamp] [LEVEL] message
 *
 * Format specification:
 * - timestamp: ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
 * - level: One of INFO, WARN, ERROR, AUDIT
 * - message: The log message
 *
 * Example:
 * [2026-03-15T10:30:45.123Z] [INFO] Starting task manager
 *
 * Implementation notes:
 * - Must handle different output targets (console, file, etc.)
 * - Should support log rotation for file-based logs
 * - Must be thread-safe (if applicable)
 * - Should support structured logging (JSON format) for machine consumption
 * - Must preserve original error stack traces
 * - Should handle circular references in metadata
 */
export interface ILogger {
  /**
   * Log an informational message
   *
   * @param message - Message to log
   * @param metadata - Optional metadata to include with the log
   *
   * Usage:
   * - General information about program execution
   * - Normal operation milestones
   * - Diagnostic information for troubleshooting
   *
   * Example:
   * logger.info('Starting task manager', { taskId: 'task-123' });
   * // Output: [2026-03-15T10:30:45.123Z] [INFO] Starting task manager {"taskId":"task-123"}
   */
  info(message: string, metadata?: LogMetadata): void;

  /**
   * Log a warning message
   *
   * @param message - Warning message to log
   * @param metadata - Optional metadata to include with the log
   *
   * Usage:
   * - Unexpected situations that don't prevent operation
   * - Deprecated API usage
   * - Performance concerns
   * - Configuration issues with fallbacks
   *
   * Example:
   * logger.warn('Task timeout', { taskId: 'task-123', timeout: 5000 });
   * // Output: [2026-03-15T10:30:45.123Z] [WARN] Task timeout {"taskId":"task-123","timeout":5000}
   */
  warn(message: string, metadata?: LogMetadata): void;

  /**
   * Log an error message
   *
   * @param message - Error message to log
   * @param error - Optional error object to include
   * @param metadata - Optional metadata to include with the log
   *
   * Usage:
   * - Error conditions that prevent normal operation
   * - Exceptions and failure conditions
   * - Critical failures requiring attention
   *
   * Example:
   * logger.error('Failed to start task', error, { taskId: 'task-123' });
   * // Output: [2026-03-15T10:30:45.123Z] [ERROR] Failed to start task Error: Command not found...
   */
  error(message: string, error?: Error, metadata?: LogMetadata): void;

  /**
   * Log an audit message
   *
   * @param message - Audit message to log
   * @param metadata - Optional metadata to include with the log
   *
   * Usage:
   * - Security-relevant events (authentication, authorization)
   * - Critical state changes (task started, task stopped)
   * - Compliance and regulatory requirements
   * - Business operations that need traceability
   *
   * Example:
   * logger.audit('Task started', { taskId: 'task-123', userId: 'user-456' });
   * // Output: [2026-03-15T10:30:45.123Z] [AUDIT] Task started {"taskId":"task-123","userId":"user-456"}
   *
   * Implementation notes:
   * - Audit logs should be written to a separate, immutable log file
   * - Must include timestamp, action, actor, and affected resources
   * - Should be protected from tampering (append-only, write-once)
   * - Must not be filtered by log level (always record audit events)
   */
  audit(message: string, metadata?: LogMetadata): void;

  /**
   * Set the minimum log level
   *
   * @param level - Minimum log level to record
   *
   * Implementation notes:
   * - Messages below this level should be ignored
   * - Default level should be INFO
   * - Must affect all log methods (info, warn, error, audit)
   * - Audit logs should NOT be affected by log level (always record)
   */
  setLevel(level: LogLevel): void;

  /**
   * Get the current minimum log level
   *
   * @returns Current minimum log level
   */
  getLevel(): LogLevel;
}
