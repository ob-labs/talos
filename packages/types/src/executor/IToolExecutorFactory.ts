/**
 * Application Layer: Tool Executor Factory Interface
 *
 * Defines the contract for creating and managing tool executors.
 * Implements the Factory pattern for tool instantiation.
 */

import type { IToolExecutor } from './IToolExecutor';

/**
 * Tool Executor Factory Interface
 *
 * Provides methods for creating and managing tool executor instances.
 * Implementations act as a registry for available tools.
 */
export interface IToolExecutorFactory {
  /**
   * Create a tool executor instance
   *
   * @param toolName - Name of the tool to create (e.g., "claude", "cursor")
   * @returns Tool executor instance
   *
   * @throws {Error} If the tool is not registered or unavailable
   *
   * Implementation notes:
   * - Must return a new instance on each call
   * - Should validate tool name is registered
   * - Should not throw for unavailable tools (use isAvailable to check)
   */
  create(toolName: string): IToolExecutor;

  /**
   * Register a new tool executor type
   *
   * @param toolName - Name to register the tool under
   * @param executorFactory - Factory function that creates executor instances
   * @returns void
   *
   * Implementation notes:
   * - Must allow custom tool registration
   * - Should throw if tool name already exists (or use merge strategy)
   * - Must validate tool name is not empty
   */
  register(
    toolName: string,
    executorFactory: () => IToolExecutor
  ): void;

  /**
   * List all registered tool executors
   *
   * @returns Array of tool names that can be created
   *
   * Implementation notes:
   * - Must return all registered tool names
   * - Should not include unavailable tools in the list
   */
  listAvailable(): string[];
}
