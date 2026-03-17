/**
 * Git 模块类型定义
 * Git Module Type Definitions
 */

/**
 * Git 操作结果标准格式
 * Standard result format for Git operations
 */
export interface GitResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 仓库状态信息
 * Repository status information
 */
export interface RepositoryStatus {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
  conflicted: string[];
  staged: string[];
  notStaged: string[];
}

/**
 * 提交信息
 * Commit information
 */
export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
  refs: string;
  body: string;
}

/**
 * 文件变更信息
 * File change information
 */
export interface FileChange {
  file: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'unknown';
  additions: number;
  deletions: number;
}

/**
 * 差异信息
 * Diff information
 */
export interface DiffInfo {
  file: string;
  status: string;
  additions: number;
  deletions: number;
  diff: string;
}

/**
 * 分支信息
 * Branch information
 */
export interface BranchInfo {
  name: string;
  current: boolean;
  commit: string;
  label: string;
}

/**
 * Worktree 信息
 * Worktree information
 */
export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  isBare: boolean;
  isDetached: boolean;
}

/**
 * 远程信息
 * Remote information
 */
export interface RemoteInfo {
  name: string;
  refs: {
    fetch: string;
    push: string;
  };
}

/**
 * 远程分支信息
 * Remote branch information
 */
export interface RemoteBranchInfo {
  name: string;
  remote: string;
}

/**
 * Pull/Push 结果
 * Pull/Push result
 */
export interface PullPushResult {
  remoteMessages: {
    all: string[];
  };
  summary?: {
    changes: number;
    insertions: number;
    deletions: number;
  };
  pulled?: string[];
  pushed?: string[];
}

/**
 * Stash 信息
 * Stash information
 */
export interface StashInfo {
  index: number;
  hash: string;
  message: string;
  date: string;
}
