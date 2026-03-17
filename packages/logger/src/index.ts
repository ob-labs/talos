/**
 * @talos/logger - Unified logging service for Talos
 *
 * Provides a simple, dependency-free logging utility with file rotation support.
 * Can be used by any @talos package without creating circular dependencies.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Log level enum
 */
export type LogLevel = "info" | "warn" | "error";

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /** Log file path (required) */
  logPath: string;
  /** Maximum log file size in bytes (default: 10MB) */
  maxSize?: number;
  /** Number of backup files to keep (default: 3) */
  maxFiles?: number;
}

/**
 * Default logger configuration
 */
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_FILES = 3;

/**
 * Logger class with file rotation support
 *
 * Features:
 * - Log levels: info, warn, error
 * - Log format: [YYYY-MM-DD HH:mm:ss] [LEVEL] message
 * - Configurable log file path
 * - Automatic log rotation when file size exceeds maxSize
 * - Keeps specified number of backup files
 *
 * @example
 * ```ts
 * import { Logger } from '@talos/logger';
 *
 * const logger = new Logger({ logPath: "/var/log/daemon.log" });
 * await logger.info("Daemon started");
 * await logger.error("Failed to connect to service");
 * ```
 */
export class Logger {
  private logPath: string;
  private maxSize: number;
  private maxFiles: number;
  private rotating = false;

  constructor(options: LoggerOptions) {
    this.logPath = options.logPath;
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this.maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  }

  /**
   * Log an info message
   * @param message Message to log
   */
  async info(message: string): Promise<void> {
    await this.log("info", message);
  }

  /**
   * Log a warning message
   * @param message Message to log
   */
  async warn(message: string): Promise<void> {
    await this.log("warn", message);
  }

  /**
   * Log an error message
   * @param message Message to log
   */
  async error(message: string): Promise<void> {
    await this.log("error", message);
  }

  /**
   * Internal logging method
   * @param level Log level
   * @param message Message to log
   */
  private async log(level: LogLevel, message: string): Promise<void> {
    // Format timestamp in local timezone
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    // Check if rotation is needed before writing
    await this.checkAndRotate();

    // Ensure directory exists
    const logDir = path.dirname(this.logPath);
    await fs.mkdir(logDir, { recursive: true });

    // Append to log file
    await fs.appendFile(this.logPath, logLine);
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
      const stats = await fs.stat(this.logPath);

      // Check if file size exceeds max size
      if (stats.size >= this.maxSize) {
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
    const logDir = path.dirname(this.logPath);
    const logName = path.basename(this.logPath);
    const logExt = path.extname(this.logPath);
    const logBase = logName.replace(logExt, "");

    // Remove oldest backup if it exists
    const oldestBackup = path.join(
      logDir,
      `${logBase}${logExt}.${this.maxFiles}`
    );
    try {
      await fs.stat(oldestBackup);
      await fs.unlink(oldestBackup);
    } catch (error) {
      // File doesn't exist, that's fine
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    // Rotate existing backup files
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const currentBackup = path.join(logDir, `${logBase}${logExt}.${i}`);
      const nextBackup = path.join(logDir, `${logBase}${logExt}.${i + 1}`);

      try {
        await fs.stat(currentBackup);
        await fs.rename(currentBackup, nextBackup);
      } catch (error) {
        // File doesn't exist, that's fine
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    }

    // Rotate current log file
    const firstBackup = path.join(logDir, `${logBase}${logExt}.1`);
    await fs.rename(this.logPath, firstBackup);
  }
}

/**
 * Create a logger instance with the given options
 * Convenience function for simpler logger creation
 */
export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}
