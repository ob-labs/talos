/**
 * Git Worktree 扫描模块单元测试
 * Git Worktree Scanner Module Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { scanWorkspaceWorktrees, WorktreeScanner } from './worktree-scanner';
import { GitWorktree } from './worktree';
import { simpleGit } from 'simple-git';

describe('WorktreeScanner', () => {
  let tempDir: string;
  let worktreeDir: string;
  let gitWorktree: GitWorktree;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-worktree-scan-test-'));
    worktreeDir = path.join(tempDir, 'worktrees', `work-${Date.now()}`);
    gitWorktree = new GitWorktree(tempDir);

    // Initialize repository
    const git = simpleGit(tempDir);
    await git.init();
    fs.writeFileSync(path.join(tempDir, 'initial.txt'), 'initial');
    await git.add('.');
    await git.commit('Initial commit');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (fs.existsSync(worktreeDir)) {
      fs.rmSync(worktreeDir, { recursive: true, force: true });
    }
  });

  describe('scanWorkspaceWorktrees', () => {
    it('should return empty array when no additional worktrees exist', async () => {
      const result = await scanWorkspaceWorktrees(tempDir);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return all additional worktrees (global, any path)', async () => {
      await gitWorktree.create(worktreeDir, 'feature-branch');

      const result = await scanWorkspaceWorktrees(tempDir);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].path).toContain('/worktrees/work-');
      expect(result.data?.[0].branch).toBe('feature-branch');
      expect(result.data?.[0].isDetached).toBe(false);
    });

    it('should include isDetached flag for detached worktrees', async () => {
      await gitWorktree.create(worktreeDir, undefined, { detach: true });

      const result = await scanWorkspaceWorktrees(tempDir);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].isDetached).toBe(true);
    });

    it('should filter out main worktree', async () => {
      await gitWorktree.create(worktreeDir, 'feature-branch');

      const result = await scanWorkspaceWorktrees(tempDir);

      expect(result.success).toBe(true);
      // Main worktree (tempDir) should not be included
      const mainResolved = path.resolve(tempDir);
      expect(result.data?.every((wt) => path.resolve(wt.path) !== mainResolved)).toBe(true);
      expect(result.data?.length).toBe(1);
    });

    it('should return error for invalid workspace path', async () => {
      const result = await scanWorkspaceWorktrees('/nonexistent/path');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle multiple worktrees', async () => {
      const worktree2Dir = path.join(tempDir, 'worktrees', `work2-${Date.now()}`);

      await gitWorktree.create(worktreeDir, 'feature-branch-1');
      await gitWorktree.create(worktree2Dir, 'feature-branch-2');

      const result = await scanWorkspaceWorktrees(tempDir);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
      expect(
        result.data?.some((wt) => wt.branch === 'feature-branch-1')
      ).toBe(true);
      expect(
        result.data?.some((wt) => wt.branch === 'feature-branch-2')
      ).toBe(true);

      fs.rmSync(worktree2Dir, { recursive: true, force: true });
    });
  });

  describe('WorktreeScanner class', () => {
    it('should scan worktrees using instance method', async () => {
      await gitWorktree.create(worktreeDir, 'test-branch');

      const scanner = new WorktreeScanner(tempDir);
      const result = await scanner.scan();

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].branch).toBe('test-branch');
    });
  });
});
