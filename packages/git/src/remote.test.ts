/**
 * Git Remote 模块单元测试
 * Git Remote Module Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GitRemote } from './remote';
import { GitRepository } from './repository';
import { simpleGit } from 'simple-git';

describe('GitRemote', () => {
  let tempDir: string;
  let remote: GitRemote;
  let repo: GitRepository;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-remote-test-'));
    remote = new GitRemote(tempDir);
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
    it('should return empty list for repo without remotes', async () => {
      const result = await remote.list();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should list added remotes', async () => {
      await remote.add('origin', 'https://github.com/test/repo.git');

      const result = await remote.list();
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].name).toBe('origin');
    });
  });

  describe('add', () => {
    it('should add a remote', async () => {
      const result = await remote.add('origin', 'https://github.com/test/repo.git');
      expect(result.success).toBe(true);

      const remotes = await remote.list();
      expect(remotes.data?.some(r => r.name === 'origin')).toBe(true);
    });

    it('should add a remote with fetch', async () => {
      const result = await remote.add('origin', 'https://github.com/test/repo.git', { fetch: true });
      // Will fail because remote doesn't exist, but tests the option
      expect(result.success).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove a remote', async () => {
      // Add first
      await remote.add('origin', 'https://github.com/test/repo.git');

      // Remove
      const result = await remote.remove('origin');
      expect(result.success).toBe(true);

      const remotes = await remote.list();
      expect(remotes.data?.length).toBe(0);
    });
  });

  describe('rename', () => {
    it('should rename a remote', async () => {
      // Add first
      await remote.add('origin', 'https://github.com/test/repo.git');

      // Rename
      const result = await remote.rename('origin', 'upstream');
      expect(result.success).toBe(true);

      const remotes = await remote.list();
      expect(remotes.data?.some(r => r.name === 'origin')).toBe(false);
      expect(remotes.data?.some(r => r.name === 'upstream')).toBe(true);
    });
  });

  describe('setUrl/getUrl', () => {
    it('should set and get remote URL', async () => {
      // Add first
      await remote.add('origin', 'https://github.com/test/repo.git');

      // Set new URL
      const setResult = await remote.setUrl('origin', 'https://github.com/new/repo.git');
      expect(setResult.success).toBe(true);

      // Get URL
      const getResult = await remote.getUrl('origin');
      expect(getResult.success).toBe(true);
      expect(getResult.data).toBe('https://github.com/new/repo.git');
    });
  });

  describe('isGitHubRepo', () => {
    it('should return true for GitHub remote', async () => {
      await remote.add('origin', 'https://github.com/test/repo.git');

      const result = await remote.isGitHubRepo();
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should return false for non-GitHub remote', async () => {
      await remote.add('origin', 'https://gitlab.com/test/repo.git');

      const result = await remote.isGitHubRepo();
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it('should return false for repo without remotes', async () => {
      const result = await remote.isGitHubRepo();
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });
  });

  describe('getGitHubInfo', () => {
    it('should return GitHub info for GitHub remote', async () => {
      await remote.add('origin', 'https://github.com/testuser/testrepo.git');

      const result = await remote.getGitHubInfo();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        owner: 'testuser',
        repo: 'testrepo',
        url: 'https://github.com/testuser/testrepo',
      });
    });

    it('should return null for non-GitHub remote', async () => {
      await remote.add('origin', 'https://gitlab.com/test/repo.git');

      const result = await remote.getGitHubInfo();
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('getDefaultBranch', () => {
    it('should return error for repo without remote', async () => {
      const result = await remote.getDefaultBranch();
      expect(result.success).toBe(false);
    });
  });
});
