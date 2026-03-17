/**
 * Git Worktree 模块单元测试
 * Git Worktree Module Unit Tests
 *
 * 术语映射 / Terminology Mapping:
 * - workspace: 仓库（Git repository）
 * - worktree: Git worktree（功能分支的独立工作目录）
 * - story: user story（用户故事，PRD 中的任务单元）
 *
 * 此测试文件验证 GitWorktree 类的功能，其为 Feat 提供底层 Git worktree 支持
 * This test file verifies the GitWorktree class functionality, which provides low-level Git worktree support for Feat
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GitWorktree } from './worktree';
import { GitRepository } from './repository';
import { simpleGit } from 'simple-git';

describe('GitWorktree', () => {
  let tempDir: string;
  let worktreeDir: string;
  let worktree: GitWorktree;
  let repo: GitRepository;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-worktree-test-'));
    worktreeDir = path.join(os.tmpdir(), `git-feat-work-${Date.now()}`);
    worktree = new GitWorktree(tempDir);
    repo = new GitRepository(tempDir);
    await repo.init();

    // Create initial commit
    const git = simpleGit(tempDir);
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

  describe('list', () => {
    it('should return main worktree', async () => {
      const result = await worktree.list();
      expect(result.success).toBe(true);
      expect(result.data?.length).toBeGreaterThanOrEqual(1);
      expect(result.data?.[0].path).toBe(tempDir);
    });
  });

  describe('create', () => {
    it('should create a new worktree with new branch (feat)', async () => {
      const result = await worktree.create(worktreeDir, 'feat-branch');
      expect(result.success).toBe(true);
      expect(fs.existsSync(worktreeDir)).toBe(true);
      expect(fs.existsSync(path.join(worktreeDir, '.git'))).toBe(true);

      // Verify it's listed
      const listResult = await worktree.list();
      expect(listResult.data?.some(wt => wt.path === worktreeDir)).toBe(true);
    });

    it('should create detached worktree (feat)', async () => {
      const result = await worktree.create(worktreeDir, undefined, { detach: true });
      expect(result.success).toBe(true);
      expect(fs.existsSync(worktreeDir)).toBe(true);
    });
  });

  describe('createFromBranch', () => {
    it('should create worktree from existing branch (feat)', async () => {
      // First create a branch
      const git = simpleGit(tempDir);
      await git.checkoutBranch('existing-feat', 'master');
      await git.checkout('master');

      const result = await worktree.createFromBranch(worktreeDir, 'existing-feat');
      expect(result.success).toBe(true);
      expect(fs.existsSync(worktreeDir)).toBe(true);
    });
  });

  describe('remove', () => {
    it('should remove a worktree (feat)', async () => {
      // Create first
      await worktree.create(worktreeDir, 'test-feat');
      expect(fs.existsSync(worktreeDir)).toBe(true);

      // Then remove
      const result = await worktree.remove(worktreeDir);
      expect(result.success).toBe(true);
    });

    it('should force remove a worktree (feat) with uncommitted changes', async () => {
      // Create worktree
      await worktree.create(worktreeDir, 'test-feat');

      // Add uncommitted file
      fs.writeFileSync(path.join(worktreeDir, 'uncommitted.txt'), 'test');

      // Force remove
      const result = await worktree.remove(worktreeDir, true);
      expect(result.success).toBe(true);
    });
  });

  describe('isWorktree', () => {
    it('should return true for valid worktree (feat) path', async () => {
      await worktree.create(worktreeDir, 'test-feat');

      const result = await worktree.isWorktree(worktreeDir);
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should return false for non-worktree path', async () => {
      const result = await worktree.isWorktree('/nonexistent/path');
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });
  });

  describe('lock/unlock', () => {
    it('should lock and unlock a worktree (feat)', async () => {
      // Create worktree first
      await worktree.create(worktreeDir, 'test-feat');

      // Lock
      const lockResult = await worktree.lock(worktreeDir, 'Testing lock');
      expect(lockResult.success).toBe(true);

      // Unlock
      const unlockResult = await worktree.unlock(worktreeDir);
      expect(unlockResult.success).toBe(true);
    });
  });

  describe('move', () => {
    it('should move a worktree (feat)', async () => {
      const newWorktreeDir = path.join(os.tmpdir(), `git-feat-moved-${Date.now()}`);

      // Create worktree
      await worktree.create(worktreeDir, 'test-feat');

      // Move
      const result = await worktree.move(worktreeDir, newWorktreeDir);
      expect(result.success).toBe(true);

      // Cleanup
      if (fs.existsSync(newWorktreeDir)) {
        fs.rmSync(newWorktreeDir, { recursive: true, force: true });
      }
    });
  });
});
