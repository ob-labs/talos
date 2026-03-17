/**
 * AuditLogger Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { AuditLogger, AuditEventTypes } from "./AuditLogger";
import type { ILogger } from "@talos/types";
import { rmSync } from "fs";

describe("AuditLogger", () => {
  let auditLogger: AuditLogger;
  let mockLogger: ILogger;
  let tempDir: string;
  let taskId: string;
  let workingDir: string;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = path.join("/tmp", `audit-logger-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    taskId = "task-123";
    workingDir = tempDir;

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      audit: vi.fn(),
      setLevel: vi.fn(),
      getLevel: vi.fn(),
    };

    // Create audit logger
    auditLogger = new AuditLogger({
      taskId,
      workingDir,
      logger: mockLogger,
    });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("logAction", () => {
    it("should write audit log with correct format", async () => {
      await auditLogger.logAction("task_started", { processId: "proc-123" });

      const auditLogPath = path.join(workingDir, ".talos", "audit.log");
      const content = await fs.readFile(auditLogPath, "utf-8");
      const lines = content.trim().split("\n");

      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T[\d:]+\.\d{3}Z\] \[AUDIT\] task_started /);
      expect(lines[0]).toContain("processId");
      expect(lines[0]).toContain("proc-123");
    });

    it("should include taskId in metadata if not provided", async () => {
      await auditLogger.logAction("task_started", {});

      const auditLogPath = path.join(workingDir, ".talos", "audit.log");
      const content = await fs.readFile(auditLogPath, "utf-8");
      const lines = content.trim().split("\n");

      expect(lines[0]).toContain(taskId);
    });

    it("should use provided taskId in metadata", async () => {
      const customTaskId = "custom-task-456";
      await auditLogger.logAction("task_started", { taskId: customTaskId });

      const auditLogPath = path.join(workingDir, ".talos", "audit.log");
      const content = await fs.readFile(auditLogPath, "utf-8");
      const lines = content.trim().split("\n");

      expect(lines[0]).toContain(customTaskId);
      expect(lines[0]).not.toContain(taskId);
    });

    it("should include userId in log line when provided", async () => {
      await auditLogger.logAction("task_started", { processId: "proc-123" }, "user-456");

      const auditLogPath = path.join(workingDir, ".talos", "audit.log");
      const content = await fs.readFile(auditLogPath, "utf-8");
      const lines = content.trim().split("\n");

      expect(lines[0]).toContain("[user: user-456]");
    });

    it("should not include userId in log line when not provided", async () => {
      await auditLogger.logAction("task_started", { processId: "proc-123" });

      const auditLogPath = path.join(workingDir, ".talos", "audit.log");
      const content = await fs.readFile(auditLogPath, "utf-8");
      const lines = content.trim().split("\n");

      expect(lines[0]).not.toContain("[user:");
    });

    it("should append multiple audit logs", async () => {
      await auditLogger.logAction("task_started", { step: 1 });
      await auditLogger.logAction("task_completed", { step: 2 });

      const auditLogPath = path.join(workingDir, ".talos", "audit.log");
      const content = await fs.readFile(auditLogPath, "utf-8");
      const lines = content.trim().split("\n");

      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain("task_started");
      expect(lines[1]).toContain("task_completed");
    });

    it("should log via logger.audit", async () => {
      await auditLogger.logAction("task_started", { processId: "proc-123" });

      expect(mockLogger.audit).toHaveBeenCalledWith("Audit: task_started", {
        processId: "proc-123",
        taskId: "task-123",
      });
    });

    it("should create .talos directory if it doesn't exist", async () => {
      const newWorkingDir = path.join(tempDir, "new-dir");
      const newAuditLogger = new AuditLogger({
        taskId,
        workingDir: newWorkingDir,
        logger: mockLogger,
      });

      await newAuditLogger.logAction("task_started", {});

      const auditLogPath = path.join(newWorkingDir, ".talos", "audit.log");
      const content = await fs.readFile(auditLogPath, "utf-8");

      expect(content).toBeTruthy();
    });

    it("should handle logging errors gracefully", async () => {
      // Create audit logger with invalid working dir
      const invalidLogger = new AuditLogger({
        taskId,
        workingDir: "/invalid/path/that/cannot/be/created",
        logger: mockLogger,
      });

      // Should not throw
      await invalidLogger.logAction("task_started", {});

      // Should log error via logger.error
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("getAuditLogs", () => {
    it("should return empty array when audit log doesn't exist", async () => {
      const logs = await auditLogger.getAuditLogs();

      expect(logs).toEqual([]);
    });

    it("should parse audit log entries correctly", async () => {
      await auditLogger.logAction("task_started", { processId: "proc-123" });
      await auditLogger.logAction("task_completed", { result: "success" });

      const logs = await auditLogger.getAuditLogs();

      expect(logs).toHaveLength(2);
      expect(logs[0].action).toBe("task_started");
      expect(logs[0].details.processId).toBe("proc-123");
      expect(logs[1].action).toBe("task_completed");
      expect(logs[1].details.result).toBe("success");
    });

    it("should filter by action", async () => {
      await auditLogger.logAction("task_started", { step: 1 });
      await auditLogger.logAction("task_started", { step: 2 });
      await auditLogger.logAction("task_completed", {});

      const logs = await auditLogger.getAuditLogs({ action: "task_started" });

      expect(logs).toHaveLength(2);
      expect(logs.every((log) => log.action === "task_started")).toBe(true);
    });

    it("should filter by taskId", async () => {
      await auditLogger.logAction("task_started", { taskId: "task-123" });
      await auditLogger.logAction("task_started", { taskId: "task-456" });

      const logs = await auditLogger.getAuditLogs({ taskId: "task-123" });

      expect(logs).toHaveLength(1);
      expect(logs[0].details.taskId).toBe("task-123");
    });

    it("should filter by processId", async () => {
      await auditLogger.logAction("task_started", { processId: "proc-123" });
      await auditLogger.logAction("task_started", { processId: "proc-456" });

      const logs = await auditLogger.getAuditLogs({ processId: "proc-123" });

      expect(logs).toHaveLength(1);
      expect(logs[0].details.processId).toBe("proc-123");
    });

    it("should filter by userId", async () => {
      await auditLogger.logAction("task_started", {}, "user-123");
      await auditLogger.logAction("task_started", {}, "user-456");

      const logs = await auditLogger.getAuditLogs({ userId: "user-123" });

      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe("user-123");
    });

    it("should filter by startTime", async () => {
      await auditLogger.logAction("task_started", {});

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const cutoff = new Date();
      await auditLogger.logAction("task_completed", {});

      const logs = await auditLogger.getAuditLogs({ startTime: cutoff });

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("task_completed");
    });

    it("should filter by endTime", async () => {
      await auditLogger.logAction("task_started", {});

      const cutoff = new Date();
      await auditLogger.logAction("task_completed", {});

      const logs = await auditLogger.getAuditLogs({ endTime: cutoff });

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("task_started");
    });

    it("should apply limit", async () => {
      await auditLogger.logAction("task_started", { step: 1 });
      await auditLogger.logAction("task_started", { step: 2 });
      await auditLogger.logAction("task_started", { step: 3 });

      const logs = await auditLogger.getAuditLogs({ limit: 2 });

      expect(logs).toHaveLength(2);
    });

    it("should apply multiple filters", async () => {
      await auditLogger.logAction("task_started", { processId: "proc-123" }, "user-123");
      await auditLogger.logAction("task_started", { processId: "proc-456" }, "user-456");
      await auditLogger.logAction("task_completed", { processId: "proc-123" }, "user-123");

      const logs = await auditLogger.getAuditLogs({
        action: "task_started",
        processId: "proc-123",
        userId: "user-123",
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("task_started");
      expect(logs[0].details.processId).toBe("proc-123");
      expect(logs[0].userId).toBe("user-123");
    });

    it("should return all logs when no filter provided", async () => {
      await auditLogger.logAction("task_started", { step: 1 });
      await auditLogger.logAction("task_completed", { step: 2 });

      const logs = await auditLogger.getAuditLogs();

      expect(logs).toHaveLength(2);
    });
  });

  describe("getRecentLogs", () => {
    it("should return most recent 10 logs by default", async () => {
      for (let i = 0; i < 15; i++) {
        await auditLogger.logAction("action", { step: i });
      }

      const logs = await auditLogger.getRecentLogs();

      expect(logs).toHaveLength(10);
    });

    it("should return specified number of recent logs", async () => {
      for (let i = 0; i < 10; i++) {
        await auditLogger.logAction("action", { step: i });
      }

      const logs = await auditLogger.getRecentLogs(5);

      expect(logs).toHaveLength(5);
      // Should be the last 5 logs
      expect(logs[0].details.step).toBe(5);
      expect(logs[4].details.step).toBe(9);
    });

    it("should return all logs when count exceeds total logs", async () => {
      await auditLogger.logAction("action", { step: 1 });
      await auditLogger.logAction("action", { step: 2 });

      const logs = await auditLogger.getRecentLogs(10);

      expect(logs).toHaveLength(2);
    });

    it("should return empty array when no logs exist", async () => {
      const logs = await auditLogger.getRecentLogs();

      expect(logs).toEqual([]);
    });
  });

  describe("AuditEventTypes", () => {
    it("should export all audit event types", () => {
      expect(AuditEventTypes.TASK_CREATED).toBe("task_created");
      expect(AuditEventTypes.TASK_STARTED).toBe("task_started");
      expect(AuditEventTypes.TASK_STOPPED).toBe("task_stopped");
      expect(AuditEventTypes.TASK_RESUMED).toBe("task_resumed");
      expect(AuditEventTypes.TASK_COMPLETED).toBe("task_completed");
      expect(AuditEventTypes.TASK_FAILED).toBe("task_failed");
      expect(AuditEventTypes.STORY_STARTED).toBe("story_started");
      expect(AuditEventTypes.STORY_COMPLETED).toBe("story_completed");
      expect(AuditEventTypes.TOOL_EXECUTED).toBe("tool_executed");
    });

    it("should use audit event types in logAction", async () => {
      await auditLogger.logAction(AuditEventTypes.TASK_STARTED, {});
      await auditLogger.logAction(AuditEventTypes.TASK_COMPLETED, {});

      const logs = await auditLogger.getAuditLogs();

      expect(logs[0].action).toBe("task_started");
      expect(logs[1].action).toBe("task_completed");
    });
  });

  describe("integration", () => {
    it("should handle complete task lifecycle audit logging", async () => {
      // Task created
      await auditLogger.logAction(AuditEventTypes.TASK_CREATED, { prdId: "prd-123" });
      // Task started
      await auditLogger.logAction(AuditEventTypes.TASK_STARTED, { processId: "proc-123" });
      // Story started
      await auditLogger.logAction(AuditEventTypes.STORY_STARTED, { storyId: "US-001" });
      // Story completed
      await auditLogger.logAction(AuditEventTypes.STORY_COMPLETED, { storyId: "US-001" });
      // Task completed
      await auditLogger.logAction(AuditEventTypes.TASK_COMPLETED, { result: "success" });

      const logs = await auditLogger.getAuditLogs();

      expect(logs).toHaveLength(5);
      expect(logs[0].action).toBe("task_created");
      expect(logs[1].action).toBe("task_started");
      expect(logs[2].action).toBe("story_started");
      expect(logs[3].action).toBe("story_completed");
      expect(logs[4].action).toBe("task_completed");
    });

    it("should handle task failure scenario", async () => {
      await auditLogger.logAction(AuditEventTypes.TASK_STARTED, { processId: "proc-123" });
      await auditLogger.logAction(AuditEventTypes.TASK_FAILED, {
        error: "Connection timeout",
        retryCount: 3,
      });

      const logs = await auditLogger.getAuditLogs({ action: "task_failed" });

      expect(logs).toHaveLength(1);
      expect(logs[0].details.error).toBe("Connection timeout");
      expect(logs[0].details.retryCount).toBe(3);
    });
  });
});
