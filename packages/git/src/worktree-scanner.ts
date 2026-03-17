/**
 * Git Worktree 扫描模块
 * Git Worktree Scanner Module
 *
 * 扫描 Git 仓库的 worktree 列表，检测新增或删除的 worktree
 * Scans Git repository for worktree list, detecting added or removed worktrees
 */

import fs from 'fs';
import path from 'path';
import { GitWorktree } from './//worktree';
import type { GitResult, WorktreeInfo } from './//types';

/**
 * Worktree 元数据（扩展的 worktree 信息）
 * Worktree metadata (extended worktree information)
 */
export interface WorktreeMetadata extends WorktreeInfo {
  isDetached: boolean;
  isDefault: boolean; // 主 worktree（仓库根目录）为 true，其他为 false
}

/**
 * 扫描工作区的 worktree 列表
 * Scan workspace for worktree list
 *
 * @param workspacePath - 工作区路径 / Workspace path
 * @returns worktree 元数据数组 / Array of worktree metadata
 */
export async function scanWorkspaceWorktrees(
  workspacePath: string
): Promise<GitResult<WorktreeMetadata[]>> {
  try {
    const worktree = new GitWorktree(workspacePath);
    const result = await worktree.list();

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to list worktrees',
      };
    }

    // 标准化路径用于比较
    // Normalize paths for comparison
    const normalizePath = (p: string) => {
      try {
        return fs.realpathSync.native(p);
      } catch {
        return path.resolve(p);
      }
    };
    const mainPath = normalizePath(workspacePath);

    // 标记主 worktree（仓库根目录），保留所有 worktrees（包括主 worktree）
    // Mark main worktree (repo root), keep all worktrees (including main worktree)
    const allWorktrees = result.data.map((wt) => ({
      ...wt,
      isDefault: normalizePath(wt.path) === mainPath,
    }));

    // 转换为 WorktreeMetadata 格式，确保 isDetached 和 isDefault 字段存在
    // Transform to WorktreeMetadata format, ensuring isDetached and isDefault fields exist
    const metadata: WorktreeMetadata[] = allWorktrees.map((wt) => ({
      path: wt.path,
      branch: wt.branch,
      commit: wt.commit,
      isBare: wt.isBare ?? false,
      isDetached: wt.isDetached ?? false,
      isDefault: wt.isDefault ?? false,
    }));

    return { success: true, data: metadata };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error scanning workspace worktrees',
    };
  }
}

/**
 * 创建 Worktree 扫描器实例
 * Create Worktree scanner instance
 */
export class WorktreeScanner {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * 扫描 worktree
   * Scan worktrees
   */
  async scan(): Promise<GitResult<WorktreeMetadata[]>> {
    return scanWorkspaceWorktrees(this.workspacePath);
  }
}
