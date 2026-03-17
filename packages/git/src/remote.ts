/**
 * Git 远程操作模块
 * Git Remote Operations Module
 *
 * 提供远程相关的操作：fetch, pull, push, pr 等
 * Provides remote-related operations: fetch, pull, push, pr, etc.
 */

import { simpleGit, SimpleGit } from 'simple-git';
import type { GitResult, RemoteInfo, RemoteBranchInfo, PullPushResult } from './//types';

/**
 * 远程操作类
 * Remote operations class
 */
export class GitRemote {
  private git: SimpleGit;

  constructor(basePath?: string) {
    this.git = simpleGit(basePath);
  }

  /**
   * 列出所有远程
   * List all remotes
   */
  async list(): Promise<GitResult<RemoteInfo[]>> {
    try {
      const result = await this.git.getRemotes(true);

      const remotes: RemoteInfo[] = result.map(remote => ({
        name: remote.name,
        refs: {
          fetch: remote.refs.fetch,
          push: remote.refs.push,
        },
      }));

      return { success: true, data: remotes };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error listing remotes',
      };
    }
  }

  /**
   * 添加远程
   * Add a remote
   */
  async add(name: string, url: string, options?: { fetch?: boolean }): Promise<GitResult<void>> {
    try {
      const args: string[] = ['add'];
      if (options?.fetch) args.push('-f');

      args.push(name, url);

      await this.git.remote(args);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error adding remote',
      };
    }
  }

  /**
   * 删除远程
   * Remove a remote
   */
  async remove(name: string): Promise<GitResult<void>> {
    try {
      await this.git.remote(['remove', name]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error removing remote',
      };
    }
  }

  /**
   * 重命名远程
   * Rename a remote
   */
  async rename(oldName: string, newName: string): Promise<GitResult<void>> {
    try {
      await this.git.remote(['rename', oldName, newName]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error renaming remote',
      };
    }
  }

  /**
   * 设置远程 URL
   * Set remote URL
   */
  async setUrl(name: string, url: string): Promise<GitResult<void>> {
    try {
      await this.git.remote(['set-url', name, url]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error setting remote URL',
      };
    }
  }

  /**
   * 获取远程 URL
   * Get remote URL
   */
  async getUrl(name: string): Promise<GitResult<string>> {
    try {
      const result = await this.git.remote(['get-url', name]);
      if (typeof result === 'string') {
        return { success: true, data: result.trim() };
      }
      return { success: false, error: 'Failed to get remote URL' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting remote URL',
      };
    }
  }

  /**
   * Fetch 远程分支
   * Fetch remote branches
   */
  async fetch(
    remote?: string,
    branch?: string,
    options?: { prune?: boolean; tags?: boolean; depth?: number }
  ): Promise<GitResult<void>> {
    try {
      const args: string[] = [];

      if (options?.prune) args.push('--prune');
      if (options?.tags) args.push('--tags');
      if (options?.depth) args.push('--depth', options.depth.toString());

      if (remote) {
        args.push(remote);
        if (branch) args.push(branch);
      }

      await this.git.fetch(args);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error fetching',
      };
    }
  }

  /**
   * Pull 远程变更
   * Pull remote changes
   */
  async pull(
    remote?: string,
    branch?: string,
    options?: { rebase?: boolean; noFastForward?: boolean; squash?: boolean }
  ): Promise<GitResult<PullPushResult>> {
    try {
      const args: string[] = [];

      if (options?.rebase) args.push('--rebase');
      if (options?.noFastForward) args.push('--no-ff');

      if (remote) {
        args.push(remote);
        if (branch) args.push(branch);
      }

      const result = await this.git.pull(args);

      return {
        success: true,
        data: {
          remoteMessages: {
            all: result.remoteMessages?.all || [],
          },
          summary: result.summary,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error pulling',
      };
    }
  }

  /**
   * Push 本地变更
   * Push local changes
   */
  async push(
    remote?: string,
    branch?: string,
    options?: { force?: boolean; setUpstream?: boolean; tags?: boolean; delete?: boolean }
  ): Promise<GitResult<PullPushResult>> {
    try {
      const args: string[] = [];

      if (options?.force) args.push('--force');
      if (options?.setUpstream) args.push('--set-upstream');
      if (options?.tags) args.push('--tags');
      if (options?.delete) args.push('--delete');

      if (remote) args.push(remote);
      if (branch) args.push(branch);

      const result = await this.git.push(args);

      return {
        success: true,
        data: {
          remoteMessages: {
            all: result.remoteMessages?.all || [],
          },
          pushed: result.pushed?.map((p) => typeof p.local === 'string' ? p.local : '').filter(Boolean),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error pushing',
      };
    }
  }

  /**
   * 列出远程分支
   * List remote branches
   */
  async listRemoteBranches(remote?: string): Promise<GitResult<RemoteBranchInfo[]>> {
    try {
      const args: string[] = ['-r'];
      const result = await this.git.branch(args);

      const branches: RemoteBranchInfo[] = Object.values(result.branches)
        .filter(b => b.name.startsWith('remotes/'))
        .map(b => {
          const parts = b.name.replace('remotes/', '').split('/');
          return {
            remote: parts[0],
            name: parts.slice(1).join('/'),
          };
        });

      // Filter by remote if specified
      const filtered = remote
        ? branches.filter(b => b.remote === remote)
        : branches;

      return { success: true, data: filtered };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error listing remote branches',
      };
    }
  }

  /**
   * 获取远程仓库的默认分支
   * Get default branch of remote repository
   */
  async getDefaultBranch(remote = 'origin'): Promise<GitResult<string>> {
    try {
      const result = await this.git.remote(['show', remote]);
      if (typeof result !== 'string') {
        return { success: false, error: 'Failed to get remote info' };
      }
      const match = result.match(/HEAD branch:\s*(.+)/);
      const defaultBranch = match ? match[1].trim() : 'main';

      return { success: true, data: defaultBranch };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting default branch',
      };
    }
  }

  /**
   * 创建 PR（使用 GitHub CLI）
   * Create PR using GitHub CLI
   */
  async createPR(options: {
    title: string;
    body?: string;
    base?: string;
    head?: string;
    draft?: boolean;
  }): Promise<GitResult<{ url: string; number: number }>> {
    try {
      const args: string[] = ['pr', 'create', '--title', options.title];

      if (options.body) args.push('--body', options.body);
      if (options.base) args.push('--base', options.base);
      if (options.head) args.push('--head', options.head);
      if (options.draft) args.push('--draft');

      // Execute gh CLI
      const { execSync } = await import('child_process');
      const cwd = process.cwd();
      const result = execSync(`gh ${args.join(' ')}`, {
        encoding: 'utf-8',
        cwd,
      });

      // Parse PR URL from output
      const urlMatch = result.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
      const numberMatch = result.match(/pull\/(\d+)/);

      return {
        success: true,
        data: {
          url: urlMatch ? urlMatch[0] : '',
          number: numberMatch ? parseInt(numberMatch[1], 10) : 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating PR',
      };
    }
  }

  /**
   * 列出 PR（使用 GitHub CLI）
   * List PRs using GitHub CLI
   */
  async listPRs(options?: { state?: 'open' | 'closed' | 'merged' | 'all' }): Promise<
    GitResult<
      {
        number: number;
        title: string;
        author: string;
        state: string;
        url: string;
        branch: string;
      }[]
    >
  > {
    try {
      const state = options?.state || 'open';
      const { execSync } = await import('child_process');

      const cwd = process.cwd();
      const result = execSync(
        `gh pr list --state ${state} --json number,title,author,state,url,headRefName`,
        {
          encoding: 'utf-8',
          cwd,
        }
      );

      const prs = JSON.parse(result);
      const formatted = prs.map((pr: { number: number; title: string; author: { login: string }; state: string; url: string; headRefName: string }) => ({
        number: pr.number,
        title: pr.title,
        author: pr.author?.login || '',
        state: pr.state,
        url: pr.url,
        branch: pr.headRefName,
      }));

      return { success: true, data: formatted };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error listing PRs',
      };
    }
  }

  /**
   * 查看 PR（使用 GitHub CLI）
   * View PR using GitHub CLI
   */
  async viewPR(number: number): Promise<
    GitResult<{
      number: number;
      title: string;
      body: string;
      author: string;
      state: string;
      url: string;
      base: string;
      head: string;
    }>
  > {
    try {
      const { execSync } = await import('child_process');

      const cwd = process.cwd();
      const result = execSync(
        `gh pr view ${number} --json number,title,body,author,state,url,baseRefName,headRefName`,
        {
          encoding: 'utf-8',
          cwd,
        }
      );

      const pr = JSON.parse(result);

      return {
        success: true,
        data: {
          number: pr.number,
          title: pr.title,
          body: pr.body,
          author: pr.author?.login || '',
          state: pr.state,
          url: pr.url,
          base: pr.baseRefName,
          head: pr.headRefName,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error viewing PR',
      };
    }
  }

  /**
   * 检查是否为 GitHub 仓库
   * Check if repository is hosted on GitHub
   */
  async isGitHubRepo(): Promise<GitResult<boolean>> {
    try {
      const remotes = await this.list();
      if (!remotes.success || !remotes.data || remotes.data.length === 0) {
        return { success: true, data: false };
      }

      const isGitHub = remotes.data.some(r =>
        r.refs.fetch.includes('github.com') || r.refs.push.includes('github.com')
      );

      return { success: true, data: isGitHub };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error checking GitHub repo',
      };
    }
  }

  /**
   * 获取 GitHub 仓库信息
   * Get GitHub repository info
   */
  async getGitHubInfo(): Promise<
    GitResult<{
      owner: string;
      repo: string;
      url: string;
    } | null>
  > {
    try {
      const remotes = await this.list();
      if (!remotes.success || !remotes.data || remotes.data.length === 0) {
        return { success: true, data: null };
      }

      const origin = remotes.data.find(r => r.name === 'origin') || remotes.data[0];
      const url = origin.refs.fetch;

      // Parse GitHub URL
      const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      if (!match) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          owner: match[1],
          repo: match[2],
          url: `https://github.com/${match[1]}/${match[2]}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting GitHub info',
      };
    }
  }
}

/**
 * 创建远程操作实例
 * Create remote operations instance
 */
export function createRemote(basePath?: string): GitRemote {
  return new GitRemote(basePath);
}

// 导出类型
export type { GitResult, RemoteInfo, RemoteBranchInfo, PullPushResult } from './//types';
