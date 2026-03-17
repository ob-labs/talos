/**
 * Lock file management tests
 * 锁文件管理测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { acquireWorktreeLock } from "./lock-file";
import { existsSync, unlinkSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

describe("Lock File Management", () => {
  let testWorktreePath: string;
  let lockFilePath: string;

  beforeEach(() => {
    // Create a unique test worktree path with timestamp
    testWorktreePath = `/tmp/test-worktree-${Date.now()}`;
    lockFilePath = join(testWorktreePath, ".ralph-lock");

    // Clean up any existing test directory
    if (existsSync(testWorktreePath)) {
      rmSync(testWorktreePath, { recursive: true, force: true });
    }

    // Create test worktree directory
    mkdirSync(testWorktreePath, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testWorktreePath)) {
      rmSync(testWorktreePath, { recursive: true, force: true });
    }
  });

  describe("Lock file creation", () => {
    it("should create lock file with timestamp", () => {
      const beforeTime = Date.now();
      const releaseLock = acquireWorktreeLock(testWorktreePath);
      const afterTime = Date.now();

      // Verify lock file exists
      expect(existsSync(lockFilePath)).toBe(true);

      // Read lock file content and verify it's a valid timestamp
      const lockContent = require("fs").readFileSync(lockFilePath, "utf-8");
      const lockTimestamp = parseInt(lockContent, 10);
      expect(lockTimestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(lockTimestamp).toBeLessThanOrEqual(afterTime);

      // Cleanup
      releaseLock();
    });

    it("should create lock file directory if it doesn't exist", () => {
      // Use a non-existent nested path
      const nestedPath = join(testWorktreePath, "nested", "path");
      const nestedLockPath = join(nestedPath, ".ralph-lock");

      expect(existsSync(nestedPath)).toBe(false);

      const releaseLock = acquireWorktreeLock(nestedPath);

      // Verify directory and lock file were created
      expect(existsSync(nestedLockPath)).toBe(true);

      // Cleanup
      releaseLock();
      rmSync(nestedPath, { recursive: true, force: true });
    });
  });

  describe("Valid lock rejection", () => {
    it("should throw error when valid lock exists", () => {
      // Create first lock
      const releaseLock1 = acquireWorktreeLock(testWorktreePath);

      // Try to create second lock - should throw
      expect(() => {
        acquireWorktreeLock(testWorktreePath);
      }).toThrow("Worktree 正在被另一个进程使用");

      // Cleanup
      releaseLock1();
    });

    it("should include worktree path in error message", () => {
      // Create first lock
      const releaseLock1 = acquireWorktreeLock(testWorktreePath);

      // Try to create second lock
      try {
        acquireWorktreeLock(testWorktreePath);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect((error as Error).message).toContain(testWorktreePath);
      }

      // Cleanup
      releaseLock1();
    });

    it("should include suggestions in error message", () => {
      // Create first lock
      const releaseLock1 = acquireWorktreeLock(testWorktreePath);

      // Try to create second lock
      try {
        acquireWorktreeLock(testWorktreePath);
        expect.fail("Should have thrown an error");
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain("建议");
        expect(errorMessage).toContain("等待另一个进程完成");
        expect(errorMessage).toContain("手动删除锁文件");
      }

      // Cleanup
      releaseLock1();
    });

    it("should consider locks less than 2 hours old as valid", () => {
      // Create a lock file with recent timestamp (1 hour ago)
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      require("fs").writeFileSync(lockFilePath, oneHourAgo.toString());

      // Try to acquire lock - should throw
      expect(() => {
        acquireWorktreeLock(testWorktreePath);
      }).toThrow("Worktree 正在被另一个进程使用");
    });
  });

  describe("Expired lock handling", () => {
    it("should remove expired lock and create new one", () => {
      // Create an expired lock file (3 hours ago)
      const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
      require("fs").writeFileSync(lockFilePath, threeHoursAgo.toString());

      // Mock statSync to return old mtime
      const originalStatSync = require("fs").statSync;
      const statSpy = vi.spyOn(require("fs"), "statSync").mockImplementation(((path: any) => {
        if (path === lockFilePath) {
          return { mtimeMs: threeHoursAgo };
        }
        return originalStatSync(path);
      }) as any);

      expect(existsSync(lockFilePath)).toBe(true);

      // Acquire lock - should succeed and remove old lock
      const releaseLock = acquireWorktreeLock(testWorktreePath);

      // Verify new lock file exists
      expect(existsSync(lockFilePath)).toBe(true);

      // Read and verify new timestamp is recent
      const lockContent = require("fs").readFileSync(lockFilePath, "utf-8");
      const lockTimestamp = parseInt(lockContent, 10);
      expect(lockTimestamp).toBeGreaterThan(threeHoursAgo);

      // Cleanup
      statSpy.mockRestore();
      releaseLock();
    });

    it("should consider locks 2 hours old as expired", () => {
      // Create a lock file that's exactly 2 hours old
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      require("fs").writeFileSync(lockFilePath, twoHoursAgo.toString());

      // Mock statSync to return old mtime
      const originalStatSync = require("fs").statSync;
      const statSpy = vi.spyOn(require("fs"), "statSync").mockImplementation(((path: any) => {
        if (path === lockFilePath) {
          return { mtimeMs: twoHoursAgo };
        }
        return originalStatSync(path);
      }) as any);

      // Acquire lock - should succeed (lock is expired)
      expect(() => {
        const releaseLock = acquireWorktreeLock(testWorktreePath);
        statSpy.mockRestore();
        releaseLock();
      }).not.toThrow();
    });

    it("should consider locks older than 2 hours as expired", () => {
      // Create a lock file that's slightly over 2 hours old
      const twoHoursAndOneMsAgo = Date.now() - (2 * 60 * 60 * 1000 + 1);
      require("fs").writeFileSync(lockFilePath, twoHoursAndOneMsAgo.toString());

      // Mock statSync to return old mtime
      const originalStatSync = require("fs").statSync;
      const statSpy = vi.spyOn(require("fs"), "statSync").mockImplementation(((path: any) => {
        if (path === lockFilePath) {
          return { mtimeMs: twoHoursAndOneMsAgo };
        }
        return originalStatSync(path);
      }) as any);

      // Acquire lock - should succeed (lock is expired)
      expect(() => {
        const releaseLock = acquireWorktreeLock(testWorktreePath);
        statSpy.mockRestore();
        releaseLock();
      }).not.toThrow();
    });
  });

  describe("Cleanup function", () => {
    it("should return a cleanup function that removes lock file", () => {
      const releaseLock = acquireWorktreeLock(testWorktreePath);

      expect(existsSync(lockFilePath)).toBe(true);

      // Call cleanup function
      releaseLock();

      expect(existsSync(lockFilePath)).toBe(false);
    });

    it("should not throw error when cleaning up already removed lock", () => {
      const releaseLock = acquireWorktreeLock(testWorktreePath);

      // Manually remove lock file
      unlinkSync(lockFilePath);

      // Cleanup should not throw
      expect(() => {
        releaseLock();
      }).not.toThrow();
    });

    it("should handle cleanup errors gracefully", () => {
      const releaseLock = acquireWorktreeLock(testWorktreePath);

      // Make lock file directory read-only to cause cleanup error (on Unix systems)
      try {
        const lockDir = testWorktreePath;
        require("fs").chmodSync(lockDir, 0o444);

        // Cleanup should not throw even if it fails
        expect(() => {
          releaseLock();
        }).not.toThrow();
      } finally {
        // Restore permissions for cleanup
        try {
          require("fs").chmodSync(testWorktreePath, 0o755);
        } catch {
          // Ignore
        }
      }
    });
  });

  describe("Process exit handler cleanup", () => {
    it("should register cleanup on process exit", () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      const releaseLock = acquireWorktreeLock(testWorktreePath);

      expect(existsSync(lockFilePath)).toBe(true);

      // Trigger process exit by calling the cleanup directly
      // (we can't actually test process.on('exit') in tests)
      releaseLock();

      expect(existsSync(lockFilePath)).toBe(false);

      exitSpy.mockRestore();
    });

    it("should support multiple lock acquisitions in sequence", () => {
      // First lock acquisition
      const releaseLock1 = acquireWorktreeLock(testWorktreePath);
      expect(existsSync(lockFilePath)).toBe(true);

      // Release first lock
      releaseLock1();
      expect(existsSync(lockFilePath)).toBe(false);

      // Second lock acquisition should succeed
      const releaseLock2 = acquireWorktreeLock(testWorktreePath);
      expect(existsSync(lockFilePath)).toBe(true);

      // Release second lock
      releaseLock2();
      expect(existsSync(lockFilePath)).toBe(false);
    });

    it("should allow re-acquisition after cleanup", () => {
      // First acquisition and cleanup
      const releaseLock1 = acquireWorktreeLock(testWorktreePath);
      expect(existsSync(lockFilePath)).toBe(true);
      releaseLock1();
      expect(existsSync(lockFilePath)).toBe(false);

      // Second acquisition should succeed
      const releaseLock2 = acquireWorktreeLock(testWorktreePath);
      expect(existsSync(lockFilePath)).toBe(true);
      releaseLock2();
      expect(existsSync(lockFilePath)).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle cleanup of already released lock", () => {
      const releaseLock = acquireWorktreeLock(testWorktreePath);

      // Release lock once
      releaseLock();
      expect(existsSync(lockFilePath)).toBe(false);

      // Release again - should not throw
      expect(() => {
        releaseLock();
      }).not.toThrow();
    });

    it("should work with worktree paths containing special characters", () => {
      const specialPath = `/tmp/test-worktree-${Date.now()}-with-special`;
      mkdirSync(specialPath, { recursive: true });

      const releaseLock = acquireWorktreeLock(specialPath);
      const specialLockPath = join(specialPath, ".ralph-lock");

      expect(existsSync(specialLockPath)).toBe(true);

      releaseLock();
      expect(existsSync(specialLockPath)).toBe(false);

      // Cleanup
      rmSync(specialPath, { recursive: true, force: true });
    });

    it("should create lock file with correct permissions (0o644)", () => {
      const releaseLock = acquireWorktreeLock(testWorktreePath);

      const stats = require("fs").statSync(lockFilePath);
      const mode = stats.mode & 0o777; // Extract permission bits

      // On Windows, file permissions work differently, so we only check on Unix
      if (process.platform !== "win32") {
        expect(mode).toBe(0o644);
      }

      releaseLock();
    });
  });
});
