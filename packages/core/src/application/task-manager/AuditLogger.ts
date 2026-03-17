/**
 * Audit Logger
 *
 * Records audit logs for security and compliance.
 * Tracks all significant actions and state changes for tasks.
 *
 * RESPONSIBILITIES:
 * - Record audit events with structured metadata
 * - Maintain audit log file in .talos/audit.log
 * - Query audit logs with filtering support
 * - Retrieve recent audit logs
 *
 * DEPENDENCIES:
 * - taskId: string - Task identifier
 * - workingDir: string - Working directory for audit log file
 * - logger: ILogger - Logging
 *
 * AUDIT EVENT TYPES:
 * - task_created: Task created
 * - task_started: Task started
 * - task_stopped: Task stopped
 * - task_resumed: Task resumed
 * - task_completed: Task completed
 * - task_failed: Task failed
 * - story_started: Story started
 * - story_completed: Story completed
 * - tool_executed: Tool executed
 */

import * as fs from "fs/promises";
import * as path from "path";
import type { IAuditLogger, ILogger } from "@talos/types";

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  timestamp: Date;
  action: string;
  details: {
    taskId?: string;
    processId?: string;
    [key: string]: unknown;
  };
  userId?: string;
}

/**
 * Audit Logger Options
 */
export interface AuditLoggerOptions {
  taskId: string;
  workingDir: string;
  logger: ILogger;
}

/**
 * Audit Event Types
 */
export const AuditEventTypes = {
  TASK_CREATED: "task_created",
  TASK_STARTED: "task_started",
  TASK_STOPPED: "task_stopped",
  TASK_RESUMED: "task_resumed",
  TASK_COMPLETED: "task_completed",
  TASK_FAILED: "task_failed",
  STORY_STARTED: "story_started",
  STORY_COMPLETED: "story_completed",
  TOOL_EXECUTED: "tool_executed",
} as const;

/**
 * Audit Logger Class
 *
 * Implements IAuditLogger interface for recording audit logs.
 * Audit logs are stored in .talos/audit.log with format:
 * [timestamp] [AUDIT] {action} {metadata}
 */
export class AuditLogger implements IAuditLogger {
  private taskId: string;
  private workingDir: string;
  private logger: ILogger;
  private auditLogPath: string;

  constructor(options: AuditLoggerOptions) {
    this.taskId = options.taskId;
    this.workingDir = options.workingDir;
    this.logger = options.logger;
    this.auditLogPath = path.join(this.workingDir, ".talos", "audit.log");
  }

  /**
   * Log an action
   *
   * Records audit log with format: [timestamp] [AUDIT] {action} {metadata}
   * Writes to .talos/audit.log
   *
   * @param action - Action name (e.g., "task_started", "task_stopped", "config_modified")
   * @param details - Action details including context information
   * @param userId - Optional user identifier
   */
  async logAction(
    action: string,
    details: {
      taskId?: string;
      processId?: string;
      [key: string]: unknown;
    },
    userId?: string
  ): Promise<void> {
    try {
      // Build details with taskId
      const detailsWithTaskId = {
        ...details,
        taskId: details.taskId || this.taskId,
      };

      const entry: AuditLogEntry = {
        timestamp: new Date(),
        action,
        details: detailsWithTaskId,
        userId,
      };

      // Format: [timestamp] [AUDIT] {action} {metadata}
      const logLine = `[${entry.timestamp.toISOString()}] [AUDIT] ${action} ${JSON.stringify(entry.details)}${userId ? ` [user: ${userId}]` : ""}\n`;

      // Ensure directory exists
      await fs.mkdir(path.dirname(this.auditLogPath), { recursive: true });

      // Append to audit log file
      await fs.appendFile(this.auditLogPath, logLine, "utf-8");

      // Also log via logger
      this.logger.audit(`Audit: ${action}`, detailsWithTaskId);
    } catch (error) {
      // Log error but don't throw - audit logging failures shouldn't break operations
      this.logger.error(`Failed to write audit log: ${error}`);
    }
  }

  /**
   * Get audit logs with optional filtering
   *
   * @param filter - Optional filter criteria
   * @returns Array of audit log entries
   */
  async getAuditLogs(filter?: {
    action?: string;
    taskId?: string;
    processId?: string;
    userId?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    try {
      // Read audit log file
      const content = await fs.readFile(this.auditLogPath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);

      // Parse log entries
      let entries = this.parseAuditLogLines(lines);

      // Apply filters
      if (filter) {
        if (filter.action) {
          entries = entries.filter((entry) => entry.action === filter.action);
        }
        if (filter.taskId) {
          entries = entries.filter((entry) => entry.details.taskId === filter.taskId);
        }
        if (filter.processId) {
          entries = entries.filter((entry) => entry.details.processId === filter.processId);
        }
        if (filter.userId) {
          entries = entries.filter((entry) => entry.userId === filter.userId);
        }
        if (filter.startTime) {
          entries = entries.filter((entry) => entry.timestamp >= filter.startTime!);
        }
        if (filter.endTime) {
          entries = entries.filter((entry) => entry.timestamp < filter.endTime!);
        }
        if (filter.limit) {
          entries = entries.slice(0, filter.limit);
        }
      }

      return entries;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // File doesn't exist yet
        return [];
      }
      throw error;
    }
  }

  /**
   * Get most recent N audit logs
   *
   * @param count - Number of recent logs to return (default: 10)
   * @returns Array of most recent audit log entries
   */
  async getRecentLogs(count = 10): Promise<AuditLogEntry[]> {
    const allLogs = await this.getAuditLogs();
    return allLogs.slice(-count);
  }

  /**
   * Parse audit log lines into structured entries
   *
   * @param lines - Array of log lines
   * @returns Array of parsed audit log entries
   */
  private parseAuditLogLines(lines: string[]): AuditLogEntry[] {
    return lines.map((line) => {
      try {
        // Format: [timestamp] [AUDIT] {action} {metadata} [user: {userId}]?
        const match = line.match(/^\[([^\]]+)\] \[AUDIT\] (\S+) (.+?)(?: \[user: ([^\]]+)\])?$/);
        if (!match) {
          this.logger.warn(`Invalid audit log line: ${line}`);
          return null;
        }

        const [, timestampStr, action, metadataStr, userId] = match;
        const timestamp = new Date(timestampStr);
        const details = JSON.parse(metadataStr);

        return {
          timestamp,
          action,
          details,
          userId,
        } as AuditLogEntry;
      } catch (error) {
        this.logger.warn(`Failed to parse audit log line: ${line}`, { error });
        return null;
      }
    }).filter((entry): entry is AuditLogEntry => entry !== null);
  }
}
