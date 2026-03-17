/**
 * Application Layer: Tool Execution Request
 *
 * Defines the input parameters for executing a tool (Claude Code, Cursor, etc.).
 * Tools are external AI coding assistants that can execute autonomous tasks.
 */

/**
 * Tool execution request
 *
 * Encapsulates all parameters needed to execute a tool for a given task.
 */
export interface ToolExecutionRequest {
  /**
   * Working directory where the tool should execute
   * Must be an absolute path to a valid directory
   */
  workingDir: string;

  /**
   * The prompt/task description for the tool to execute
   * Should be a clear, actionable instruction
   */
  prompt: string;

  /**
   * Enable debug mode for verbose logging
   * Optional - defaults to false
   */
  debug?: boolean;

  /**
   * Model identifier to use for execution
   * Optional - tool will use default if not specified
   * Examples: "claude-opus-4-6", "claude-sonnet-4-6"
   */
  model?: string;

  /**
   * Execution timeout in milliseconds
   * Optional - tool will use default timeout if not specified
   * Set to 0 for no timeout (not recommended for production)
   */
  timeout?: number;
}
