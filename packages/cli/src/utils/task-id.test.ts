/**
 * Task ID Generator Tests
 * 任务 ID 生成器测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @talos/git module before importing the module under test
const mockGetRootPath = vi.fn();
const mockGetCurrentBranch = vi.fn();
const mockList = vi.fn();

vi.mock('@talos/git', () => ({
  GitRepository: vi.fn().mockImplementation(() => ({
    getRootPath: mockGetRootPath,
    getCurrentBranch: mockGetCurrentBranch,
  })),
  GitWorktree: vi.fn().mockImplementation(() => ({
    list: mockList,
  })),
}));

import { generateTaskId, getWorktreeName } from './task-id';

describe('task-id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateTaskId', () => {
    it('should generate task ID with worktree name', async () => {
      mockGetRootPath.mockResolvedValue({
        success: true,
        data: '/path/to/talos',
      });

      const taskId = await generateTaskId('/path/to/talos', 'git-worktree-support');
      expect(taskId).toBe('talos-git-worktree-support');
    });

    it('should use branch name when worktree name is empty', async () => {
      mockGetRootPath.mockResolvedValue({
        success: true,
        data: '/path/to/talos',
      });
      mockGetCurrentBranch.mockResolvedValue({
        success: true,
        data: 'main',
      });

      const taskId = await generateTaskId('/path/to/talos', '');
      expect(taskId).toBe('talos-main');
    });

    it('should remove ralph/ prefix from branch name', async () => {
      mockGetRootPath.mockResolvedValue({
        success: true,
        data: '/path/to/talos',
      });
      mockGetCurrentBranch.mockResolvedValue({
        success: true,
        data: 'ralph/cli-feature',
      });

      const taskId = await generateTaskId('/path/to/talos', '');
      expect(taskId).toBe('talos-cli-feature');
    });

    it('should throw error when getRootPath fails', async () => {
      mockGetRootPath.mockResolvedValue({
        success: false,
        error: 'Not a git repository',
      });

      await expect(generateTaskId('/path/to/talos', 'feature')).rejects.toThrow(
        'Failed to get repository root: Not a git repository'
      );
    });

    it('should throw error when getCurrentBranch fails', async () => {
      mockGetRootPath.mockResolvedValue({
        success: true,
        data: '/path/to/talos',
      });
      mockGetCurrentBranch.mockResolvedValue({
        success: false,
        error: 'Failed to get branch',
      });

      await expect(generateTaskId('/path/to/talos', '')).rejects.toThrow(
        'Failed to get current branch: Failed to get branch'
      );
    });

    it('should extract repo name from nested path', async () => {
      mockGetRootPath.mockResolvedValue({
        success: true,
        data: '/Users/qingquan/workspaces/personal/talos',
      });

      const taskId = await generateTaskId('/Users/qingquan/workspaces/personal/talos', 'feature');
      expect(taskId).toBe('talos-feature');
    });
  });

  describe('getWorktreeName', () => {
    it('should return worktree name when in a worktree', async () => {
      mockList.mockResolvedValue({
        success: true,
        data: [
          {
            path: '/path/to/talos',
            commit: 'abc123',
            branch: 'main',
            isBare: false,
            isDetached: false,
          },
          {
            path: '/path/to/talos/worktrees/ralph-feature',
            commit: 'def456',
            branch: 'ralph-feature',
            isBare: false,
            isDetached: false,
          },
        ],
      });

      const worktreeName = await getWorktreeName('/path/to/talos/worktrees/ralph-feature');
      expect(worktreeName).toBe('feature');
    });

    it('should return branch name when not in a worktree', async () => {
      mockList.mockResolvedValue({
        success: true,
        data: [
          {
            path: '/path/to/talos',
            commit: 'abc123',
            branch: 'main',
            isBare: false,
            isDetached: false,
          },
        ],
      });

      const worktreeName = await getWorktreeName('/path/to/talos');
      expect(worktreeName).toBe('main');
    });

    it('should return empty string when list fails', async () => {
      mockList.mockResolvedValue({
        success: false,
        error: 'Failed to list worktrees',
      });

      const worktreeName = await getWorktreeName('/path/to/talos');
      expect(worktreeName).toBe('');
    });

    it('should return empty string when path not found in worktrees', async () => {
      mockList.mockResolvedValue({
        success: true,
        data: [
          {
            path: '/path/to/talos',
            commit: 'abc123',
            branch: 'main',
            isBare: false,
            isDetached: false,
          },
        ],
      });

      const worktreeName = await getWorktreeName('/unknown/path');
      expect(worktreeName).toBe('');
    });

    it('should handle worktree without ralph- prefix', async () => {
      mockList.mockResolvedValue({
        success: true,
        data: [
          {
            path: '/path/to/talos/worktrees/feature',
            commit: 'def456',
            branch: 'feature',
            isBare: false,
            isDetached: false,
          },
        ],
      });

      const worktreeName = await getWorktreeName('/path/to/talos/worktrees/feature');
      expect(worktreeName).toBe('feature');
    });
  });
});
