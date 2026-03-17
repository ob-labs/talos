/**
 * Application Layer: Tool Execution Result
 *
 * Defines the output from executing a tool (Claude Code, Cursor, etc.).
 */

/**
 * Tool execution result
 *
 * Encapsulates the outcome of a tool execution, including success status,
 * output content, error information, and exit code.
 */
export interface ToolExecutionResult {
  /**
   * Whether the tool execution completed successfully
   * Success means the tool executed without errors (not necessarily that the task succeeded)
   */
  success: boolean;

  /**
   * The output from the tool execution
   * May contain stdout, logs, or other output depending on the tool
   */
  output: string;

  /**
   * Error message if the execution failed
   * Present only when success is false
   */
  error?: string;

  /**
   * Process exit code
   * 0 typically indicates success, non-zero indicates failure
   * May be undefined if the tool was terminated externally
   */
  exitCode?: number;

  /**
   * Additional metadata about the execution
   * Optional - can include timing, resource usage, etc.
   */
  metadata?: Record<string, unknown>;
}
