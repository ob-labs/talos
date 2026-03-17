/**
 * Git Repository 模块单元测试
 * Git Repository Module Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GitRepository } from './repository';
import { simpleGit } from 'simple-git';

describe('GitRepository', () => {
  let tempDir: string;
  let repo: GitRepository;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-repo-test-'));
    repo = new GitRepository(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('isRepo', () => {
    it('should return false for non-git directory', async () => {
      const result = await repo.isRepo();
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it('should return true for initialized git directory', async () => {
      await repo.init();
      const result = await repo.isRepo();
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });
  });

  describe('init', () => {
    it('should initialize a git repository', async () => {
      const result = await repo.init();
      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.git'))).toBe(true);
    });

    it('should initialize a bare repository', async () => {
      const result = await repo.init(true);
      expect(result.success).toBe(true);
      // Bare repo doesn't have .git folder, the folder itself is the git repo
      expect(fs.existsSync(path.join(tempDir, 'HEAD'))).toBe(true);
    });
  });

  describe('status', () => {
    it('should return error for non-git directory', async () => {
      const result = await repo.status();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return status for initialized repo', async () => {
      await repo.init();
      const result = await repo.status();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.branch).toBeDefined();
    });
  });

  describe('log', () => {
    it('should return empty log for new repo', async () => {
      await repo.init();
      const result = await repo.log();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return commits after creating some', async () => {
      await repo.init();
      const git = simpleGit(tempDir);

      // Create a file and commit
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');
      await git.add('.');
      await git.commit('Initial commit');

      const result = await repo.log();
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].message).toBe('Initial commit');
    });

    it('should respect maxCount option', async () => {
      await repo.init();
      const git = simpleGit(tempDir);

      // Create multiple commits
      for (let i = 0; i < 5; i++) {
        fs.writeFileSync(path.join(tempDir, `test${i}.txt`), `content ${i}`);
        await git.add('.');
        await git.commit(`Commit ${i}`);
      }

      const result = await repo.log({ maxCount: 3 });
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(3);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      await repo.init();
      const result = await repo.getCurrentBranch();
      expect(result.success).toBe(true);
      expect(result.data).toBe('master'); // or main depending on git version
    });

    it('should return error for non-git directory', async () => {
      const result = await repo.getCurrentBranch();
      expect(result.success).toBe(false);
    });
  });

  describe('getRootPath', () => {
    it('should return root path for git repo', async () => {
      await repo.init();
      const result = await repo.getRootPath();
      expect(result.success).toBe(true);
      expect(result.data).toBe(tempDir);
    });

    it('should return error for non-git directory', async () => {
      const result = await repo.getRootPath();
      expect(result.success).toBe(false);
    });
  });

  describe('config', () => {
    it('should set and get config values', async () => {
      await repo.init();

      const setResult = await repo.setConfig('user.name', 'Test User');
      expect(setResult.success).toBe(true);

      const getResult = await repo.getConfig('user.name');
      expect(getResult.success).toBe(true);
      expect(getResult.data).toBe('Test User');
    });
  });

  describe('getRawGit', () => {
    it('should return simple-git instance', () => {
      const rawGit = repo.getRawGit();
      expect(rawGit).toBeDefined();
      expect(typeof rawGit.init).toBe('function');
    });
  });
});
