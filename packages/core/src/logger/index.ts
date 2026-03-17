import fs from "fs";
import path from "path";
import { promisify } from "util";
import type { ILogger, LogMetadata } from "@talos/types";
import { LogLevel } from "@talos/types";
import { LogFormatter } from "../infrastructure/logging/LogFormatter";

const mkdir = promisify(fs.mkdir);
const appendFile = promisify(fs.appendFile);
const stat = promisify(fs.stat);
const rename = promisify(fs.rename);

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /** Log file path (default: ~/.talos/daemon.log) */
  logPath?: string;
  /** Maximum log file size in bytes (default: 10MB) */
  maxSize?: number;
  /** Number of backup files to keep (default: 3) */
  maxFiles?: number;
}

/**
 * Default logger configuration
 */
const DEFAULT_LOGGER_OPTIONS: Required<LoggerOptions> = {
  logPath: path.join(process.env.HOME || "", ".talos", "daemon.log"),
  maxSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 3,
};

/**
 * Logger class with file rotation support
 *
 * Implements ILogger interface from @talos/types
 *
 * Features:
 * - Log levels: info, warn, error, audit
 * - Log format: [YYYY-MM-DD HH:mm:ss] [LEVEL] message
 * - Configurable log file path
 * - Automatic log rotation when file size exceeds maxSize
 * - Keeps specified number of backup files
 * - Supports metadata and error objects
 *
 * @example
 * ```ts
 * const logger = new Logger({ logPath: "/var/log/daemon.log" });
 * logger.info("Daemon started", { pid: 123 });
 * logger.error("Failed to connect", error, { endpoint: "api" });
 * logger.audit("User logged in", { userId: "user-123" });
 * ```
 */
export class Logger implements ILogger {
  private options: Required<LoggerOptions>;
  private rotating = false;
  private formatter: LogFormatter;
  private currentLevel: LogLevel;

  constructor(options: LoggerOptions = {}) {
    this.options = { ...DEFAULT_LOGGER_OPTIONS, ...options };
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

    // Format the log entry
    const logLine = this.formatter.format(level, message, metadata);

    // Check if rotation is needed before writing
    await this.checkAndRotate();

    // Ensure directory exists
    const logDir = path.dirname(this.options.logPath);
    try {
      await mkdir(logDir, { recursive: true });
    } catch (err) {
      // Ignore error if directory already exists
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
        throw err;
      }
    }

    // Append to log file
    try {
      await appendFile(this.options.logPath, logLine);
    } catch (writeError) {
      // If write fails, try to log to stderr as fallback
      console.error(`[Logger] Failed to write to log file: ${writeError}`);
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
   * Check if log rotation is needed and perform it
   */
  private async checkAndRotate(): Promise<void> {
    // Prevent concurrent rotations
    if (this.rotating) {
      return;
    }

    try {
      const stats = await stat(this.options.logPath);

      // Check if file size exceeds max size
      if (stats.size >= this.options.maxSize) {
        this.rotating = true;
        await this.rotate();
      }
    } catch (error) {
      // File doesn't exist yet, no rotation needed
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    } finally {
      this.rotating = false;
    }
  }

  /**
   * Perform log rotation
   *
   * Rotation scheme:
   * - daemon.log -> daemon.log.1
   * - daemon.log.1 -> daemon.log.2
   * - daemon.log.2 -> daemon.log.3
   * - daemon.log.3 (deleted, if maxFiles=3)
   */
  private async rotate(): Promise<void> {
    const logDir = path.dirname(this.options.logPath);
    const logName = path.basename(this.options.logPath);
    const logExt = path.extname(this.options.logPath);
    const logBase = logName.replace(logExt, "");

    // Remove oldest backup if it exists
    const oldestBackup = path.join(
      logDir,
      `${logBase}${logExt}.${this.options.maxFiles}`
    );
    try {
      await stat(oldestBackup);
      // File exists, but we can't delete files directly with promises
      // Use fs.unlink with promisify
      await promisify(fs.unlink)(oldestBackup);
    } catch (error) {
      // File doesn't exist, that's fine
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    // Rotate existing backup files
    for (let i = this.options.maxFiles - 1; i >= 1; i--) {
      const currentBackup = path.join(logDir, `${logBase}${logExt}.${i}`);
      const nextBackup = path.join(logDir, `${logBase}${logExt}.${i + 1}`);

      try {
        await stat(currentBackup);
        await rename(currentBackup, nextBackup);
      } catch (error) {
        // File doesn't exist, that's fine
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    }

    // Rotate current log file
    const firstBackup = path.join(logDir, `${logBase}${logExt}.1`);
    await rename(this.options.logPath, firstBackup);
  }
}

// Re-export TaskLogger
export { TaskLogger } from "./task-logger";

// Re-export LoggerClient
export { LoggerClient } from "./client";
export type { LoggerClientOptions } from "./client";
