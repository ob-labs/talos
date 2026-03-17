/**
 * Git Commit 模块单元测试
 * Git Commit Module Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GitCommit } from './commit';
import { GitRepository } from './repository';
import { simpleGit } from 'simple-git';

describe('GitCommit', () => {
  let tempDir: string;
  let commit: GitCommit;
  let repo: GitRepository;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-commit-test-'));
    commit = new GitCommit(tempDir);
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

  describe('add', () => {
    it('should add a file to staging area', async () => {
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');

      const result = await commit.add('test.txt');
      expect(result.success).toBe(true);

      const status = await repo.status();
      expect(status.data?.staged).toContain('test.txt');
    });

    it('should add multiple files', async () => {
      fs.writeFileSync(path.join(tempDir, 'test1.txt'), 'content 1');
      fs.writeFileSync(path.join(tempDir, 'test2.txt'), 'content 2');

      const result = await commit.add(['test1.txt', 'test2.txt']);
      expect(result.success).toBe(true);

      const status = await repo.status();
      expect(status.data?.staged).toContain('test1.txt');
      expect(status.data?.staged).toContain('test2.txt');
    });
  });

  describe('addAll', () => {
    it('should add all changes', async () => {
      fs.writeFileSync(path.join(tempDir, 'test1.txt'), 'content 1');
      fs.writeFileSync(path.join(tempDir, 'test2.txt'), 'content 2');

      const result = await commit.addAll();
      expect(result.success).toBe(true);

      const status = await repo.status();
      expect(status.data?.staged.length).toBe(2);
    });
  });

  describe('commit', () => {
    it('should commit staged changes', async () => {
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');
      await commit.add('test.txt');

      const result = await commit.commit('Test commit');
      expect(result.success).toBe(true);
      expect(result.data?.commit).toBeDefined();
    });

    it('should commit with add option', async () => {
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');

      const result = await commit.commit('Test commit with add', { add: true });
      expect(result.success).toBe(true);
      expect(result.data?.commit).toBeDefined();
    });

    it('should amend previous commit', async () => {
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');
      await commit.add('test.txt');

      const result = await commit.commit('Amended commit', { amend: true });
      expect(result.success).toBe(true);
    });
  });

  describe('diff', () => {
    it('should return diff for unstaged changes', async () => {
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');

      const result = await commit.diff();
      expect(result.success).toBe(true);
      expect(result.data).toContain('test.txt');
    });

    it('should return diff for staged changes', async () => {
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');
      await commit.add('test.txt');

      const result = await commit.diff({ cached: true });
      expect(result.success).toBe(true);
      expect(result.data).toContain('test.txt');
    });
  });

  describe('getFileChanges', () => {
    it('should return file changes summary', async () => {
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content\nline 2');

      const result = await commit.getFileChanges();
      expect(result.success).toBe(true);
      expect(result.data?.length).toBeGreaterThan(0);
      expect(result.data?.[0].file).toBe('test.txt');
    });
  });

  describe('reset', () => {
    it('should unstage a file', async () => {
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');
      await commit.add('test.txt');

      let status = await repo.status();
      expect(status.data?.staged).toContain('test.txt');

      const result = await commit.reset('test.txt');
      expect(result.success).toBe(true);

      status = await repo.status();
      expect(status.data?.staged).not.toContain('test.txt');
    });
  });

  describe('checkout', () => {
    it('should discard changes in a file', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(filePath, 'original content');
      await commit.add('test.txt');
      await commit.commit('Add test file');

      // Modify file
      fs.writeFileSync(filePath, 'modified content');

      // Discard changes
      const result = await commit.checkout('test.txt');
      expect(result.success).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toBe('original content');
    });
  });

  describe('stash', () => {
    it('should create a stash', async () => {
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');

      const result = await commit.stash('Test stash');
      expect(result.success).toBe(true);
    });

    it('should create stash with untracked files', async () => {
      fs.writeFileSync(path.join(tempDir, 'untracked.txt'), 'untracked content');

      const result = await commit.stash('Test stash with untracked', { includeUntracked: true });
      expect(result.success).toBe(true);
    });
  });

  describe('listStashes', () => {
    it('should list stashes', async () => {
      // Create a stash first
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');
      await commit.stash('Test stash');

      const result = await commit.listStashes();
      expect(result.success).toBe(true);
      expect(result.data?.length).toBeGreaterThan(0);
    });
  });

  describe('applyStash', () => {
    it('should apply a stash', async () => {
      // Create and apply stash
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'stashed content');
      await commit.stash('Test stash');

      const result = await commit.applyStash(0);
      expect(result.success).toBe(true);
    });
  });

  describe('popStash', () => {
    it('should pop a stash', async () => {
      // Create stash
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'stashed content');
      await commit.stash('Test stash');

      const result = await commit.popStash(0);
      expect(result.success).toBe(true);
    });
  });

  describe('dropStash', () => {
    it('should drop a stash', async () => {
      // Create stash
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');
      await commit.stash('Test stash');

      const result = await commit.dropStash(0);
      expect(result.success).toBe(true);
    });
  });

  describe('showStash', () => {
    it('should show stash diff', async () => {
      // Create stash
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');
      await commit.stash('Test stash');

      const result = await commit.showStash(0);
      expect(result.success).toBe(true);
      expect(result.data).toContain('test.txt');
    });
  });
});
