/**
 * Application Layer: Tool Configuration
 *
 * Defines the configuration for a tool executor (Claude Code, Cursor, etc.).
 */

/**
 * Tool configuration
 *
 * Encapsulates the configuration metadata for a tool executor,
 * including its capabilities and constraints.
 */
export interface ToolConfig {
  /**
   * Unique tool identifier/name
   * Examples: "claude", "cursor", "copilot"
   */
  name: string;

  /**
   * Path to the tool executable
   * Optional - if not specified, the tool should be available in PATH
   * Examples: "/usr/local/bin/claude", "C:\\Program Files\\Cursor\\cursor.exe"
   */
  executablePath?: string;

  /**
   * Whether the tool supports debug mode
   * Debug mode typically provides verbose logging and additional diagnostics
   */
  supportsDebugMode: boolean;

  /**
   * List of model identifiers supported by this tool
   * Examples: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"]
   * Empty array means the tool doesn't support model selection
   */
  supportedModels: string[];

  /**
   * Default timeout in milliseconds if not specified in request
   * Optional - tool may use its own default
   */
  defaultTimeout?: number;

  /**
   * Additional tool-specific configuration
   * Optional - can include API keys, endpoints, etc.
   */
  options?: Record<string, unknown>;
}
