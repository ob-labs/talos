import fs from "fs/promises";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getSession,
  saveSession,
  listSessions,
  deleteSession,
  updateSessionStatus,
  SESSIONS_DIR,
} from "./session-storage";
import type { SessionMetadata } from "@talos/types";

describe("session-storage", () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temp directory for testing
    testDir = `${os.tmpdir()}/talos-test-${Date.now()}`;
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

  const createMockSession = (overrides?: Partial<SessionMetadata>): SessionMetadata => ({
    id: "sess_test123",
    prdId: "prd_001",
    status: "running",
    pid: 12345,
    socketPath: "/tmp/test.sock",
    command: "node test.js",
    cwd: "/test/dir",
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    lastHealthCheck: Date.now(),
    ...overrides,
  });

  describe("getSession", () => {
    it("should return null for non-existent session", async () => {
      const session = await getSession("nonexistent", testDir);
      expect(session).toBeNull();
    });

    it("should read existing session from file", async () => {
      const mockSession = createMockSession();
      const sessionPath = path.join(testDir, ".talos", "sessions", `${mockSession.id}.json`);
      await fs.mkdir(path.dirname(sessionPath), { recursive: true });
      await fs.writeFile(sessionPath, JSON.stringify(mockSession, null, 2));

      const session = await getSession(mockSession.id, testDir);
      expect(session).toEqual(mockSession);
    });
  });

  describe("saveSession", () => {
    it("should save session to file", async () => {
      const mockSession = createMockSession();
      await saveSession(mockSession, testDir);

      const sessionPath = path.join(testDir, ".talos", "sessions", `${mockSession.id}.json`);
      const savedContent = await fs.readFile(sessionPath, "utf-8");
      expect(JSON.parse(savedContent)).toEqual(mockSession);
    });

    it("should create sessions directory if it doesn't exist", async () => {
      const mockSession = createMockSession();
      await saveSession(mockSession, testDir);

      const sessionsDir = path.join(testDir, ".talos", "sessions");
      const dirExists = await fs.access(sessionsDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    });

    it("should overwrite existing session", async () => {
      const session1 = createMockSession({ status: "running" as const });
      const session2 = createMockSession({ status: "stopped" as const });

      await saveSession(session1, testDir);
      await saveSession(session2, testDir);

      const session = await getSession(session1.id, testDir);
      expect(session?.status).toBe("stopped");
    });
  });

  describe("listSessions", () => {
    it("should return empty array when no sessions exist", async () => {
      const sessions = await listSessions(testDir);
      expect(sessions).toEqual([]);
    });

    it("should return all sessions", async () => {
      const session1 = createMockSession({ id: "sess_001" });
      const session2 = createMockSession({ id: "sess_002" });

      await saveSession(session1, testDir);
      await saveSession(session2, testDir);

      const sessions = await listSessions(testDir);
      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.id)).toContain("sess_001");
      expect(sessions.map((s) => s.id)).toContain("sess_002");
    });

    it("should skip invalid JSON files", async () => {
      const validSession = createMockSession({ id: "sess_valid" });
      await saveSession(validSession, testDir);

      // Create an invalid JSON file
      const sessionsDir = path.join(testDir, ".talos", "sessions");
      await fs.writeFile(path.join(sessionsDir, "invalid.json"), "invalid json content");

      const sessions = await listSessions(testDir);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe("sess_valid");
    });

    it("should skip non-.json files", async () => {
      const validSession = createMockSession({ id: "sess_valid" });
      await saveSession(validSession, testDir);

      // Create a non-JSON file
      const sessionsDir = path.join(testDir, ".talos", "sessions");
      await fs.writeFile(path.join(sessionsDir, "readme.txt"), "readme content");

      const sessions = await listSessions(testDir);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe("sess_valid");
    });
  });

  describe("deleteSession", () => {
    it("should delete existing session", async () => {
      const mockSession = createMockSession();
      await saveSession(mockSession, testDir);

      await deleteSession(mockSession.id, testDir);

      const session = await getSession(mockSession.id, testDir);
      expect(session).toBeNull();
    });

    it("should not throw when deleting non-existent session", async () => {
      await expect(deleteSession("nonexistent", testDir)).resolves.not.toThrow();
    });
  });

  describe("updateSessionStatus", () => {
    it("should update session status", async () => {
      const mockSession = createMockSession({ status: "running" as const });
      await saveSession(mockSession, testDir);

      await updateSessionStatus(mockSession.id, "stopped", testDir);

      const session = await getSession(mockSession.id, testDir);
      expect(session?.status).toBe("stopped");
    });

    it("should throw when updating non-existent session", async () => {
      await expect(updateSessionStatus("nonexistent", "running", testDir)).rejects.toThrow(
        "Session not found: nonexistent"
      );
    });

    it("should preserve other session fields when updating status", async () => {
      const mockSession = createMockSession({ status: "running" as const });
      await saveSession(mockSession, testDir);

      await updateSessionStatus(mockSession.id, "stopped", testDir);

      const session = await getSession(mockSession.id, testDir);
      expect(session?.prdId).toBe(mockSession.prdId);
      expect(session?.pid).toBe(mockSession.pid);
      expect(session?.socketPath).toBe(mockSession.socketPath);
    });
  });

  describe("SESSIONS_DIR", () => {
    it("should point to ~/.talos/sessions", () => {
      expect(SESSIONS_DIR).toMatch(/\.talos[/\\]sessions$/);
    });
  });
});
