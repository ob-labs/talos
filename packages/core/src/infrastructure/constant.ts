/**
 * Path Constants - Centralized path configuration
 *
 * All file system paths used by Talos are defined here.
 * This provides a single source of truth for path configuration.
 *
 * DESIGN PRINCIPLES:
 * - All paths are defined as constants, not strings scattered across files
 * - Paths are constructed using path.join() for cross-platform compatibility
 * - Paths are organized by scope (global vs project)
 */

import { homedir } from "os";
import * as path from "path";

// ============================================================================
// GLOBAL CONFIG PATHS (User-level: ~/.talos/)
// ============================================================================

/**
 * Talos main directory (~/.talos)
 * All user-level configuration and state is stored here
 */
export const TALOS_DIR = path.join(homedir(), ".talos");

/**
 * Workspaces configuration file (~/.talos/workspaces.json)
 * Contains workspace metadata (name, path, branch, etc.)
 */
export const WORKSPACES_FILE = path.join(TALOS_DIR, "workspaces.json");

/**
 * UI process state file (~/.talos/ui-state.json)
 * Stores UI server process state
 */
export const UI_STATE_FILE = path.join(TALOS_DIR, "ui-state.json");

/**
 * Unix socket file path (~/.talos/talos.sock)
 * Socket file for daemon communication
 */
export const SOCKET_FILE = path.join(TALOS_DIR, "talos.sock");

/**
 * Daemon log file (~/.talos/talos.log)
 * Main daemon process log
 */
export const DAEMON_LOG_FILE = path.join(TALOS_DIR, "talos.log");

/**
 * Sessions directory (~/.talos/sessions/)
 * Stores session state files
 */
export const SESSIONS_DIR = path.join(TALOS_DIR, "sessions");

// ============================================================================
// PROJECT-LEVEL CONFIG PATHS (Repository-level: .talos/)
// ============================================================================

/**
 * Talos project directory (.talos/)
 * All project-level configuration and state is stored here
 */
export const PROJECT_TALOS_DIR = ".talos";

/**
 * Project configuration file (.talos/config.json)
 * Contains task metadata for this project
 */
export const PROJECT_CONFIG_FILE = path.join(PROJECT_TALOS_DIR, "config.json");

/**
 * Logs directory (.talos/logs/)
 * Task execution logs are stored here
 */
export const LOGS_DIR = path.join(PROJECT_TALOS_DIR, "logs");

/**
 * PRD directory (ralph/)
 * Ralph PRD files are stored here
 */
export const PRD_DIR = "ralph";

/**
 * Git worktrees directory (.git/worktrees/)
 * Git worktree metadata
 */
export const GIT_WORKTREES_DIR = ".git/worktrees";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the log file path for a specific task
 *
 * @param repoRoot - Repository root directory
 * @param taskId - Task identifier
 * @returns Log file path
 *
 * @example
 * ```typescript
 * const logPath = getTaskLogPath('/path/to/repo', 'task-123');
 * // Returns: '/path/to/repo/.talos/logs/task-123.log'
 * ```
 */
export function getTaskLogPath(repoRoot: string, taskId: string): string {
  return path.join(repoRoot, LOGS_DIR, `${taskId}.log`);
}

/**
 * Get the exit JSON file path for a specific task
 *
 * @param repoRoot - Repository root directory
 * @param taskId - Task identifier
 * @returns Exit JSON file path
 *
 * @example
 * ```typescript
 * const exitPath = getTaskExitPath('/path/to/repo', 'task-123');
 * // Returns: '/path/to/repo/.talos/logs/task-123.exit.json'
 * ```
 */
export function getTaskExitPath(repoRoot: string, taskId: string): string {
  return path.join(repoRoot, LOGS_DIR, `${taskId}.exit.json`);
}

/**
 * Get the worktree path for a workspace and worktree ID
 *
 * @param workspacePath - Workspace root directory
 * @param worktreeId - Worktree identifier
 * @returns Worktree path
 *
 * @example
 * ```typescript
 * const worktreePath = getWorktreePath('/path/to/repo', 'wt-123');
 * // Returns: '/path/to/repo/worktrees/wt-123'
 * ```
 */
export function getWorktreePath(workspacePath: string, worktreeId: string): string {
  return path.join(workspacePath, "worktrees", worktreeId);
}

/**
 * Get the PRD directory path for a specific PRD
 *
 * @param repoRoot - Repository root directory
 * @param prdName - PRD name/identifier
 * @returns PRD directory path
 *
 * @example
 * ```typescript
 * const prdPath = getPRDPath('/path/to/repo', 'my-feature');
 * // Returns: '/path/to/repo/ralph/my-feature'
 * ```
 */
export function getPRDPath(repoRoot: string, prdName: string): string {
  return path.join(repoRoot, PRD_DIR, prdName);
}
