/**
 * Application Layer: Tool Executor Factory
 *
 * Factory implementation for creating and managing tool executor instances.
 * Implements the Factory pattern to centralize tool instantiation logic.
 *
 * Built-in tools:
 * - 'claude': ClaudeExecutor for Claude Code CLI
 * - 'cursor': CursorExecutor for Cursor IDE cursor-agent CLI
 */

import type { IToolExecutorFactory } from '@talos/types';
import type { IToolExecutor } from '@talos/types';

import { ClaudeExecutor } from './executors/ClaudeExecutor';
import { CursorExecutor } from './executors/CursorExecutor';

/**
 * Tool Executor Factory
 *
 * Manages registration and creation of tool executor instances.
 * Acts as a registry for available tools and provides a clean interface
 * for instantiating executors.
 */
export class ToolExecutorFactory implements IToolExecutorFactory {
  private creators: Map<string, () => IToolExecutor>;

  /**
   * Create a new ToolExecutorFactory
   *
   * Initializes the factory with built-in tool executors.
   * Custom tools can be registered using the register() method.
   */
  constructor() {
    this.creators = new Map();

    // Register built-in tools
    this.register('claude', () => new ClaudeExecutor());
    this.register('cursor', () => new CursorExecutor());
  }

  /**
   * Create a tool executor instance
   *
   * @param toolName - Name of the tool to create (e.g., "claude", "cursor")
   * @returns Tool executor instance
   * @throws {Error} If the tool is not registered
   */
  create(toolName: string): IToolExecutor {
    const factory = this.creators.get(toolName);

    if (!factory) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    return factory();
  }

  /**
   * Register a new tool executor type
   *
   * Allows custom tools to be registered. Can be used to override
   * existing tool registrations.
   *
   * @param toolName - Name to register the tool under
   * @param executorFactory - Factory function that creates executor instances
   */
  register(toolName: string, executorFactory: () => IToolExecutor): void {
    this.creators.set(toolName, executorFactory);
  }

  /**
   * List all registered tool executors
   *
   * @returns Array of tool names that can be created
   */
  listAvailable(): string[] {
    return Array.from(this.creators.keys());
  }
}
