/**
 * Git 仓库操作模块
 * Git Repository Operations Module
 *
 * 提供仓库级别的操作：初始化、克隆、状态、日志等
 * Provides repository-level operations: init, clone, status, log, etc.
 */

import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import type {
  GitResult,
  RepositoryStatus,
  CommitInfo,
} from './//types';

/**
 * 仓库操作类
 * Repository operations class
 */
export class GitRepository {
  private git: SimpleGit;

  constructor(basePath?: string, options?: Partial<SimpleGitOptions>) {
    this.git = simpleGit(basePath, options);
  }

  /**
   * 检查路径是否为 Git 仓库
   * Check if path is a Git repository
   */
  async isRepo(): Promise<GitResult<boolean>> {
    try {
      const isRepo = await this.git.checkIsRepo();
      return { success: true, data: isRepo };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error checking repository',
      };
    }
  }

  /**
   * 初始化 Git 仓库
   * Initialize a Git repository
   */
  async init(bare = false): Promise<GitResult<string>> {
    try {
      const result = await this.git.init(bare);
      // result is an object with gitDir property, not a string
      return { success: true, data: typeof result === 'string' ? result : result.gitDir || 'initialized' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error initializing repository',
      };
    }
  }

  /**
   * 克隆仓库
   * Clone a repository
   */
  async clone(
    repoPath: string,
    localPath: string,
    options?: string[]
  ): Promise<GitResult<string>> {
    try {
      const result = await this.git.clone(repoPath, localPath, options);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error cloning repository',
      };
    }
  }

  /**
   * 获取仓库状态
   * Get repository status
   */
  async status(): Promise<GitResult<RepositoryStatus>> {
    try {
      const status = await this.git.status();

      return {
        success: true,
        data: {
          branch: status.current || 'HEAD',
          ahead: status.ahead,
          behind: status.behind,
          modified: status.modified,
          added: status.created,
          deleted: status.deleted,
          untracked: status.not_added,
          conflicted: status.conflicted,
          staged: status.staged,
          notStaged: status.modified.concat(status.deleted).filter(f => !status.staged.includes(f)),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting status',
      };
    }
  }

  /**
   * 获取提交日志
   * Get commit log
   */
  async log(options?: { maxCount?: number; from?: string; to?: string }): Promise<GitResult<CommitInfo[]>> {
    try {
      const logOptions: Record<string, unknown> = {};
      if (options?.maxCount) logOptions.maxCount = options.maxCount;
      if (options?.from || options?.to) {
        logOptions.from = options.from;
        logOptions.to = options.to;
      }

      const log = await this.git.log(logOptions);

      const commits: CommitInfo[] = log.all.map(commit => ({
        hash: commit.hash,
        message: commit.message,
        author: commit.author_name,
        date: commit.date,
        refs: commit.refs,
        body: commit.body,
      }));

      return { success: true, data: commits };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting log',
      };
    }
  }

  /**
   * 获取当前分支名
   * Get current branch name
   */
  async getCurrentBranch(): Promise<GitResult<string>> {
    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      return { success: true, data: branch.trim() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting current branch',
      };
    }
  }

  /**
   * 获取仓库根路径
   * Get repository root path
   */
  async getRootPath(): Promise<GitResult<string>> {
    try {
      const root = await this.git.revparse(['--show-toplevel']);
      return { success: true, data: root.trim() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting root path',
      };
    }
  }

  /**
   * 获取配置
   * Get config value
   */
  async getConfig(key: string): Promise<GitResult<string>> {
    try {
      const value = await this.git.getConfig(key);
      return { success: true, data: value.value || '' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting config',
      };
    }
  }

  /**
   * 设置配置
   * Set config value
   */
  async setConfig(key: string, value: string): Promise<GitResult<void>> {
    try {
      await this.git.addConfig(key, value);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error setting config',
      };
    }
  }


  /**
   * 获取默认分支名称
   * Get default branch name
   *
   * 优先级：
   * 1. 检查 origin/HEAD 指向的远程分支（最准确）
   * 2. 检查本地是否存在 main 分支
   * 3. 检查本地是否存在 master 分支
   * 4. 默认返回 main
   */
  async getDefaultBranch(): Promise<GitResult<string>> {
    try {
      // 1. 尝试获取远程默认分支（origin/HEAD）
      // Try to get remote default branch (origin/HEAD)
      const originHeadResult = await this.git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
      if (originHeadResult.trim()) {
        const remoteBranch = originHeadResult.trim();
        // 从 "refs/remotes/origin/main" 提取 "main"
        const branchName = remoteBranch.replace(/^refs\/remotes\/origin\//, '');
        if (branchName) {
          return { success: true, data: branchName };
        }
      }
    } catch {
      // origin/HEAD 不存在，继续尝试其他方法
      // origin/HEAD doesn't exist, try other methods
    }

    try {
      // 2. 列出所有本地分支，检查是否存在 main 或 master
      // List all local branches, check if main or master exists
      const branches = await this.git.branch();
      const branchNames = Object.keys(branches.branches);

      if (branchNames.includes('main')) {
        return { success: true, data: 'main' };
      }
      if (branchNames.includes('master')) {
        return { success: true, data: 'master' };
      }
    } catch {
      // 忽略错误，返回默认值
      // Ignore error, return default value
    }

    // 3. 默认返回 main
    // Default to main
    return { success: true, data: 'main' };
  }

  /**
   * 获取 raw git 实例（用于高级操作）
   * Get raw git instance for advanced operations
   */
  getRawGit(): SimpleGit {
    return this.git;
  }

  /**
   * 获取主仓库路径（即使在 worktree 中也能正确获取）
   * Get main repository path (works even in worktree)
   *
   * 通过 git worktree list 找到默认分支对应的 worktree 路径
   * Finds the worktree path for default branch via git worktree list
   *
   * 使用 getDefaultBranch() 动态确定默认分支，不再硬编码 main/master
   */
  async getMainRepoPath(): Promise<GitResult<string>> {
    try {
      // 获取默认分支名称
      const defaultBranchResult = await this.getDefaultBranch();
      const defaultBranch = defaultBranchResult.success && defaultBranchResult.data
        ? defaultBranchResult.data
        : 'main';

      const worktrees = await this.git.raw(['worktree', 'list', '--porcelain']);

      // 解析 porcelain 输出，找到默认分支对应的 worktree
      // Parse porcelain output to find worktree for default branch
      const lines = worktrees.split('\n');
      let firstWorktreePath: string | null = null;
      let currentWorktreePath: string | null = null;

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          // 记录第一个 worktree 路径作为回退选项
          // Record first worktree path as fallback
          if (!firstWorktreePath) {
            firstWorktreePath = line.substring(9).trim();
          }
          currentWorktreePath = line.substring(9).trim();
        } else if (line.startsWith('branch ')) {
          const branchRef = line.substring(7).trim();
          const branchName = branchRef.replace('refs/heads/', '');
          // 匹配默认分支
          if (branchName === defaultBranch) {
            if (currentWorktreePath) {
              return { success: true, data: currentWorktreePath };
            }
          }
        }
      }

      // 如果没有找到默认分支，返回第一个 worktree（通常是主仓库）
      // If default branch not found, return first worktree (usually main repo)
      if (firstWorktreePath) {
        return { success: true, data: firstWorktreePath };
      }

      return {
        success: false,
        error: 'Cannot find main repository path',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting main repo path',
      };
    }
  }

  /**
   * 获取仓库名称（主仓库目录的 basename）
   * Get repository name (basename of main repo directory)
   */
  async getRepoName(): Promise<GitResult<string>> {
    const mainPathResult = await this.getMainRepoPath();
    if (!mainPathResult.success || !mainPathResult.data) {
      return {
        success: false,
        error: mainPathResult.error || 'Cannot get main repo path',
      };
    }
    
    const pathSep = mainPathResult.data.includes('/') ? '/' : '\\\\';
    const repoName = mainPathResult.data.split(pathSep).pop() || '';
    
    return { success: true, data: repoName };
  }
}

/**
 * 创建仓库操作实例
 * Create repository operations instance
 */
export function createRepository(basePath?: string): GitRepository {
  return new GitRepository(basePath);
}

// 导出类型
export type { GitResult, RepositoryStatus, CommitInfo } from './//types';
