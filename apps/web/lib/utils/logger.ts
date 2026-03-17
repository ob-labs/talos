import fs from "fs/promises";
import path from "path";

/**
 * Log levels for logging system
 */
export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

/**
 * Log entry structure
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  stack?: string;
}

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  logToFile?: boolean;
  logToConsole?: boolean;
  logDirectory?: string;
  maxFileSize?: number; // in bytes
  enableAuditLog?: boolean;
}

/**
 * Default logger options
 */
const DEFAULT_OPTIONS: LoggerOptions = {
  logToFile: true,
  logToConsole: true,
  logDirectory: "data/logs",
  maxFileSize: 10 * 1024 * 1024, // 10MB
  enableAuditLog: true,
};

/**
 * ANSI color codes for console output
 */
const COLORS = {
  reset: "\x1b[0m",
  info: "\x1b[36m", // cyan
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  dim: "\x1b[2m", // dim gray for timestamp
  bold: "\x1b[1m",
};

/**
 * Logger class for unified logging across the application
 */
export class Logger {
  private options: LoggerOptions;
  private auditLogPath: string;
  private appLogPath: string;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.auditLogPath = path.join(this.options.logDirectory!, "audit.log");
    this.appLogPath = path.join(this.options.logDirectory!, "app.log");
  }

  /**
   * Initialize logger by ensuring log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.options.logDirectory!, { recursive: true });
    } catch (error) {
      // If directory creation fails, disable file logging
      console.error("Failed to create log directory:", error);
      this.options.logToFile = false;
    }
  }

  /**
   * Format log entry as string
   */
  private formatLogEntry(entry: LogEntry): string {
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const stackStr = entry.stack ? `\n${entry.stack}` : "";
    return `[${entry.timestamp}] [${entry.level}] ${entry.message}${contextStr}${stackStr}`;
  }

  /**
   * Get color for log level
   */
  private getColorForLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.INFO:
        return COLORS.info;
      case LogLevel.WARN:
        return COLORS.warn;
      case LogLevel.ERROR:
        return COLORS.error;
      default:
        return COLORS.reset;
    }
  }

  /**
   * Write log to console with colors
   */
  private writeToConsole(entry: LogEntry): void {
    if (!this.options.logToConsole) return;

    const color = this.getColorForLevel(entry.level);
    const timestamp = `${COLORS.dim}[${entry.timestamp}]${COLORS.reset}`;
    const level = `${color}${COLORS.bold}[${entry.level}]${COLORS.reset}`;
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const stackStr = entry.stack ? `\n${entry.stack}` : "";

    console.log(`${timestamp} ${level} ${entry.message}${contextStr}${stackStr}`);
  }

  /**
   * Check if log file needs rotation
   */
  private async needsRotation(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size >= this.options.maxFileSize!;
    } catch {
      // File doesn't exist yet
      return false;
    }
  }

  /**
   * Rotate log file by renaming with timestamp
   */
  private async rotateLogFile(filePath: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rotatedPath = filePath.replace(".log", `.${timestamp}.log`);

    try {
      await fs.rename(filePath, rotatedPath);
    } catch (error) {
      // If rename fails, file might not exist, which is fine
      console.warn("Failed to rotate log file:", error);
    }
  }

  /**
   * Write log to file
   */
  private async writeToFile(entry: LogEntry, filePath: string): Promise<void> {
    if (!this.options.logToFile) return;

    try {
      await this.ensureLogDirectory();

      // Check if rotation is needed
      if (await this.needsRotation(filePath)) {
        await this.rotateLogFile(filePath);
      }

      const logLine = this.formatLogEntry(entry) + "\n";
      await fs.appendFile(filePath, logLine, "utf-8");
    } catch (error) {
      // If file logging fails, fall back to console only
      console.error("Failed to write to log file:", error);
    }
  }

  /**
   * Create log entry
   */
  private createLogEntry(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      stack: error?.stack,
    };
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, context);
    this.writeToConsole(entry);
    void this.writeToFile(entry, this.appLogPath);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, context);
    this.writeToConsole(entry);
    void this.writeToFile(entry, this.appLogPath);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, context, error);
    this.writeToConsole(entry);
    void this.writeToFile(entry, this.appLogPath);
  }

  /**
   * Audit logging for critical operations
   */
  audit(operation: string, details: Record<string, unknown>): void {
    if (!this.options.enableAuditLog) return;

    const entry = this.createLogEntry(LogLevel.INFO, `AUDIT: ${operation}`, details);
    void this.writeToFile(entry, this.auditLogPath);
    // Also print to console for visibility
    console.log(`${COLORS.dim}[${entry.timestamp}]${COLORS.reset} ${COLORS.bold}[AUDIT]${COLORS.reset} ${operation} ${JSON.stringify(details)}`);
  }

  /**
   * Log PRD creation
   */
  logPRDCreated(prdId: string, projectTitle: string, userId?: string): void {
    this.audit("PRD_CREATED", {
      prdId,
      projectTitle,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log PRD execution
   */
  logPRDExecuted(prdId: string, executionId: string, roleId: string, userId?: string): void {
    this.audit("PRD_EXECUTED", {
      prdId,
      executionId,
      roleId,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log role changes
   */
  logRoleChanged(action: "created" | "updated" | "deleted", roleId: string, roleName: string, userId?: string): void {
    this.audit(`ROLE_${action.toUpperCase()}`, {
      roleId,
      roleName,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log model configuration changes
   */
  logModelChanged(action: "created" | "updated" | "deleted", modelId: string, provider: string, userId?: string): void {
    this.audit(`MODEL_${action.toUpperCase()}`, {
      modelId,
      provider,
      userId,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * API error response format
 */
export interface APIErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Create consistent API error response
 */
export function createErrorResponse(
  error: string,
  message: string,
  details?: Record<string, unknown>,
  status: number = 500
): { response: APIErrorResponse; status: number } {
  return {
    response: {
      error,
      message,
      details,
      timestamp: new Date().toISOString(),
    },
    status,
  };
}

/**
 * Error types for consistent error handling
 */
export const ERROR_TYPES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
} as const;
