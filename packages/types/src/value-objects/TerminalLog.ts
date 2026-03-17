/**
 * TerminalLog - Terminal Log Entry Value Object
 *
 * Immutable value object representing a single terminal log entry.
 * Part of the domain layer value objects.
 *
 * Log types indicate the severity and purpose of each message:
 * - "system": System-level messages (process lifecycle, etc.)
 * - "info": General informational messages
 * - "success": Success indicators
 * - "error": Error messages
 * - "warning": Warning messages
 * - "command": Command executions
 *
 * @example
 * ```typescript
 * const log: TerminalLog = {
 *   type: "info",
 *   message: "Task started successfully",
 *   timestamp: Date.now()
 * };
 * ```
 */
export interface TerminalLog {
  type: "system" | "info" | "success" | "error" | "warning" | "command";
  message: string;
  timestamp: number;
}
