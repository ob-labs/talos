/**
 * Git 操作模块主入口
 * Git Operations Module Main Entry
 *
 * 提供统一的 Git 操作接口，包括仓库、Worktree、提交、分支和远程操作
 * Provides unified Git operations interface including repository, worktree,
 * commit, branch, and remote operations.
 *
 * @example
 * ```typescript
 * import { createGit, GitRepository, GitBranch } from '@talos/git';
 *
 * // 使用统一的 Git 实例
 * const git = createGit('/path/to/repo');
 * const status = await git.repo.status();
 *
 * // 或单独使用某个模块
 * const repo = new GitRepository('/path/to/repo');
 * const branches = await repo.branch.list();
 * ```
 */

// 导出类型
export type {
  GitResult,
  RepositoryStatus,
  CommitInfo,
  WorktreeInfo,
  FileChange,
  DiffInfo,
  BranchInfo,
  RemoteInfo,
  RemoteBranchInfo,
  PullPushResult,
  StashInfo,
} from './types';
export type { WorktreeMetadata } from './worktree-scanner';

// 导出模块类
export { GitRepository, createRepository } from './repository';
export { GitWorktree, createWorktree } from './worktree';
export { GitCommit, createCommit } from './commit';
export { GitBranch, createBranch } from './branch';
export { GitRemote, createRemote } from './remote';
export { WorktreeScanner, scanWorkspaceWorktrees } from './worktree-scanner';
export { GitService } from './git-service';
export type { WorktreeListItem } from './git-service';

// 统一的 Git 类
import { GitRepository } from './repository';
import { GitWorktree } from './worktree';
import { GitCommit } from './commit';
import { GitBranch } from './branch';
import { GitRemote } from './remote';

/**
 * 统一的 Git 操作类
 * Unified Git operations class
 *
 * 提供所有 Git 操作的便捷访问
 * Provides convenient access to all Git operations
 */
export class Git {
  /** 仓库操作 */
  repo: GitRepository;
  /** Worktree 操作 */
  worktree: GitWorktree;
  /** 提交操作 */
  commit: GitCommit;
  /** 分支操作 */
  branch: GitBranch;
  /** 远程操作 */
  remote: GitRemote;

  constructor(basePath?: string) {
    this.repo = new GitRepository(basePath);
    this.worktree = new GitWorktree(basePath);
    this.commit = new GitCommit(basePath);
    this.branch = new GitBranch(basePath);
    this.remote = new GitRemote(basePath);
  }
}

/**
 * 创建统一的 Git 操作实例
 * Create unified Git operations instance
 *
 * @param basePath - 仓库基础路径 (Repository base path)
 * @returns Git 实例
 *
 * @example
 * ```typescript
 * const git = createGit('/path/to/repo');
 *
 * // 获取仓库状态
 * const status = await git.repo.status();
 *
 * // 列出分支
 * const branches = await git.branch.list();
 *
 * // 创建 worktree
 * await git.worktree.create('/path/to/worktree', 'feature-branch');
 *
 * // 提交变更
 * await git.commit.addAll();
 * await git.commit.commit('Initial commit');
 * ```
 */
export function createGit(basePath?: string): Git {
  return new Git(basePath);
}

// 默认导出
export default Git;
