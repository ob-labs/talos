/**
 * Git 提交操作模块
 * Git Commit Operations Module
 *
 * 提供提交相关的操作：add, commit, diff, stash 等
 * Provides commit-related operations: add, commit, diff, stash, etc.
 */

import { simpleGit, SimpleGit } from 'simple-git';
import type { GitResult, FileChange, DiffInfo, StashInfo, CommitInfo } from './//types';

/**
 * 提交操作类
 * Commit operations class
 */
export class GitCommit {
  private git: SimpleGit;

  constructor(basePath?: string) {
    this.git = simpleGit(basePath);
  }

  /**
   * 添加文件到暂存区
   * Add files to staging area
   */
  async add(files: string | string[]): Promise<GitResult<void>> {
    try {
      const fileList = Array.isArray(files) ? files : [files];
      await this.git.add(fileList);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error adding files',
      };
    }
  }

  /**
   * 添加所有变更
   * Add all changes
   */
  async addAll(): Promise<GitResult<void>> {
    try {
      await this.git.add('.');
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error adding all files',
      };
    }
  }

  /**
   * 提交变更
   * Commit changes
   */
  async commit(
    message: string,
    options?: { add?: boolean; noVerify?: boolean; amend?: boolean }
  ): Promise<GitResult<{ commit: string; summary: { changes: number; insertions: number; deletions: number } }>> {
    try {
      const commitOptions: string[] = [];
      if (options?.add) commitOptions.push('--all');
      if (options?.noVerify) commitOptions.push('--no-verify');
      if (options?.amend) commitOptions.push('--amend');

      const result = await this.git.commit(message, commitOptions);

      return {
        success: true,
        data: {
          commit: result.commit,
          summary: {
            changes: result.summary.changes,
            insertions: result.summary.insertions,
            deletions: result.summary.deletions,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error committing',
      };
    }
  }

  /**
   * 获取 diff
   * Get diff
   */
  async diff(options?: { target?: string; cached?: boolean }): Promise<GitResult<string>> {
    try {
      let result: string;

      if (options?.cached) {
        result = await this.git.diff(['--cached', options.target || 'HEAD']);
      } else if (options?.target) {
        result = await this.git.diff([options.target]);
      } else {
        result = await this.git.diff();
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting diff',
      };
    }
  }

  /**
   * 获取文件变更摘要
   * Get file changes summary
   */
  async getFileChanges(options?: { cached?: boolean }): Promise<GitResult<FileChange[]>> {
    try {
      const args = ['--numstat'];
      if (options?.cached) args.push('--cached');

      const result = await this.git.diff(args);
      const lines = result.split('\n').filter(line => line.trim());

      const changes: FileChange[] = lines.map(line => {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const additions = parseInt(parts[0], 10) || 0;
          const deletions = parseInt(parts[1], 10) || 0;
          const file = parts[2];

          return {
            file,
            status: 'modified' as FileChange['status'],
            additions,
            deletions,
          };
        }
        return null;
      }).filter((item): item is NonNullable<typeof item> => item !== null);

      return { success: true, data: changes };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting file changes',
      };
    }
  }

  /**
   * 获取详细 diff 信息
   * Get detailed diff info
   *
   * @param options.cached - 使用暂存区 diff (index vs HEAD)
   * @param options.baseRef - 基准 ref，提供时计算 baseRef..HEAD 的 diff（worktree 相对主分支的变更）
   */
  async getDetailedDiff(options?: { cached?: boolean; baseRef?: string }): Promise<GitResult<DiffInfo[]>> {
    try {
      const args = ['--no-color'];
      // baseRef 存在时：显示 worktree 分支相对主分支的完整变更 (git diff main..HEAD)，忽略 cached
      if (options?.baseRef) {
        args.push(`${options.baseRef}..HEAD`);
      } else if (options?.cached) {
        args.push('--cached');
      }

      const result = await this.git.diff(args);
      const diffs: DiffInfo[] = [];
      let currentDiff: Partial<DiffInfo> = {};
      const diffLines: string[] = [];

      const lines = result.split('\n');
      for (const line of lines) {
        if (line.startsWith('diff --git')) {
          if (currentDiff.file) {
            currentDiff.diff = diffLines.join('\n');
            diffs.push(currentDiff as DiffInfo);
          }
          currentDiff = { diff: '' };
          diffLines.length = 0;

          // Parse file name
          const match = line.match(/diff --git a\/(.+) b\/(.+)/);
          if (match) {
            currentDiff.file = match[2];
          }
        } else if (line.startsWith('@@')) {
          diffLines.push(line);
        } else if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) {
          diffLines.push(line);
        } else if (line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
          // Skip metadata lines
          continue;
        } else if (line.startsWith('new file')) {
          currentDiff.status = 'added';
        } else if (line.startsWith('deleted file')) {
          currentDiff.status = 'deleted';
        }
      }

      // Push the last diff
      if (currentDiff.file) {
        currentDiff.diff = diffLines.join('\n');
        diffs.push(currentDiff as DiffInfo);
      }

      return { success: true, data: diffs };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting detailed diff',
      };
    }
  }

  /**
   * 显示提交详情（包括 diff）
   * Show commit details (including diff)
   *
   * @param hash - Commit hash (短 hash 或完整 hash)
   * @returns Commit info with hash, message, author, date, body, diff
   */
  async show(hash: string): Promise<GitResult<CommitInfo & { diff: string }>> {
    try {
      // 使用 git show 获取提交详情和 diff
      const result = await this.git.show([hash, '--no-color', '--format=%H|%s|%an|%ai|%b']);

      // 解析输出
      const lines = result.split('\n');
      const headerEndIndex = lines.findIndex(line => line.startsWith('diff --git') || line.startsWith('index'));

      if (headerEndIndex === -1) {
        throw new Error('Invalid git show output format');
      }

      // 提取元数据（前几行）
      const metadata = lines.slice(0, headerEndIndex).join('\n');
      const metaMatch = metadata.match(/^([a-f0-9]+)\|(.+)\|(.+)\|(.+)\|([\s\S]*)$/m);

      if (!metaMatch) {
        throw new Error('Failed to parse commit metadata');
      }

      const [, fullHash, message, author, date, body] = metaMatch;

      // 提取 diff 部分
      const diff = lines.slice(headerEndIndex).join('\n');

      return {
        success: true,
        data: {
          hash: fullHash,
          message,
          author,
          date,
          refs: '',
          body: body.trim(),
          diff,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error showing commit',
      };
    }
  }

  /**
   * 重置暂存区
   * Reset staging area
   */
  async reset(files?: string | string[], mode: 'soft' | 'mixed' | 'hard' = 'mixed'): Promise<GitResult<void>> {
    try {
      const resetMode = mode === 'soft' ? ['--soft'] : mode === 'hard' ? ['--hard'] : [];

      if (files) {
        const fileList = Array.isArray(files) ? files : [files];
        await this.git.reset(resetMode.concat(['HEAD', '--']).concat(fileList));
      } else {
        await this.git.reset(resetMode);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error resetting',
      };
    }
  }

  /**
   * 撤销工作区变更
   * Discard working directory changes
   */
  async checkout(files: string | string[]): Promise<GitResult<void>> {
    try {
      const fileList = Array.isArray(files) ? files : [files];
      await this.git.checkout(['--'].concat(fileList));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error checking out files',
      };
    }
  }

  /**
   * 创建 stash
   * Create stash
   */
  async stash(
    message?: string,
    options?: { includeUntracked?: boolean; keepIndex?: boolean }
  ): Promise<GitResult<string>> {
    try {
      const args: string[] = ['push'];

      if (message) args.push('-m', message);
      if (options?.includeUntracked) args.push('-u');
      if (options?.keepIndex) args.push('-k');

      const result = await this.git.stash(args);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating stash',
      };
    }
  }

  /**
   * 列出 stash
   * List stashes
   */
  async listStashes(): Promise<GitResult<StashInfo[]>> {
    try {
      const result = await this.git.stash(['list', '--format=%H|%s|%ai']);
      const lines = result.split('\n').filter(line => line.trim());

      const stashes: StashInfo[] = lines.map((line, index) => {
        const parts = line.split('|');
        return {
          index,
          hash: parts[0] || '',
          message: parts[1] || '',
          date: parts[2] || '',
        };
      });

      return { success: true, data: stashes };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error listing stashes',
      };
    }
  }

  /**
   * 应用 stash
   * Apply stash
   */
  async applyStash(index?: number): Promise<GitResult<void>> {
    try {
      const stashRef = index !== undefined ? `stash@{${index}}` : 'stash@{0}';
      await this.git.stash(['apply', stashRef]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error applying stash',
      };
    }
  }

  /**
   * 弹出 stash
   * Pop stash
   */
  async popStash(index?: number): Promise<GitResult<void>> {
    try {
      const stashRef = index !== undefined ? `stash@{${index}}` : 'stash@{0}';
      await this.git.stash(['pop', stashRef]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error popping stash',
      };
    }
  }

  /**
   * 删除 stash
   * Drop stash
   */
  async dropStash(index?: number): Promise<GitResult<void>> {
    try {
      const stashRef = index !== undefined ? `stash@{${index}}` : 'stash@{0}';
      await this.git.stash(['drop', stashRef]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error dropping stash',
      };
    }
  }

  /**
   * 清空所有 stash
   * Clear all stashes
   */
  async clearStashes(): Promise<GitResult<void>> {
    try {
      await this.git.stash(['clear']);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error clearing stashes',
      };
    }
  }

  /**
   * 显示 stash diff
   * Show stash diff
   */
  async showStash(index?: number): Promise<GitResult<string>> {
    try {
      const stashRef = index !== undefined ? `stash@{${index}}` : 'stash@{0}';
      const result = await this.git.stash(['show', '-p', stashRef]);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error showing stash',
      };
    }
  }
}

/**
 * 创建提交操作实例
 * Create commit operations instance
 */
export function createCommit(basePath?: string): GitCommit {
  return new GitCommit(basePath);
}

// 导出类型
export type { GitResult, FileChange, DiffInfo, StashInfo } from './//types';
