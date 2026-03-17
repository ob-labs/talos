import fs from "fs";
import path from "path";
import { promisify } from "util";
import type { ILogger, LogMetadata } from "@talos/types";
import { LogLevel } from "@talos/types";
import { LogFormatter } from "../infrastructure/logging/LogFormatter";

const appendFile = promisify(fs.appendFile);
const mkdir = promisify(fs.mkdir);

/**
 * TaskLogger configuration options
 */
export interface TaskLoggerOptions {
  /** Base directory for log files (default: .talos/logs) */
  baseDir?: string;
  /** Task identifier for this logger instance */
  taskId: string;
}

/**
 * TaskLogger - Centralized logger for task-specific log files
 *
 * Implements ILogger interface from @talos/types
 *
 * Features:
 * - Thread-safe file operations using fs.appendFile
 * - Automatic directory and file creation
 * - ISO8601 timestamps for each log entry
 * - Writes to .talos/logs/{taskId}.log
 * - Unified log format with metadata support
 * - Log level filtering
 *
 * @example
 * ```ts
 * const taskLogger = new TaskLogger({ taskId: "task-123" });
 * taskLogger.info("Task started", { pid: 456 });
 * taskLogger.error("Task failed", error, { step: "build" });
 * taskLogger.audit("Task completed", { duration: 5000 });
 * ```
 */
export class TaskLogger implements ILogger {
  private baseDir: string;
  private taskId: string;
  private formatter: LogFormatter;
  private currentLevel: LogLevel;

  constructor(options: TaskLoggerOptions) {
    this.baseDir = options.baseDir || ".talos/logs";
    this.taskId = options.taskId;
    this.formatter = new LogFormatter();
    this.currentLevel = LogLevel.INFO; // Default log level
  }

  /**
   * Log an info message
   * @param message Message to log
   * @param metadata Optional metadata
   */
  info(message: string, metadata?: LogMetadata): void {
    this.writeLog(LogLevel.INFO, message, metadata);
  }

  /**
   * Log a warning message
   * @param message Warning message to log
   * @param metadata Optional metadata
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.writeLog(LogLevel.WARN, message, metadata);
  }

  /**
   * Log an error message
   * @param message Error message to log
   * @param error Optional error object
   * @param metadata Optional metadata
   */
  error(message: string, error?: Error, metadata?: LogMetadata): void {
    // Format error with stack trace
    let fullMessage = message;
    if (error) {
      fullMessage += ` ${error.name}: ${error.message}`;
      if (error.stack) {
        fullMessage += `\n${error.stack}`;
      }
    }
    this.writeLog(LogLevel.ERROR, fullMessage, metadata);
  }

  /**
   * Log an audit message
   * @param message Audit message to log
   * @param metadata Optional metadata
   *
   * Audit logs are always written regardless of log level
   */
  audit(message: string, metadata?: LogMetadata): void {
    // Audit logs are always written, bypass log level check
    this.writeLog(LogLevel.AUDIT, message, metadata, true);
  }

  /**
   * Set the minimum log level
   * @param level Minimum log level to record
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Get the current minimum log level
   * @returns Current minimum log level
   */
  getLevel(): LogLevel {
    return this.currentLevel;
  }

  /**
   * Internal method to write log entry to file
   * @param level Log level
   * @param message Log message
   * @param metadata Optional metadata
   * @param forceWrite If true, bypass log level check (for audit logs)
   */
  private async writeLog(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata,
    forceWrite = false
  ): Promise<void> {
    // Check if this level should be logged
    if (!forceWrite && !this.shouldLog(level)) {
      return;
    }

    // Add taskId to metadata if not already present
    const enrichedMetadata = { taskId: this.taskId, ...metadata };

    // Format the log entry
    const logLine = this.formatter.format(level, message, enrichedMetadata);

    // Resolve the full log file path
    const logFilePath = this.getLogFilePath();

    // Ensure directory exists
    await this.ensureDirectoryExists(logFilePath);

    // Use fs.appendFile for atomic write operations
    try {
      await appendFile(logFilePath, logLine, "utf-8");
    } catch (writeError) {
      // If write fails, try to log to stderr as fallback
      console.error(`[TaskLogger] Failed to write to log file: ${writeError}`);
      console.error(logLine.trim());
    }
  }

  /**
   * Check if a log level should be logged
   * @param level Log level to check
   * @returns True if should log
   */
  private shouldLog(level: LogLevel): boolean {
    const levelPriority: Record<LogLevel, number> = {
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
      [LogLevel.AUDIT]: 4, // Audit logs are always written
    };
    return levelPriority[level] >= levelPriority[this.currentLevel];
  }

  /**
   * Get the full path to the task's log file
   * @returns The absolute path to the log file
   */
  private getLogFilePath(): string {
    return path.join(this.baseDir, `${this.taskId}.log`);
  }

  /**
   * Ensure the directory for the log file exists
   * @param filePath - The path to the log file
   */
  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);

    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      // Ignore error if directory already exists
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use info() instead
   */
  async log(message: string): Promise<void> {
    this.info(message);
  }
}
