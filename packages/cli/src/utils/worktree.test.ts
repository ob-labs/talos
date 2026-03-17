/**
 * Worktree 工具函数测试
 * Tests for worktree utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getWorktreePath,
  createWorktree,
  ensureWorktree,
  syncPRDToWorktree,
} from './worktree';
import { GitWorktree, GitBranch } from '@talos/git';
import { mkdirSync, rmSync, copyFileSync, existsSync } from 'fs';
import { join } from 'path';

// Mock GitWorktree
vi.mock('@talos/git', () => ({
  GitWorktree: vi.fn(),
  GitBranch: vi.fn(),
}));

describe('getWorktreePath', () => {
  it('should remove ralph/ prefix from branch name', () => {
    const result = getWorktreePath('/project', 'ralph/feature-branch');
    expect(result).toBe('/project/worktrees/ralph-feature-branch');
  });

  it('should handle branch names without ralph/ prefix', () => {
    const result = getWorktreePath('/project', 'feature-branch');
    expect(result).toBe('/project/worktrees/ralph-feature-branch');
  });

  it('should replace slashes with hyphens for nested branches', () => {
    const result = getWorktreePath('/project', 'feature/sub-branch');
    expect(result).toBe('/project/worktrees/ralph-feature-sub-branch');
  });

  it('should handle ralph/ prefix with nested branches', () => {
    const result = getWorktreePath('/project', 'ralph/feature/sub-branch');
    expect(result).toBe('/project/worktrees/ralph-feature-sub-branch');
  });

  it('should add ralph- prefix to branch name', () => {
    const result = getWorktreePath('/project', 'my-branch');
    expect(result).toBe('/project/worktrees/ralph-my-branch');
  });
});

describe('createWorktree', () => {
  let mockGit: any;
  let mockGitBranch: any;

  beforeEach(() => {
    mockGit = {
      create: vi.fn(),
    };
    mockGitBranch = {
      list: vi.fn(),
    };
    vi.mocked(GitWorktree).mockImplementation(() => mockGit);
    vi.mocked(GitBranch).mockImplementation(() => mockGitBranch);
  });

  it('should create worktree from main branch', async () => {
    mockGitBranch.list.mockResolvedValue({
      success: true,
      data: [{ name: 'main' }, { name: 'develop' }]
    });
    mockGit.create.mockResolvedValue({ success: true, data: null });

    await expect(
      createWorktree(mockGit, '/project', '/path/to/worktree', 'feature-branch')
    ).resolves.not.toThrow();

    expect(mockGitBranch.list).toHaveBeenCalled();
    expect(mockGit.create).toHaveBeenCalledTimes(1);
    expect(mockGit.create).toHaveBeenCalledWith('/path/to/worktree', 'feature-branch', {
      fromBranch: 'main',
      detach: false
    });
  });

  it('should create worktree from master branch when main does not exist', async () => {
    mockGitBranch.list.mockResolvedValue({
      success: true,
      data: [{ name: 'master' }, { name: 'develop' }]
    });
    mockGit.create.mockResolvedValue({ success: true, data: null });

    await expect(
      createWorktree(mockGit, '/project', '/path/to/worktree', 'feature-branch')
    ).resolves.not.toThrow();

    expect(mockGit.create).toHaveBeenCalledWith('/path/to/worktree', 'feature-branch', {
      fromBranch: 'master',
      detach: false
    });
  });

  it('should default to main branch when listing fails', async () => {
    mockGitBranch.list.mockResolvedValue({
      success: false,
      error: 'Failed to list branches'
    });
    mockGit.create.mockResolvedValue({ success: true, data: null });

    await expect(
      createWorktree(mockGit, '/project', '/path/to/worktree', 'feature-branch')
    ).resolves.not.toThrow();

    expect(mockGit.create).toHaveBeenCalledWith('/path/to/worktree', 'feature-branch', {
      fromBranch: 'main',
      detach: false
    });
  });

  it('should throw error when creation fails', async () => {
    mockGitBranch.list.mockResolvedValue({
      success: true,
      data: [{ name: 'main' }]
    });
    mockGit.create.mockResolvedValue({
      success: false,
      error: 'Worktree already exists'
    });

    await expect(
      createWorktree(mockGit, '/project', '/path/to/worktree', 'feature-branch')
    ).rejects.toThrow('创建 worktree 失败：Worktree already exists');
  });
});

describe('ensureWorktree', () => {
  let mockGit: any;
  let mockGitBranch: any;
  let tempDir: string;

  beforeEach(() => {
    mockGitBranch = {
      list: vi.fn(),
    };
    vi.mocked(GitBranch).mockImplementation(() => mockGitBranch);
    tempDir = `/tmp/test-worktree-${Date.now()}`;
    mockGit = {
      isWorktree: vi.fn(),
      list: vi.fn(),
      remove: vi.fn(),
      create: vi.fn(),
    };
    vi.mocked(GitWorktree).mockImplementation(() => mockGit);

    // Suppress console.log during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up temp directory if it exists
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  it('should create new worktree if it does not exist', async () => {
    mockGit.isWorktree.mockResolvedValue({ success: true, data: false });
    mockGitBranch.list.mockResolvedValue({ success: true, data: [{ name: 'main' }] });
    mockGit.create.mockResolvedValue({ success: true, data: null });

    await ensureWorktree('/project', '/worktree', 'feature-branch');

    expect(mockGit.isWorktree).toHaveBeenCalledWith('/worktree');
    expect(mockGit.create).toHaveBeenCalledWith('/worktree', 'feature-branch', {
      fromBranch: 'main',
      detach: false
    });
  });

  it('should reuse existing worktree if branch matches', async () => {
    mockGit.isWorktree.mockResolvedValue({ success: true, data: true });
    mockGit.list.mockResolvedValue({
      success: true,
      data: [{ path: '/worktree', branch: 'feature-branch' }],
    });

    await ensureWorktree('/project', '/worktree', 'feature-branch');

    expect(mockGit.remove).not.toHaveBeenCalled();
    expect(mockGit.create).not.toHaveBeenCalled();
  });

  it('should recreate worktree if branch mismatch', async () => {
    mockGit.isWorktree.mockResolvedValue({ success: true, data: true });
    mockGitBranch.list.mockResolvedValue({ success: true, data: [{ name: 'main' }] });
    mockGit.list.mockResolvedValue({
      success: true,
      data: [{ path: '/worktree', branch: 'old-branch' }],
    });
    mockGit.remove.mockResolvedValue({ success: true, data: null });
    mockGit.create.mockResolvedValue({ success: true, data: null });

    await ensureWorktree('/project', '/worktree', 'feature-branch');

    expect(mockGit.remove).toHaveBeenCalledWith('/worktree');
    expect(mockGit.create).toHaveBeenCalledWith('/worktree', 'feature-branch', {
      fromBranch: 'main',
      detach: false
    });
  });

  it('should fallback to rmSync if git.remove fails', async () => {
    mockGit.isWorktree.mockResolvedValue({ success: true, data: true });
    mockGitBranch.list.mockResolvedValue({ success: true, data: [{ name: 'main' }] });
    mockGit.list.mockResolvedValue({
      success: true,
      data: [{ path: '/worktree', branch: 'old-branch' }],
    });
    mockGit.remove.mockResolvedValue({ success: false, error: 'Remove failed' });
    mockGit.create.mockResolvedValue({ success: true, data: null });

    // Create a test directory to test rmSync
    mkdirSync(tempDir, { recursive: true });

    await ensureWorktree('/project', tempDir, 'feature-branch');

    expect(mockGit.remove).toHaveBeenCalledWith(tempDir);
    expect(mockGit.create).toHaveBeenCalledWith(tempDir, 'feature-branch', {
      fromBranch: 'main',
      detach: false
    });
  });
});

describe('syncPRDToWorktree', () => {
  let tempSourceDir: string;
  let tempWorktreeDir: string;
  const { writeFileSync, copyFileSync } = require('fs');

  beforeEach(() => {
    // Create temporary directories for testing
    tempSourceDir = `/tmp/test-source-${Date.now()}`;
    tempWorktreeDir = `/tmp/test-worktree-${Date.now()}`;

    mkdirSync(join(tempSourceDir, 'ralph', 'test-feature'), { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directories
    try {
      rmSync(tempSourceDir, { recursive: true, force: true });
      rmSync(tempWorktreeDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should copy prd.json to worktree', () => {
    // Create source prd.json in ralph/{name}/
    const sourcePrdPath = join(tempSourceDir, 'ralph', 'test-feature', 'prd.json');
    writeFileSync(sourcePrdPath, '{"test": "data"}');

    syncPRDToWorktree(tempSourceDir, tempWorktreeDir, 'test-feature');

    const targetPrdPath = join(tempWorktreeDir, 'ralph', 'test-feature', 'prd.json');
    expect(existsSync(targetPrdPath)).toBe(true);
  });

  it('should copy progress.txt if it exists', () => {
    // Create source files in ralph/{name}/
    const sourcePrdPath = join(tempSourceDir, 'ralph', 'test-feature', 'prd.json');
    const sourceProgressPath = join(tempSourceDir, 'ralph', 'test-feature', 'progress.txt');
    writeFileSync(sourcePrdPath, '{"test": "data"}');
    writeFileSync(sourceProgressPath, 'progress log');

    syncPRDToWorktree(tempSourceDir, tempWorktreeDir, 'test-feature');

    const targetProgressPath = join(tempWorktreeDir, 'ralph', 'test-feature', 'progress.txt');
    expect(existsSync(targetProgressPath)).toBe(true);
  });

  it('should not copy progress.txt if it does not exist', () => {
    // Create only prd.json in ralph/{name}/
    const sourcePrdPath = join(tempSourceDir, 'ralph', 'test-feature', 'prd.json');
    writeFileSync(sourcePrdPath, '{"test": "data"}');

    syncPRDToWorktree(tempSourceDir, tempWorktreeDir, 'test-feature');

    const targetProgressPath = join(tempWorktreeDir, 'ralph', 'test-feature', 'progress.txt');
    expect(existsSync(targetProgressPath)).toBe(false);
  });

  it('should create target directory if it does not exist', () => {
    // Create source prd.json in ralph/{name}/
    const sourcePrdPath = join(tempSourceDir, 'ralph', 'test-feature', 'prd.json');
    writeFileSync(sourcePrdPath, '{"test": "data"}');

    // Don't create target directory - let the function create it
    syncPRDToWorktree(tempSourceDir, tempWorktreeDir, 'test-feature');

    const targetPrdPath = join(tempWorktreeDir, 'ralph', 'test-feature', 'prd.json');
    expect(existsSync(targetPrdPath)).toBe(true);
  });
});
