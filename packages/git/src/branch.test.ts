/**
 * Git Branch 模块单元测试
 * Git Branch Module Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GitBranch } from './branch';
import { GitRepository } from './repository';
import { simpleGit } from 'simple-git';

describe('GitBranch', () => {
  let tempDir: string;
  let branch: GitBranch;
  let repo: GitRepository;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-branch-test-'));
    branch = new GitBranch(tempDir);
    repo = new GitRepository(tempDir);
    await repo.init();

    // Configure git user
    const git = simpleGit(tempDir);
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');

    // Create initial commit
    fs.writeFileSync(path.join(tempDir, 'initial.txt'), 'initial');
    await git.add('.');
    await git.commit('Initial commit');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('list', () => {
    it('should list all branches', async () => {
      const result = await branch.list();
      expect(result.success).toBe(true);
      expect(result.data?.length).toBeGreaterThanOrEqual(1);
    });

    it('should list remote branches', async () => {
      const result = await branch.list({ remote: true });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create a new branch', async () => {
      const result = await branch.create('feature-branch');
      expect(result.success).toBe(true);

      const branches = await branch.list();
      expect(branches.data?.some(b => b.name === 'feature-branch')).toBe(true);
    });

    it('should create and checkout a branch', async () => {
      const result = await branch.create('feature-branch', undefined, { checkout: true });
      expect(result.success).toBe(true);

      const current = await branch.getCurrent();
      expect(current.data).toBe('feature-branch');
    });

    it('should create branch from specific commit', async () => {
      const result = await branch.create('from-master', 'master');
      expect(result.success).toBe(true);

      const branches = await branch.list();
      expect(branches.data?.some(b => b.name === 'from-master')).toBe(true);
    });
  });

  describe('switch', () => {
    it('should switch to another branch', async () => {
      // Create a branch first
      await branch.create('test-branch');

      // Switch to it
      const result = await branch.switch('test-branch');
      expect(result.success).toBe(true);

      const current = await branch.getCurrent();
      expect(current.data).toBe('test-branch');
    });

    it('should create and switch to new branch', async () => {
      const result = await branch.switch('new-branch', { create: true });
      expect(result.success).toBe(true);

      const current = await branch.getCurrent();
      expect(current.data).toBe('new-branch');
    });
  });

  describe('delete', () => {
    it('should delete a branch', async () => {
      // Create a branch first
      await branch.create('delete-me');

      // Verify it exists
      let branches = await branch.list();
      expect(branches.data?.some(b => b.name === 'delete-me')).toBe(true);

      // Delete it
      const result = await branch.delete('delete-me');
      expect(result.success).toBe(true);

      // Verify it's gone
      branches = await branch.list();
      expect(branches.data?.some(b => b.name === 'delete-me')).toBe(false);
    });

    it('should force delete a branch with unmerged changes', async () => {
      // Create and switch to a branch
      await branch.create('unmerged-branch', undefined, { checkout: true });

      // Make a commit
      fs.writeFileSync(path.join(tempDir, 'unmerged.txt'), 'unmerged content');
      const git = simpleGit(tempDir);
      await git.add('.');
      await git.commit('Unmerged commit');

      // Switch back to master
      await branch.switch('master');

      // Force delete
      const result = await branch.delete('unmerged-branch', true);
      expect(result.success).toBe(true);
    });
  });

  describe('rename', () => {
    it('should rename a branch', async () => {
      // Create a branch
      await branch.create('old-name');

      // Rename it
      const result = await branch.rename('old-name', 'new-name');
      expect(result.success).toBe(true);

      const branches = await branch.list();
      expect(branches.data?.some(b => b.name === 'old-name')).toBe(false);
      expect(branches.data?.some(b => b.name === 'new-name')).toBe(true);
    });
  });

  describe('getCurrent', () => {
    it('should return current branch name', async () => {
      const result = await branch.getCurrent();
      expect(result.success).toBe(true);
      expect(result.data).toBe('master');
    });
  });

  describe('exists', () => {
    it('should return true for existing branch', async () => {
      const result = await branch.exists('master');
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should return false for non-existing branch', async () => {
      const result = await branch.exists('nonexistent');
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });
  });

  describe('getUpstream', () => {
    it('should return null for branch without upstream', async () => {
      const result = await branch.getUpstream('master');
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('setUpstream', () => {
    it('should set upstream for a branch', async () => {
      // This would require a remote, so we just test the error handling
      const result = await branch.setUpstream('master', 'origin', 'master');
      // Will fail because no remote exists
      expect(result.success).toBe(false);
    });
  });

  describe('isMergedInto', () => {
    it('should return isMerged: true when branch is merged into target', async () => {
      // Create a feature branch
      await branch.create('feature-branch', undefined, { checkout: true });

      // Make a commit on feature branch
      fs.writeFileSync(path.join(tempDir, 'feature.txt'), 'feature content');
      const git = simpleGit(tempDir);
      await git.add('.');
      await git.commit('Feature commit');

      // Switch back to master
      await branch.switch('master');

      // Merge feature branch
      await branch.merge('feature-branch');

      // Check if feature branch is merged into master
      const result = await branch.isMergedInto('feature-branch', 'master');

      expect(result.success).toBe(true);
      expect(result.data?.isMerged).toBe(true);
      expect(result.data?.unmergedCount).toBe(0);
    });

    it('should return isMerged: false with unmerged count when branch has unmerged commits', async () => {
      // Create a feature branch
      await branch.create('feature-unmerged', undefined, { checkout: true });

      // Make commits on feature branch
      fs.writeFileSync(path.join(tempDir, 'feature1.txt'), 'feature content 1');
      const git = simpleGit(tempDir);
      await git.add('.');
      await git.commit('Feature commit 1');

      fs.writeFileSync(path.join(tempDir, 'feature2.txt'), 'feature content 2');
      await git.add('.');
      await git.commit('Feature commit 2');

      // Switch back to master
      await branch.switch('master');

      // Check if feature branch is merged into master
      const result = await branch.isMergedInto('feature-unmerged', 'master');

      expect(result.success).toBe(true);
      expect(result.data?.isMerged).toBe(false);
      expect(result.data?.unmergedCount).toBeGreaterThan(0);
    });

    it('should return isMerged: true when checking master against itself', async () => {
      const result = await branch.isMergedInto('master', 'master');

      expect(result.success).toBe(true);
      expect(result.data?.isMerged).toBe(true);
      expect(result.data?.unmergedCount).toBe(0);
    });

    it('should handle error when branch does not exist', async () => {
      const result = await branch.isMergedInto('nonexistent-branch', 'master');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle error when target branch does not exist', async () => {
      await branch.create('feature-branch');

      const result = await branch.isMergedInto('feature-branch', 'nonexistent-target');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
