/**
 * @talos/executor - Anti-corruption layer for tool executors
 *
 * This package provides executor implementations for various AI tools
 * (Claude Code, Cursor, etc.) with a unified interface.
 */

// Re-export types from @talos/types
export type {
  IToolExecutor,
  IToolExecutorFactory,
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolConfig,
} from '@talos/types';

// Export executor implementations
export { ClaudeExecutor } from './executors/ClaudeExecutor';
export { CursorExecutor } from './executors/CursorExecutor';

// Export factory
export { ToolExecutorFactory } from './ToolExecutorFactory';

// Export Ralph executor and utilities
export {
  RalphExecutor,
  RalphLogger,
  RalphExecutorOptions,
  RalphResult,
  runRalph,
} from './RalphExecutor';

export {
  StreamJSONParser,
  StreamJSONParserOptions,
  parseAndFormat,
} from './StreamJSONParser';
