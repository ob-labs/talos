/**
 * Git Worktree 操作模块
 * Git Worktree Operations Module
 *
 * 提供 Worktree 级别的操作：创建、删除、列出、清理等
 * Provides worktree-level operations: create, remove, list, prune, etc.
 *
 * 术语映射 / Terminology Mapping:
 * - workspace: 仓库（Git repository）
 * - feat: worktree（Git worktree，功能分支的独立工作目录）
 * - task: user story（用户故事，PRD 中的任务单元）
 *
 * 此模块封装底层 Git worktree 命令，用于实现 Feat 功能
 * This module wraps low-level Git worktree commands to implement Feat functionality
 */

import { simpleGit, SimpleGit } from 'simple-git';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { GitResult, WorktreeInfo } from './//types';

const execAsync = promisify(exec);

/**
 * Worktree 操作类
 * Worktree operations class
 *
 * 封装 Git worktree 命令，为 Feat 提供底层支持
 * Wraps Git worktree commands to provide low-level support for Feat
 */
export class GitWorktree {
  private git: SimpleGit;
  private basePath: string;

  constructor(basePath?: string) {
    this.git = simpleGit(basePath);
    this.basePath = basePath || process.cwd();
  }

  /**
   * 列出所有 worktree
   * List all worktrees
   *
   * 用于扫描 Workspace 下的所有 Feat
   * Used to scan all Feats under a Workspace
   */
  async list(): Promise<GitResult<WorktreeInfo[]>> {
    try {
      const worktrees = await this.git.raw(['worktree', 'list', '--porcelain']);

      // Parse porcelain output
      const lines = worktrees.split('\n');
      const result: WorktreeInfo[] = [];
      let current: Partial<WorktreeInfo> = {};

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          if (current.path) {
            result.push(current as WorktreeInfo);
          }
          current = { path: line.substring(9).trim() };
        } else if (line.startsWith('HEAD ')) {
          current.commit = line.substring(5).trim();
        } else if (line.startsWith('branch ')) {
          const branchRef = line.substring(7).trim();
          current.branch = branchRef.replace('refs/heads/', '');
        } else if (line === 'bare') {
          current.isBare = true;
        } else if (line === 'detached') {
          current.isDetached = true;
        }
      }

      // Push the last one
      if (current.path) {
        result.push(current as WorktreeInfo);
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error listing worktrees',
      };
    }
  }

  /**
   * 创建 worktree
   * Create a worktree
   *
   * 用于创建新的 Feat
   * Used to create a new Feat
   *
   * Note: Uses execAsync instead of simple-git to avoid stderr issues.
   * Git outputs progress messages to stderr (e.g., "准备工作区"),
   * but execAsync only fails on non-zero exit codes.
   */
  async create(
    path: string,
    branch?: string,
    options?: { force?: boolean; detach?: boolean }
  ): Promise<GitResult<string>> {
    try {
      // Build command similar to git-service.ts in main directory
      // Use basePath from constructor
      let command = `cd "${this.basePath}" && git worktree add "${path}"`;

      if (options?.force) command += ' --force';
      if (options?.detach) command += ' --detach';
      if (branch) command += ` -b "${branch}"`;

      await execAsync(command);
      return { success: true, data: '' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating worktree',
      };
    }
  }

  /**
   * 从已有分支创建 worktree
   * Create worktree from existing branch
   *
   * 用于从现有分支创建 Feat
   * Used to create a Feat from an existing branch
   */
  async createFromBranch(
    path: string,
    branch: string,
    options?: { force?: boolean }
  ): Promise<GitResult<string>> {
    try {
      const args: string[] = ['worktree', 'add'];

      if (options?.force) args.push('--force');

      args.push(path, branch);

      const result = await this.git.raw(args);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating worktree from branch',
      };
    }
  }

  /**
   * 删除 worktree
   * Remove a worktree
   *
   * 用于删除 Feat
   * Used to remove a Feat
   */
  async remove(path: string, force = false): Promise<GitResult<string>> {
    try {
      const args: string[] = ['worktree', 'remove'];

      if (force) args.push('--force');

      args.push(path);

      const result = await this.git.raw(args);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error removing worktree',
      };
    }
  }

  /**
   * 清理无效的 worktree
   * Prune invalid worktrees
   *
   * 用于清理已删除的 Feat 残留
   * Used to clean up remnants of deleted Feats
   */
  async prune(dryRun = false): Promise<GitResult<string[]>> {
    try {
      const args: string[] = ['worktree', 'prune'];

      if (dryRun) args.push('--dry-run');
      else args.push('--verbose');

      const result = await this.git.raw(args);

      // Parse pruned worktrees from verbose output
      const pruned: string[] = [];
      if (!dryRun && result) {
        const lines = result.split('\n');
        for (const line of lines) {
          const match = line.match(/Removing worktrees\/(.+)/);
          if (match) {
            pruned.push(match[1]);
          }
        }
      }

      return { success: true, data: pruned };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error pruning worktrees',
      };
    }
  }

  /**
   * 锁定 worktree
   * Lock a worktree
   *
   * 用于防止 Feat 被意外删除或移动
   * Used to prevent Feat from being accidentally deleted or moved
   */
  async lock(path: string, reason?: string): Promise<GitResult<void>> {
    try {
      const args: string[] = ['worktree', 'lock'];
      if (reason) args.push('--reason', reason);
      args.push(path);

      await this.git.raw(args);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error locking worktree',
      };
    }
  }

  /**
   * 解锁 worktree
   * Unlock a worktree
   *
   * 用于解锁 Feat 以允许删除或移动
   * Used to unlock a Feat to allow deletion or movement
   */
  async unlock(path: string): Promise<GitResult<void>> {
    try {
      await this.git.raw(['worktree', 'unlock', path]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error unlocking worktree',
      };
    }
  }

  /**
   * 移动 worktree
   * Move a worktree
   *
   * 用于移动 Feat 到新路径
   * Used to move a Feat to a new path
   */
  async move(oldPath: string, newPath: string, force = false): Promise<GitResult<void>> {
    try {
      const args: string[] = ['worktree', 'move'];
      if (force) args.push('--force');
      args.push(oldPath, newPath);

      await this.git.raw(args);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error moving worktree',
      };
    }
  }

  /**
   * 检查路径是否为 worktree
   * Check if path is a worktree
   *
   * 用于验证路径是否为有效的 Feat
   * Used to verify if a path is a valid Feat
   */
  async isWorktree(path: string): Promise<GitResult<boolean>> {
    try {
      const result = await this.list();
      if (!result.success || !result.data) {
        return { success: true, data: false };
      }

      const isWorktree = result.data.some(wt => wt.path === path);
      return { success: true, data: isWorktree };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error checking worktree',
      };
    }
  }
}

/**
 * 创建 Worktree 操作实例
 * Create worktree operations instance
 *
 * 用于操作 Feat 的底层 Git worktree
 * Used for low-level Git worktree operations for Feat
 */
export function createWorktree(basePath?: string): GitWorktree {
  return new GitWorktree(basePath);
}

// 导出类型
export type { GitResult, WorktreeInfo } from './//types';
