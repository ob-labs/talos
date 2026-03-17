import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "crypto";
import { rm } from "fs/promises";
import { Logger } from "./index";
import { LogLevel } from "@talos/types";
import { LogFormatter } from "../infrastructure/logging/LogFormatter";

describe("Logger", () => {
  let tempDir: string;
  let logPath: string;
  let logger: Logger;

  beforeEach(() => {
    tempDir = `/tmp/test-logger-${randomUUID()}`;
    logPath = `${tempDir}/test.log`;
    logger = new Logger({ logPath });
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

      expect(content).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[INFO\] Info message\n$/);
    });

    it("should write info log entries with metadata", async () => {
      logger.info("Info message", { key: "value" });

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      expect(content).toContain("Info message");
      expect(content).toContain('"key":"value"');
    });
  });

  describe("warn", () => {
    it("should write warn log entries", async () => {
      logger.warn("Warning message");

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      expect(content).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[WARN\] Warning message\n$/);
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

      expect(content).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[ERROR\] Error message\n$/);
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

      expect(content).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[AUDIT\] Audit event\n$/);
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

  describe("LogFormatter integration", () => {
    it("should use LogFormatter for unified format", async () => {
      const formatter = new LogFormatter();
      const expectedFormat = formatter.format(LogLevel.INFO, "Test message");
      
      logger.info("Test message");

      await new Promise(resolve => setTimeout(resolve, 100));

      const fs = await import("fs/promises");
      const content = await fs.readFile(logPath, "utf-8");

      // Check that the log line matches the expected format
      expect(content).toMatch(expectedFormat);
    });
  });
});
