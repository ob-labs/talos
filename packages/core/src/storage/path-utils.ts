import * as path from 'path';
import { GitRepository } from '@talos/git';

/**
 * 从任意路径提取主仓库根目录
 * Extract main repository root from any path
 *
 * 规则：
 * - 如果是 worktree 路径 (/repo/worktrees/xxx)，返回主仓库路径 (/repo)
 * - 否则，返回原路径
 *
 * @param filePath - 任意文件路径
 * @returns 主仓库根目录
 */
export function getRepoRoot(filePath: string): string {
  // 检查是否是 worktree 路径: /path/to/repo/worktrees/name
  const worktreeMatch = filePath.match(/^(.*\/)worktrees\/[^/]+$/);

  if (worktreeMatch) {
    // 返回 worktrees 的父目录（主仓库路径）
    return worktreeMatch[1].slice(0, -1); // 去掉末尾的 /
  }

  return filePath;
}

/**
 * 检查路径是否是 worktree
 * Check if path is a worktree
 *
 * @param filePath - 文件路径
 * @returns 是否是 worktree 路径
 */
export function isWorktreePath(filePath: string): boolean {
  return /\/worktrees\/[^/]+$/.test(filePath);
}

/**
 * 检查路径是否为 Git 仓库
 * Check if path is a Git repository
 *
 * 使用 @talos/git 的 GitRepository 类进行检查
 *
 * @param filePath - 文件路径
 * @returns 是否是 Git 仓库
 */
export async function isGitRepo(filePath: string): Promise<boolean> {
  const repo = new GitRepository(filePath);
  const result = await repo.isRepo();
  return result.success && result.data !== undefined ? result.data : false;
}

/**
 * 获取 Git 仓库根路径
 * Get Git repository root path
 *
 * 使用 @talos/git 的 GitRepository 类获取仓库根目录
 *
 * @param filePath - 仓库内任意路径
 * @returns 仓库根路径，如果不是仓库则返回 null
 */
export async function getRepoRootPath(filePath: string): Promise<string | null> {
  const repo = new GitRepository(filePath);
  const result = await repo.getRootPath();
  return result.success && result.data !== undefined ? result.data : null;
}
