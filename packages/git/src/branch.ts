/**
 * Git 分支操作模块
 * Git Branch Operations Module
 *
 * 提供分支相关的操作：创建、切换、删除、合并等
 * Provides branch-related operations: create, switch, delete, merge, etc.
 */

import { simpleGit, SimpleGit } from 'simple-git';
import type { GitResult, BranchInfo } from './//types';

/**
 * 分支操作类
 * Branch operations class
 */
export class GitBranch {
  private git: SimpleGit;

  constructor(basePath?: string) {
    this.git = simpleGit(basePath);
  }

  /**
   * 列出所有分支
   * List all branches
   */
  async list(options?: { remote?: boolean; merged?: string; noMerged?: string }): Promise<GitResult<BranchInfo[]>> {
    try {
      const args: string[] = ['-vv'];

      if (options?.remote) args.push('-r');
      if (options?.merged) args.push('--merged', options.merged);
      if (options?.noMerged) args.push('--no-merged', options.noMerged);

      const result = await this.git.branch(args);

      const branches: BranchInfo[] = Object.entries(result.branches).map(([name, branch]) => ({
        name: branch.name,
        current: branch.current,
        commit: branch.commit,
        label: branch.label,
      }));

      return { success: true, data: branches };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error listing branches',
      };
    }
  }

  /**
   * 创建分支
   * Create a branch
   */
  async create(
    name: string,
    from?: string,
    options?: { checkout?: boolean }
  ): Promise<GitResult<void>> {
    try {
      if (options?.checkout) {
        // Create and checkout
        await this.git.checkoutBranch(name, from || 'HEAD');
      } else {
        // Create only
        await this.git.branch([name, from || 'HEAD']);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating branch',
      };
    }
  }

  /**
   * 切换分支
   * Switch/checkout branch
   */
  async switch(name: string, options?: { create?: boolean; force?: boolean }): Promise<GitResult<void>> {
    try {
      const args: string[] = [];

      if (options?.create) args.push('-b');
      if (options?.force) args.push('-f');

      args.push(name);

      await this.git.checkout(args);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error switching branch',
      };
    }
  }

  /**
   * 删除分支
   * Delete a branch
   */
  async delete(name: string, force = false): Promise<GitResult<void>> {
    try {
      const args: string[] = ['-d'];
      if (force) args[0] = '-D';

      args.push(name);

      await this.git.branch(args);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error deleting branch',
      };
    }
  }

  /**
   * 重命名分支
   * Rename a branch
   */
  async rename(oldName: string, newName: string, force = false): Promise<GitResult<void>> {
    try {
      const args: string[] = ['-m'];
      if (force) args.push('-M');

      args.push(oldName, newName);

      await this.git.branch(args);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error renaming branch',
      };
    }
  }

  /**
   * 合并分支
   * Merge a branch
   */
  async merge(
    branch: string,
    options?: { noFastForward?: boolean; squash?: boolean; noCommit?: boolean; message?: string }
  ): Promise<GitResult<{ conflicts: string[] }>> {
    try {
      const args: string[] = [];

      if (options?.noFastForward) args.push('--no-ff');
      if (options?.squash) args.push('--squash');
      if (options?.noCommit) args.push('--no-commit');
      if (options?.message) args.push('-m', options.message);

      args.push(branch);

      const result = await this.git.merge(args);

      return {
        success: true,
        data: {
          conflicts: (result.conflicts || []).map(c => typeof c === 'string' ? c : c.file).filter((c): c is string => c !== null),
        },
      };
    } catch (error) {
      // Check if it's a merge conflict
      if (error instanceof Error && error.message.includes('CONFLICT')) {
        const status = await this.git.status();
        return {
          success: false,
          error: `Merge conflict in files: ${status.conflicted.join(', ')}`,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error merging branch',
      };
    }
  }

  /**
   * 变基分支
   * Rebase a branch
   */
  async rebase(
    branch: string,
    options?: { interactive?: boolean; continue?: boolean; abort?: boolean; skip?: boolean }
  ): Promise<GitResult<void>> {
    try {
      const args: string[] = [];

      if (options?.interactive) args.push('-i');
      if (options?.continue) args.push('--continue');
      if (options?.abort) args.push('--abort');
      if (options?.skip) args.push('--skip');

      args.push(branch);

      await this.git.rebase(args);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error rebasing branch',
      };
    }
  }

  /**
   * 获取当前分支名
   * Get current branch name
   */
  async getCurrent(): Promise<GitResult<string>> {
    try {
      const result = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      return { success: true, data: result.trim() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting current branch',
      };
    }
  }

  /**
   * 检查分支是否存在
   * Check if branch exists
   */
  async exists(name: string): Promise<GitResult<boolean>> {
    try {
      const result = await this.list();
      if (!result.success || !result.data) {
        return { success: true, data: false };
      }

      const exists = result.data.some(b => b.name === name);
      return { success: true, data: exists };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error checking branch existence',
      };
    }
  }

  /**
   * 获取分支的 upstream
   * Get branch upstream
   */
  async getUpstream(branch?: string): Promise<GitResult<string | null>> {
    try {
      const targetBranch = branch || (await this.getCurrent()).data;
      if (!targetBranch) {
        return { success: true, data: null };
      }

      const result = await this.git.revparse(['--abbrev-ref', `${targetBranch}@{upstream}`]);
      return { success: true, data: result.trim() };
    } catch (error) {
      // No upstream configured
      return { success: true, data: null };
    }
  }

  /**
   * 设置分支的 upstream
   * Set branch upstream
   */
  async setUpstream(branch: string, remote: string, remoteBranch?: string): Promise<GitResult<void>> {
    try {
      const upstream = remoteBranch ? `${remote}/${remoteBranch}` : remote;
      await this.git.branch(['--set-upstream-to', upstream, branch]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error setting upstream',
      };
    }
  }

  /**
   * 获取分支跟踪信息
   * Get branch tracking info
   */
  async getTrackingInfo(branch: string): Promise<
    GitResult<{
      ahead: number;
      behind: number;
      upstream: string | null;
    }>
  > {
    try {
      const args = ['-vv', branch];
      const result = await this.git.branch(args);

      const branchInfo = Object.values(result.branches).find(b => b.name === branch);

      if (!branchInfo) {
        return {
          success: false,
          error: `Branch ${branch} not found`,
        };
      }

      return {
        success: true,
        data: {
          ahead: 0, // Would need to parse from label
          behind: 0,
          upstream: null, // Would need to parse from label
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting tracking info',
      };
    }
  }

  /**
   * 检查分支是否已合并到目标分支
   * Check if branch is merged into target branch
   *
   * @param branchName - 要检查的分支名
   * @param targetBranch - 目标分支名
   * @returns 合并状态和未合并的提交数
   */
  async isMergedInto(branchName: string, targetBranch: string): Promise<
    GitResult<{
      isMerged: boolean;
      unmergedCount: number;
    }>
  > {
    try {
      // Count commits that are in branchName but not in targetBranch
      // If count is 0, all commits from branchName are in targetBranch (merged)
      // If count > 0, there are unmerged commits
      const countResult = await this.git.raw(['rev-list', '--count', `${targetBranch}..${branchName}`]);
      const unmergedCount = parseInt(countResult.trim(), 10);

      const isMerged = unmergedCount === 0;

      return {
        success: true,
        data: {
          isMerged,
          unmergedCount: isNaN(unmergedCount) ? 0 : unmergedCount,
        },
      };
    } catch (error: unknown) {
      const err = error as Error;
      // Real error occurred
      return {
        success: false,
        error: err.message || 'Unknown error checking merge status',
      };
    }
  }
}

/**
 * 创建分支操作实例
 * Create branch operations instance
 */
export function createBranch(basePath?: string): GitBranch {
  return new GitBranch(basePath);
}

// 导出类型
export type { GitResult, BranchInfo } from './//types';
