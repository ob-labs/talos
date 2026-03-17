/**
 * Worktree 工具函数
 * Worktree Utility Functions
 */

import { join, relative } from 'path';
import { rmSync, existsSync, mkdirSync, copyFileSync, appendFileSync, readFileSync } from 'fs';
import { GitWorktree, GitBranch } from '@talos/git';
import { ErrorMessages } from './errors';

/**
 * 从分支名生成 worktree 路径
 * Generate worktree path from branch name
 *
 * @param projectRoot - 项目根目录 (Project root directory)
 * @param branchName - 分支名称 (Branch name)
 * @returns worktree 路径 (Worktree path)
 *
 * @example
 * ```typescript
 * // 输入: '/path/to/project', 'ralph/cli-prd-anywhere'
 * // 输出: '/path/to/project/worktrees/ralph-cli-prd-anywhere'
 * getWorktreePath('/path/to/project', 'ralph/cli-prd-anywhere');
 *
 * // 输入: '/path/to/project', 'cli-prd-anywhere'
 * // 输出: '/path/to/project/worktrees/ralph-cli-prd-anywhere'
 * getWorktreePath('/path/to/project', 'cli-prd-anywhere');
 * ```
 */
export function getWorktreePath(projectRoot: string, branchName: string): string {
  // 1. 移除 'ralph/' 前缀（如果存在）
  let normalizedBranch = branchName;
  if (normalizedBranch.startsWith('ralph/')) {
    normalizedBranch = normalizedBranch.slice(6); // 移除 'ralph/' (6 characters)
  }

  // 2. 替换斜杠为连字符（用于嵌套分支名）
  const slug = normalizedBranch.replace(/\//g, '-');

  // 3. 添加 'ralph-' 前缀
  const worktreeName = `ralph-${slug}`;

  // 4. 拼接路径: <projectRoot>/worktrees/ralph-<branch-slug>
  return join(projectRoot, 'worktrees', worktreeName);
}

/**
 * 创建 worktree（标准策略）
 * Create worktree with standard strategy
 *
 * 从主分支（main 或 master）创建 worktree
 * Creates worktree from main branch (main or master)
 *
 * @param git - GitWorktree 实例 (GitWorktree instance)
  * @param projectRoot - 项目根目录 (Project root directory)
 * @param worktreePath - worktree 路径 (Worktree path)
 * @param branchName - 分支名称 (Branch name)
 * @returns Promise resolving to success result
 * @throws Error 如果创建失败 (If creation fails)
 *
 * @example
 * ```typescript
 * const git = new GitWorktree('/path/to/repo');
 * await createWorktree(git, '/path/to/worktree', 'feature-branch');
 * ```
 */
export async function createWorktree(
  git: GitWorktree,
  projectRoot: string,
  worktreePath: string,
  branchName: string
): Promise<void> {
  // 获取主分支名称（main 或 master）
  const mainBranch = await getMainBranch(projectRoot);

  // 先切换到主分支，然后创建 worktree
  // First switch to main branch, then create worktree
  const gitBranch = new GitBranch(projectRoot);
  const switchResult = await gitBranch.switch(mainBranch);

  if (!switchResult.success) {
    throw new Error(`切换到主分支失败：${switchResult.error || '未知错误'}`);
  }

  // 从主分支创建新分支的 worktree
  const result = await git.create(worktreePath, branchName, {
    detach: false
  });

  if (!result.success) {
    throw new Error(`创建 worktree 失败：${result.error || '未知错误'}`);
  }
}

/**
 * 获取主分支名称（main 或 master）
 * Get main branch name (main or master)
 *
 * @param projectRoot - 项目根目录
 * @returns 主分支名称
 */
async function getMainBranch(projectRoot: string): Promise<string> {
  // 使用 GitRepository 的 getDefaultBranch 方法统一处理
  // Use GitRepository's getDefaultBranch method for consistent handling
  const { GitRepository } = await import('@talos/git');
  const gitRepo = new GitRepository(projectRoot);
  const result = await gitRepo.getDefaultBranch();

  return result.success && result.data ? result.data : 'main';
}

/**
 * 确保 worktree 存在并指向正确的分支
 * Ensure worktree exists and points to correct branch
 *
 * 检查 worktree 是否存在，如果存在则验证分支是否匹配，
 * 如果不匹配则删除并重建，如果不存在则创建
 *
 * Checks if worktree exists, validates branch matches if it does,
 * removes and recreates if mismatch, creates if doesn't exist
 *
 * @param projectRoot - 项目根目录 (Project root directory)
 * @param worktreePath - worktree 路径 (Worktree path)
 * @param branchName - 分支名称 (Branch name)
 * @returns Promise resolving when worktree is ensured
 *
 * @example
 * ```typescript
 * const git = new GitWorktree('/path/to/repo');
 * await ensureWorktree('/path/to/repo', '/path/to/worktree', 'feature-branch');
 * ```
 */
export async function ensureWorktree(
  projectRoot: string,
  worktreePath: string,
  branchName: string
): Promise<{ created: boolean; reused: boolean }> {
  const git = new GitWorktree(projectRoot);

  // 1. 检查 worktree 是否存在
  // Check if worktree exists
  const isWorktreeResult = await git.isWorktree(worktreePath);

  if (isWorktreeResult.success && isWorktreeResult.data) {
    // worktree 存在，验证分支是否匹配
    // Worktree exists, verify branch matches
    const listResult = await git.list();

    if (listResult.success && listResult.data) {
      const existingWorktree = listResult.data.find(wt => wt.path === worktreePath);

      if (existingWorktree && existingWorktree.branch === branchName) {
        // 分支匹配，复用现有 worktree
        // Branch matches, reuse existing worktree
        return { created: false, reused: true };
      }

      // 分支不匹配，删除旧 worktree 并创建新的
      // Branch mismatch, remove old worktree and create new one
      // 删除旧 worktree
      const removeResult = await git.remove(worktreePath);
      if (!removeResult.success) {
        // 如果删除失败，使用强制删除
        rmSync(worktreePath, { recursive: true, force: true });
      }
    }
  }

  // 2. 创建新 worktree
  // Create new worktree
  await createWorktree(git, projectRoot, worktreePath, branchName);
  return { created: true, reused: false };
}

/**
 * 同步 PRD 文件到 worktree
 * Sync PRD files to worktree
 *
 * 将 prd.json、progress.txt 和 .last-branch 从 ralph/{name}/ 复制到 worktree 的 scripts/ralph/ 目录
 * 注意：ralph.sh 和 CLAUDE.md 由 CLI 内置，不需要同步
 * Copies prd.json, progress.txt, and .last-branch from ralph/{name}/ to worktree's scripts/ralph/ directory
 * Note: ralph.sh and CLAUDE.md are CLI built-in, no need to sync
 *
 * @param sourceDir - 源目录（通常是项目根目录）(Source directory, usually project root)
 * @param worktreePath - worktree 路径 (Worktree path)
 * @param name - PRD 名称 (PRD name/identifier)
 *
 * @example
 * ```typescript
 * await syncPRDToWorktree('/path/to/project', '/path/to/project/worktrees/ralph-feature', 'feature-name');
 * ```
 */
export function syncPRDToWorktree(sourceDir: string, worktreePath: string, name: string): void {
  // 1. 创建 worktree 的 ralph/{name}/ 目录（新路径结构）
  // Create worktree's ralph/{name}/ directory (new path structure)
  const ralphDir = join(worktreePath, 'ralph', name);
  if (!existsSync(ralphDir)) {
    mkdirSync(ralphDir, { recursive: true });
  }

  // 2. 复制 prd.json（必需）
  // Copy prd.json (required)
  const sourcePrdPath = join(sourceDir, 'ralph', name, 'prd.json');
  const targetPrdPath = join(ralphDir, 'prd.json');
  copyFileSync(sourcePrdPath, targetPrdPath);

  // 3. 复制 progress.txt（如果存在）
  // Copy progress.txt (if exists)
  const sourceProgressPath = join(sourceDir, 'ralph', name, 'progress.txt');
  if (existsSync(sourceProgressPath)) {
    const targetProgressPath = join(ralphDir, 'progress.txt');
    copyFileSync(sourceProgressPath, targetProgressPath);
  }
}
