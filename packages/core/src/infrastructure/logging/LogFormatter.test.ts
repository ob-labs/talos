import { describe, it, expect } from "vitest";
import { LogFormatter } from "./LogFormatter";
import { LogLevel } from "@talos/types";

describe("LogFormatter", () => {
  describe("format", () => {
    it("should format log entries with timestamp, level, and message", () => {
      const formatter = new LogFormatter();
      const logLine = formatter.format(LogLevel.INFO, "Test message");

      expect(logLine).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[INFO\] Test message\n$/);
    });

    it("should format log entries with metadata", () => {
      const formatter = new LogFormatter();
      const logLine = formatter.format(LogLevel.WARN, "Warning message", { key: "value" });

      expect(logLine).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[WARN\] Warning message \{.*\}\n$/);
      expect(logLine).toContain('"key":"value"');
    });

    it("should format log entries without metadata", () => {
      const formatter = new LogFormatter();
      const logLine = formatter.format(LogLevel.ERROR, "Error message");

      expect(logLine).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[ERROR\] Error message\n/);
      expect(logLine).not.toContain("{}");
    });

    it("should handle complex metadata objects", () => {
      const formatter = new LogFormatter();
      const metadata = { 
        taskId: "task-123", 
        pid: 456, 
        nested: { key: "value" } 
      };
      const logLine = formatter.format(LogLevel.AUDIT, "Audit event", metadata);

      expect(logLine).toContain("task-123");
      expect(logLine).toContain("456");
      expect(logLine).toContain('"nested":{');
    });

    it("should handle metadata with circular references gracefully", () => {
      const formatter = new LogFormatter();
      const circularObj: any = { key: "value" };
      circularObj.self = circularObj;
      const logLine = formatter.format(LogLevel.INFO, "Test", circularObj);

      // Should not throw and should contain a placeholder
      expect(logLine).toBeDefined();
      expect(logLine).toContain("[metadata unavailable]");
    });

    it("should use local timezone for timestamps", () => {
      const formatter = new LogFormatter();
      const before = new Date();
      const logLine = formatter.format(LogLevel.INFO, "Test");
      const after = new Date();

      // Extract timestamp from log line
      const match = logLine.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
      expect(match).not.toBeNull();

      const timestampStr = match![1];
      const logTimestamp = new Date(timestampStr);

      // Log timestamp should be within a few seconds of now
      const timeDiff = Math.abs(logTimestamp.getTime() - before.getTime());
      expect(timeDiff).toBeLessThan(5000); // 5 seconds tolerance
    });
  });

  describe("formatError", () => {
    it("should format error messages without error object", () => {
      const formatter = new LogFormatter();
      const logLine = formatter.formatError("Error occurred");

      expect(logLine).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[ERROR\] Error occurred\n$/);
    });

    it("should format error messages with error object", () => {
      const formatter = new LogFormatter();
      const error = new Error("Something went wrong");
      const logLine = formatter.formatError("Error occurred", error);

      expect(logLine).toContain("Error: Something went wrong");
      expect(logLine).toContain("at "); // Stack trace indicator
    });

    it("should include stack trace in error messages", () => {
      const formatter = new LogFormatter();
      const error = new Error("Test error");
      const logLine = formatter.formatError("Error occurred", error);

      expect(logLine).toContain("Error occurred");
      expect(logLine).toContain("Error: Test error");
      expect(logLine).toMatch(/\n.*\.test\.ts/); // Stack trace with file reference
    });

    it("should format error messages with metadata", () => {
      const formatter = new LogFormatter();
      const error = new Error("Test error");
      const logLine = formatter.formatError("Error occurred", error, { endpoint: "api" });

      expect(logLine).toContain("Error occurred");
      expect(logLine).toContain("endpoint");
    });
  });
});
