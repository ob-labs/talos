import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "crypto";
import { rm } from "fs/promises";
import { TaskLogger } from "./task-logger";
import { LogLevel } from "@talos/types";

describe("TaskLogger", () => {
  let tempDir: string;
  let taskId: string;
  let logger: TaskLogger;
  let logPath: string;

  beforeEach(() => {
    tempDir = `/tmp/test-task-logger-${randomUUID()}`;
    taskId = `task-${randomUUID()}`;
    logger = new TaskLogger({ taskId, baseDir: tempDir });
    logPath = `${tempDir}/${taskId}.log`;
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("ILogger interface compliance", () => {
    it("should have all required methods", () => {
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.audit).toBeDefined();
      expect(logger.setLevel).toBeDefined();
      expect(logger.getLevel).toBeDefined();
    });

    it("should return correct type from getLevel", () => {
      const level = logger.getLevel();
      expect(level).toBe(LogLevel.INFO);
    });

    it("should set log level correctly", () => {
      logger.setLevel(LogLevel.ERROR);
      expect(logger.getLevel()).toBe(LogLevel.ERROR);
    });
  });

  describe("info", () => {
    it("should write info log entries", async () => {
      logger.info("Info message");

      // Wait a bit for async write
      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      expect(content).toContain("[INFO] Info message");
      expect(content).toContain(`"taskId":"${taskId}"`);
    });

    it("should write info log entries with metadata", async () => {
      logger.info("Info message", { key: "value" });

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      expect(content).toContain("Info message");
      expect(content).toContain('"key":"value"');
      expect(content).toContain(`"taskId":"${taskId}"`);
    });
  });

  describe("warn", () => {
    it("should write warn log entries", async () => {
      logger.warn("Warning message");

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      expect(content).toContain("[WARN] Warning message");
    });

    it("should write warn log entries with metadata", async () => {
      logger.warn("Warning message", { level: "high" });

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      expect(content).toContain("Warning message");
      expect(content).toContain('"level":"high"');
    });
  });

  describe("error", () => {
    it("should write error log entries", async () => {
      logger.error("Error message");

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      expect(content).toContain("[ERROR] Error message");
    });

    it("should write error log entries with error object", async () => {
      const error = new Error("Test error");
      logger.error("Error occurred", error);

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      expect(content).toContain("Error occurred");
      expect(content).toContain("Error: Test error");
      expect(content).toContain("at "); // Stack trace indicator
    });

    it("should write error log entries with metadata", async () => {
      const error = new Error("Test error");
      logger.error("Error occurred", error, { endpoint: "api" });

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      expect(content).toContain("endpoint");
    });
  });

  describe("audit", () => {
    it("should write audit log entries", async () => {
      logger.audit("Audit event");

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      expect(content).toContain("[AUDIT] Audit event");
    });

    it("should write audit log entries even when log level is higher", async () => {
      logger.setLevel(LogLevel.ERROR);
      logger.audit("Audit event");

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      // Audit logs should bypass log level filtering
      expect(content).toContain("[AUDIT] Audit event");
    });

    it("should write audit log entries with metadata", async () => {
      logger.audit("User logged in", { userId: "user-123" });

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      expect(content).toContain("User logged in");
      expect(content).toContain('"userId":"user-123"');
    });
  });

  describe("log level filtering", () => {
    it("should filter info logs when level is WARN", async () => {
      logger.setLevel(LogLevel.WARN);
      logger.info("Info message");
      logger.warn("Warning message");

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      expect(content).not.toContain("[INFO]");
      expect(content).toContain("[WARN]");
    });

    it("should filter warn logs when level is ERROR", async () => {
      logger.setLevel(LogLevel.ERROR);
      logger.info("Info message");
      logger.warn("Warning message");
      logger.error("Error message");

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      expect(content).not.toContain("[INFO]");
      expect(content).not.toContain("[WARN]");
      expect(content).toContain("[ERROR]");
    });
  });

  describe("taskId metadata", () => {
    it("should automatically add taskId to all log entries", async () => {
      logger.info("Test info");
      logger.warn("Test warn");
      logger.error("Test error");
      logger.audit("Test audit");

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      // All log entries should contain taskId
      const lines = content.split("\n").filter(line => line.trim());
      expect(lines.length).toBe(4);
      
      lines.forEach(line => {
        expect(line).toContain(`"taskId":"${taskId}"`);
      });
    });

    it("should merge taskId with provided metadata", async () => {
      logger.info("Test", { userId: "user-123" });

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      expect(content).toContain(`"taskId":"${taskId}"`);
      expect(content).toContain('"userId":"user-123"');
    });
  });

  describe("Legacy compatibility", () => {
    it("should support legacy log method", async () => {
      await logger.log("Legacy message");

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      expect(content).toContain("[INFO] Legacy message");
    });
  });
});
