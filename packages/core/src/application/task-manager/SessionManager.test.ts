/**
 * Session Manager Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { SessionManager } from "./SessionManager";
import type { ILogger } from "@talos/types";

describe("SessionManager", () => {
  let sessionManager: SessionManager;
  let mockLogger: ILogger;
  let testSessionsDir: string;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create a temp directory for testing
    testSessionsDir = path.join(os.tmpdir(), `talos-test-sessions-${Date.now()}`);
    await fs.mkdir(testSessionsDir, { recursive: true });

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      audit: vi.fn(),
      setLevel: vi.fn(),
      getLevel: vi.fn(),
    };

    // Create session manager with test directory
    sessionManager = new SessionManager({
      logger: mockLogger,
      sessionsDir: testSessionsDir,
    });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testSessionsDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("createSession", () => {
    it("should create a new session with generated ID", async () => {
      const result = await sessionManager.createSession("prd-001", "ralph-executor");

      expect(result.sessionId).toMatch(/^sess_\d+_[a-z0-9]{6}$/);
      expect(result.prdId).toBe("prd-001");
      expect(result.roleId).toBe("ralph-executor");
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Creating session ${result.sessionId} for PRD prd-001`)
      );

      // Verify file was created
      const sessionPath = path.join(testSessionsDir, `${result.sessionId}.json`);
      const content = await fs.readFile(sessionPath, "utf-8");
      const sessionData = JSON.parse(content);
      expect(sessionData.prdId).toBe("prd-001");
      expect(sessionData.roleId).toBe("ralph-executor");
    });

    it("should create session with initial conversation", async () => {
      const initialMessages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];

      const result = await sessionManager.createSession("prd-001", "ralph-executor", initialMessages);

      const sessionPath = path.join(testSessionsDir, `${result.sessionId}.json`);
      const content = await fs.readFile(sessionPath, "utf-8");
      const sessionData = JSON.parse(content);
      expect(sessionData.messages).toEqual(initialMessages);
    });

    it("should create session with empty conversation if not provided", async () => {
      const result = await sessionManager.createSession("prd-001", "ralph-executor");

      const sessionPath = path.join(testSessionsDir, `${result.sessionId}.json`);
      const content = await fs.readFile(sessionPath, "utf-8");
      const sessionData = JSON.parse(content);
      expect(sessionData.messages).toEqual([]);
    });

    it("should log success after session creation", async () => {
      const result = await sessionManager.createSession("prd-001", "ralph-executor");

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Session ${result.sessionId} created successfully`)
      );
    });
  });

  describe("getSession", () => {
    it("should return session data when session exists", async () => {
      // First create a session
      const created = await sessionManager.createSession("prd-001", "ralph-executor", [
        { role: "user", content: "Test message" },
      ]);

      const result = await sessionManager.getSession(created.sessionId);

      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe(created.sessionId);
      expect(result?.prdId).toBe("prd-001");
      expect(result?.roleId).toBe("ralph-executor");
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.messages).toEqual([{ role: "user", content: "Test message" }]);
    });

    it("should return null when session does not exist", async () => {
      const result = await sessionManager.getSession("nonexistent");

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Session nonexistent not found")
      );
    });

    it("should handle session with messages", async () => {
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
        { role: "user", content: "How are you?" },
      ];

      const created = await sessionManager.createSession("prd-001", "ralph-executor", messages);
      const result = await sessionManager.getSession(created.sessionId);

      expect(result?.messages).toEqual(messages);
    });
  });

  describe("closeSession", () => {
    it("should close existing session and return true", async () => {
      const created = await sessionManager.createSession("prd-001", "ralph-executor");

      const result = await sessionManager.closeSession(created.sessionId);

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Closing session ${created.sessionId}`)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Session ${created.sessionId} closed successfully`)
      );

      // Verify closedAt was set
      const sessionPath = path.join(testSessionsDir, `${created.sessionId}.json`);
      const content = await fs.readFile(sessionPath, "utf-8");
      const sessionData = JSON.parse(content);
      expect(sessionData.closedAt).toBeDefined();
    });

    it("should return false when session does not exist", async () => {
      const result = await sessionManager.closeSession("nonexistent");

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Session nonexistent not found, cannot close")
      );
    });

    it("should set closedAt timestamp when closing", async () => {
      const beforeTime = new Date();
      const created = await sessionManager.createSession("prd-001", "ralph-executor");

      await sessionManager.closeSession(created.sessionId);

      const sessionPath = path.join(testSessionsDir, `${created.sessionId}.json`);
      const content = await fs.readFile(sessionPath, "utf-8");
      const sessionData = JSON.parse(content);
      const closedAt = new Date(sessionData.closedAt);
      const afterTime = new Date();

      expect(closedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(closedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe("deleteSession", () => {
    it("should delete session", async () => {
      const created = await sessionManager.createSession("prd-001", "ralph-executor");

      await sessionManager.deleteSession(created.sessionId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Deleting session ${created.sessionId}`)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Session ${created.sessionId} deleted`)
      );

      // Verify file was deleted
      const sessionPath = path.join(testSessionsDir, `${created.sessionId}.json`);
      const exists = await fs.access(sessionPath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it("should handle deletion errors gracefully when session not found", async () => {
      await sessionManager.deleteSession("nonexistent"); // Should not throw

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Session nonexistent not found for deletion")
      );
    });
  });

  describe("generateSessionId", () => {
    it("should generate unique session IDs", async () => {
      const id1 = await sessionManager.createSession("prd-001", "role1");
      const id2 = await sessionManager.createSession("prd-001", "role2");

      expect(id1.sessionId).not.toBe(id2.sessionId);
    });

    it("should generate IDs with correct format", async () => {
      const result = await sessionManager.createSession("prd-001", "role1");

      expect(result.sessionId).toMatch(/^sess_\d{13,}_[a-z0-9]{6}$/);
    });
  });
});
