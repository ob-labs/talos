/**
 * IWorktreeService - Worktree Service Interface
 *
 * Domain service for Git worktree management.
 * Handles creation, deletion, and management of Git worktrees.
 *
 * RESPONSIBILITIES:
 * - Worktree lifecycle management (create, delete, list)
 * - Worktree synchronization
 * - Worktree status tracking
 * - Branch management within worktrees
 *
 * @example
 * ```typescript
 * // Create a new worktree
 * const worktree = await worktreeService.create({
 *   workspacePath: '/path/to/repo',
 *   branch: 'feature/new-feature',
 *   path: '/path/to/repo-worktrees/new-feature'
 * });
 *
 * // List all worktrees
 * const worktrees = await worktreeService.list('/path/to/repo');
 *
 * // Delete a worktree
 * await worktreeService.delete(worktree.id);
 * ```
 */
export interface IWorktreeService {
  /**
   * Create a new Git worktree
   *
   * @param options - Worktree creation options
   * @returns Created worktree information
   * @throws Error if worktree creation fails
   */
  create(options: CreateWorktreeOptions): Promise<WorktreeInfo>;

  /**
   * Delete a Git worktree
   *
   * @param worktreeId - Worktree identifier to delete
   * @param options - Deletion options
   * @throws Error if worktree deletion fails
   */
  delete(worktreeId: string, options?: DeleteWorktreeOptions): Promise<void>;

  /**
   * List all worktrees for a workspace
   *
   * @param workspacePath - Path to workspace/repository
   * @returns Array of worktree information
   */
  list(workspacePath: string): Promise<WorktreeInfo[]>;

  /**
   * Get worktree by ID
   *
   * @param worktreeId - Worktree identifier
   * @returns Worktree information or null if not found
   */
  get(worktreeId: string): Promise<WorktreeInfo | null>;

  /**
   * Get worktree by path
   *
   * @param path - Worktree path
   * @returns Worktree information or null if not found
   */
  getByPath(path: string): Promise<WorktreeInfo | null>;

  /**
   * Check if worktree exists
   *
   * @param worktreeId - Worktree identifier
   * @returns true if worktree exists, false otherwise
   */
  exists(worktreeId: string): Promise<boolean>;

  /**
   * Prune stale worktrees
   * Removes worktrees that are no longer valid
   *
   * @param workspacePath - Path to workspace/repository
   * @returns Number of worktrees pruned
   */
  prune(workspacePath: string): Promise<number>;

  /**
   * Sync worktree with remote branch
   *
   * @param worktreeId - Worktree identifier
   * @param options - Sync options
   * @throws Error if sync fails
   */
  sync(worktreeId: string, options?: SyncOptions): Promise<void>;

  /**
   * Get worktree status
   *
   * @param worktreeId - Worktree identifier
   * @returns Worktree status information
   */
  getStatus(worktreeId: string): Promise<WorktreeStatusInfo>;
}

/**
 * Worktree creation options
 */
export interface CreateWorktreeOptions {
  /**
   * Path to workspace/repository
   */
  workspacePath: string;

  /**
   * Branch name for worktree
   */
  branch: string;

  /**
   * Path where worktree should be created
   */
  path: string;

  /**
   * Create branch from specific commit or branch
   */
  from?: string;

  /**
   * Create new branch (vs. checking out existing)
   */
  createNewBranch?: boolean;

  /**
   * Track remote branch
   */
  track?: string;
}

/**
 * Worktree deletion options
 */
export interface DeleteWorktreeOptions {
  /**
   * Force deletion even if there are uncommitted changes
   */
  force?: boolean;

  /**
   * Also delete the branch if it's not merged
   */
  deleteBranch?: boolean;
}

/**
 * Worktree sync options
 */
export interface SyncOptions {
  /**
   * Pull latest changes from remote
   */
  pull?: boolean;

  /**
   * Push local changes to remote
   */
  push?: boolean;

  /**
   * Remote name
   */
  remote?: string;
}

/**
 * Worktree information
 */
export interface WorktreeInfo {
  /**
   * Unique worktree identifier
   */
  id: string;

  /**
   * Worktree branch name
   */
  branch: string;

  /**
   * Absolute path to worktree
   */
  path: string;

  /**
   * Path to parent workspace/repository
   */
  workspacePath: string;

  /**
   * Worktree status
   */
  status: "ok" | "detached" | "error";

  /**
   * Commit SHA currently checked out
   */
  commit?: string;

  /**
   * Whether worktree has uncommitted changes
   */
  hasUncommittedChanges?: boolean;

  /**
   * Creation timestamp
   */
  createdAt?: number;
}

/**
 * Worktree status information (renamed to avoid conflict with existing WorktreeStatus)
 */
export interface WorktreeStatusInfo {
  /**
   * Worktree identifier
   */
  worktreeId: string;

  /**
   * Current status
   */
  status: "ok" | "detached" | "error";

  /**
   * Branch name
   */
  branch: string;

  /**
   * Commit SHA
   */
  commit: string;

  /**
   * Uncommitted changes count
   */
  uncommittedChanges: number;

  /**
   * Last updated timestamp
   */
  lastUpdated: number;
}
