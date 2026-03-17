/**
 * Web-specific terminal utilities
 *
 * This module exports terminal utilities that are safe to use in client-side code.
 *
 * Server-side utilities (WebSocket handlers, session managers) are NOT exported here
 * because they use Node.js-only modules (node-pty, ws).
 * They should be imported directly from their files in server-side code (e.g., server.ts).
 */

// Re-export WebSocket path constant from constants (safe for client-side use)
export { TERMINAL_WS_PATH } from './constants';

// Web-specific: Terminal instance cache for xterm.js
export { terminalCache } from './terminal-cache';

// Note: CommandHistoryManager is mocked in client-side builds via Next.js config
// The actual implementation requires Node.js modules (fs, path) for file-based storage
// Re-export from @talos/terminal for type consistency
// Note: commandHistory instance is NOT exported because it triggers Node.js module loading
// Use the mock from lib/mocks/command-history-mock.ts instead
export {
  TerminalCommandHandler,
  commandHandler,
  CommandHistoryManager,
} from '@talos/terminal';
export type {
  CommandResult,
  CommandContext,
  CommandHandler,
  Command,
  CommandHistoryEntry,
  CommandHistoryData,
} from '@talos/terminal';
