/**
 * IWorktree - Git Worktree Entity Interface
 *
 * Represents a Git worktree (a separate working directory linked to a Git repository).
 *
 * @example
 * ```typescript
 * const worktree: IWorktree = {
 *   path: '/path/to/repo/worktrees/feature',
 *   branch: 'feature-branch',
 * };
 * ```
 */

export interface IWorktree {
  /**
   * Worktree file system path
   */
  path: string;

  /**
   * Associated Git branch name
   */
  branch: string;
}
