/**
 * Task ID Generator
 * 任务 ID 生成器
 *
 * Generates unique task IDs based on repository and worktree names
 * 基于仓库和 worktree 名称生成唯一的任务 ID
 */

import { basename } from 'path';
import { GitRepository } from '@talos/git';

/**
 * Generate task ID from repository path and worktree name
 * 从仓库路径和 worktree 名称生成任务 ID
 *
 * The ID format is: {repoName}-{worktreeName}
 * For example: talos-git-worktree-support
 *
 * If not in a worktree, uses the current branch name as the feat identifier
 * 如果不在 worktree 中，使用当前分支名作为 feat 标识符
 *
 * @param repoPath - Repository path (仓库路径)
 * @param worktreeName - Worktree name (worktree 名称)
 * @returns Task ID (任务 ID)
 *
 * @example
 * ```typescript
 * // In a worktree
 * const taskId = await generateTaskId('/path/to/talos', 'git-worktree-support');
 * // Returns: 'talos-git-worktree-support'
 *
 * // Not in a worktree (uses branch name)
 * const taskId = await generateTaskId('/path/to/talos', '');
 * // Returns: 'talos-main' (if on main branch)
 * ```
 */
export async function generateTaskId(
  repoPath: string,
  worktreeName: string
): Promise<string> {
  const git = new GitRepository(repoPath);

  // Get repository root path and extract repository name
  // 获取仓库根路径并提取仓库名
  const rootResult = await git.getRootPath();
  if (!rootResult.success || !rootResult.data) {
    throw new Error(`Failed to get repository root: ${rootResult.error}`);
  }

  const repoName = basename(rootResult.data);

  // If worktree name is provided, use it
  // 如果提供了 worktree 名称，使用它
  if (worktreeName) {
    return `${repoName}-${worktreeName}`;
  }

  // If not in a worktree, use current branch name as worktree identifier
  // 如果不在 worktree 中，使用当前分支名作为 worktree 标识符
  const branchResult = await git.getCurrentBranch();
  if (!branchResult.success || !branchResult.data) {
    throw new Error(`Failed to get current branch: ${branchResult.error}`);
  }

  const branchName = branchResult.data;

  // Normalize branch name (remove 'ralph/' prefix if present)
  // 规范化分支名（如果存在则移除 'ralph/' 前缀）
  const normalizedBranch = branchName.startsWith('ralph/')
    ? branchName.slice(6)
    : branchName;

  return `${repoName}-${normalizedBranch}`;
}
