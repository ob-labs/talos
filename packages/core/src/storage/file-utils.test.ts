import fs from "fs/promises";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  cleanupSessionFiles,
  getPidPath,
  getSocketPath,
} from "./file-utils";

describe("file-utils", () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temp directory for testing
    testDir = `${os.tmpdir()}/file-utils-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("cleanupSessionFiles", () => {
    it("should delete .sock and .pid files but keep .json", async () => {
      const sessionId = "test-session";
      const sessionsDir = path.join(testDir, "sessions");

      // Create test files
      await fs.mkdir(sessionsDir, { recursive: true });
      await fs.writeFile(path.join(sessionsDir, `${sessionId}.sock`), "socket");
      await fs.writeFile(path.join(sessionsDir, `${sessionId}.pid`), "12345");
      await fs.writeFile(path.join(sessionsDir, `${sessionId}.json`), '{"test": true}');

      await cleanupSessionFiles(sessionId, testDir);

      // Check that .sock and .pid are deleted
      const sockExists = await fs.access(path.join(sessionsDir, `${sessionId}.sock`)).then(() => true).catch(() => false);
      const pidExists = await fs.access(path.join(sessionsDir, `${sessionId}.pid`)).then(() => true).catch(() => false);
      const jsonExists = await fs.access(path.join(sessionsDir, `${sessionId}.json`)).then(() => true).catch(() => false);

      expect(sockExists).toBe(false);
      expect(pidExists).toBe(false);
      expect(jsonExists).toBe(true);
    });

    it("should not throw if files don't exist", async () => {
      // Should not throw
      await cleanupSessionFiles("nonexistent", testDir);
    });
  });

  describe("getPidPath", () => {
    it("should return correct PID file path", () => {
      const pidPath = getPidPath("test-session", testDir);
      expect(pidPath).toContain("test-session.pid");
      expect(pidPath).toContain("sessions");
      expect(pidPath).toContain(testDir);
    });

    it("should use default path when no basePath provided", () => {
      const pidPath = getPidPath("test-session");
      expect(pidPath).toContain("test-session.pid");
      expect(pidPath).toContain(".talos");
      expect(pidPath).toContain("sessions");
    });
  });

  describe("getSocketPath", () => {
    it("should return correct socket file path", () => {
      const socketPath = getSocketPath("test-session", testDir);
      expect(socketPath).toContain("test-session.sock");
      expect(socketPath).toContain("sessions");
      expect(socketPath).toContain(testDir);
    });

    it("should use default path when no basePath provided", () => {
      const socketPath = getSocketPath("test-session");
      expect(socketPath).toContain("test-session.sock");
      expect(socketPath).toContain(".talos");
      expect(socketPath).toContain("sessions");
    });
  });
});
