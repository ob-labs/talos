/**
 * IWorkspace - Workspace Entity Interface
 *
 * Rich domain model for Workspace (Git repository level).
 * A workspace represents a complete Git repository that can contain multiple worktrees.
 *
 * RELATIONSHIP:
 * - Workspace contains Worktrees (Git branches)
 * - Workspace level configuration and metadata
 *
 * @example
 * ```typescript
 * const workspace: IWorkspace = {
 *   id: 'ws-123',
 *   name: 'talos-project',
 *   path: '/Users/dev/projects/talos',
 *   branch: 'main',
 *   worktrees: ['wt-1', 'wt-2'],
 *   terminals: [],
 *   expanded: false,
 *   addWorktree(worktreeId) {
 *     if (!this.worktrees.includes(worktreeId)) {
 *       this.worktrees.push(worktreeId);
 *     }
 *   }
 * };
 * ```
 */

// Import TerminalSession from existing types to avoid conflict
import type { TerminalSession } from "../index";

export interface IWorkspace {
  /**
   * Unique workspace identifier
   */
  id: string;

  /**
   * Workspace name (typically repository name)
   */
  name: string;

  /**
   * Git branch for this workspace
   */
  branch: string;

  /**
   * Absolute file system path to workspace
   */
  path: string;

  /**
   * Array of worktree IDs contained in this workspace
   */
  worktrees: string[];

  /**
   * Terminal session history for this workspace
   */
  terminals: TerminalSession[];

  /**
   * UI state: whether workspace is expanded in UI
   */
  expanded: boolean;

  // ============================================
  // Domain Methods
  // ============================================

  /**
   * Add a worktree to this workspace
   * @param worktreeId - Worktree ID to add
   */
  addWorktree(worktreeId: string): void;

  /**
   * Remove a worktree from this workspace
   * @param worktreeId - Worktree ID to remove
   */
  removeWorktree(worktreeId: string): void;

  /**
   * Check if workspace contains a specific worktree
   * @param worktreeId - Worktree ID to check
   */
  hasWorktree(worktreeId: string): boolean;

  /**
   * Add terminal session to history
   * @param terminal - Terminal session to add
   */
  addTerminal(terminal: TerminalSession): void;

  /**
   * Get all terminal sessions
   */
  getTerminals(): TerminalSession[];

  /**
   * Clear terminal session history
   */
  clearTerminals(): void;

  /**
   * Toggle expanded state
   */
  toggleExpanded(): void;
}
