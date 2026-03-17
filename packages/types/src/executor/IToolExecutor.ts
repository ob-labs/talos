/**
 * Application Layer: Tool Executor Interface
 *
 * Defines the contract for executing external AI coding tools.
 * This is part of the anti-corruption layer, isolating the domain from
 * external tool-specific implementations.
 *
 * Implementations:
 * - ClaudeExecutor: Executes Claude Code via CLI
 * - CursorExecutor: Executes Cursor IDE with idle timeout
 */

import type { ToolExecutionRequest } from './ToolExecutionRequest';
import type { ToolExecutionResult } from './ToolExecutionResult';
import type { ToolConfig } from './ToolConfig';

/**
 * Tool Executor Interface
 *
 * Provides abstraction over external AI coding tools.
 * Implementations must handle tool lifecycle, execution, and availability checks.
 */
export interface IToolExecutor {
  /**
   * Unique tool name/identifier
   * Read-only after construction
   */
  readonly name: string;

  /**
   * Execute a task using the tool
   *
   * @param request - Tool execution request with prompt and options
   * @returns Execution result with success status, output, and error info
   *
   * @throws {Error} If the tool is not available or request is invalid
   *
   * Implementation notes:
   * - Must validate the tool is available before execution
   * - Must handle timeout cancellation if specified
   * - Should capture both stdout and stderr
   * - Must handle process crashes and external termination
   */
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>;

  /**
   * Check if the tool is available for execution
   *
   * @returns true if the tool can be executed, false otherwise
   *
   * Implementation notes:
   * - Should check if executable exists and is accessible
   * - Should verify tool version or API connectivity if applicable
   * - Must not throw exceptions, return false instead
   * - Async to support external checks (network, API, etc.)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Stop a running tool execution
   *
   * @returns void
   *
   * Implementation notes:
   * - Must gracefully terminate the running process
   * - Should attempt SIGTERM first, then SIGKILL if needed
   * - Must clean up any resources (temp files, connections, etc.)
   * - Should be idempotent (safe to call multiple times)
   * - No-op if no execution is running
   */
  stop(): Promise<void>;

  /**
   * Get the tool's configuration
   *
   * @returns Tool configuration metadata
   *
   * Implementation notes:
   * - Must return a valid configuration
   * - Should include all capabilities and constraints
   */
  getConfig(): ToolConfig;
}
