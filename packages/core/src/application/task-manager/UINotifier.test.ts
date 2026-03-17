/**
 * UINotifier Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { UINotifier } from "./UINotifier";
import type { ILogger, IEventBus } from "@talos/types";

describe("UINotifier", () => {
  let uiNotifier: UINotifier;
  let mockLogger: ILogger;
  let mockEventBus: IEventBus;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      audit: vi.fn(),
      setLevel: vi.fn(),
      getLevel: vi.fn(),
    };

    // Create mock event bus
    mockEventBus = {
      on: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      publish: vi.fn(),
      removeAllListeners: vi.fn(),
      listenerCount: vi.fn(),
      eventNames: vi.fn(),
      subscribe: vi.fn(),
      unsubscribeAll: vi.fn(),
    };

    // Create UI notifier
    uiNotifier = new UINotifier({
      logger: mockLogger,
      eventBus: mockEventBus,
    });
  });

  describe("notifyProgress", () => {
    it("should format progress message and log via logger", async () => {
      await uiNotifier.notifyProgress("task-123", 0.5, "Processing data");

      expect(mockLogger.info).toHaveBeenCalledWith("[task-123] Progress: 50% - Processing data");
    });

    it("should format progress message without optional message", async () => {
      await uiNotifier.notifyProgress("task-123", 0.75);

      expect(mockLogger.info).toHaveBeenCalledWith("[task-123] Progress: 75%");
    });

    it("should round progress percentage", async () => {
      await uiNotifier.notifyProgress("task-123", 0.333);

      expect(mockLogger.info).toHaveBeenCalledWith("[task-123] Progress: 33%");
    });

    it("should publish ui:progress event with correct payload", async () => {
      await uiNotifier.notifyProgress("task-123", 0.5, "Processing");

      expect(mockEventBus.emit).toHaveBeenCalledWith("ui:progress", {
        taskId: "task-123",
        progress: 0.5,
        progressPercent: 50,
        message: "Processing",
        timestamp: expect.any(Number)
      });
    });

    it("should publish event without message when not provided", async () => {
      await uiNotifier.notifyProgress("task-123", 0.25);

      expect(mockEventBus.emit).toHaveBeenCalledWith("ui:progress", {
        taskId: "task-123",
        progress: 0.25,
        progressPercent: 25,
        message: undefined,
        timestamp: expect.any(Number)
      });
    });

    it("should handle 0% progress", async () => {
      await uiNotifier.notifyProgress("task-123", 0, "Starting");

      expect(mockLogger.info).toHaveBeenCalledWith("[task-123] Progress: 0% - Starting");
      expect(mockEventBus.emit).toHaveBeenCalledWith("ui:progress", {
        taskId: "task-123",
        progress: 0,
        progressPercent: 0,
        message: "Starting",
        timestamp: expect.any(Number)
      });
    });

    it("should handle 100% progress", async () => {
      await uiNotifier.notifyProgress("task-123", 1, "Complete");

      expect(mockLogger.info).toHaveBeenCalledWith("[task-123] Progress: 100% - Complete");
      expect(mockEventBus.emit).toHaveBeenCalledWith("ui:progress", {
        taskId: "task-123",
        progress: 1,
        progressPercent: 100,
        message: "Complete",
        timestamp: expect.any(Number)
      });
    });
  });

  describe("notifyError", () => {
    it("should format error message and log via logger.error", async () => {
      const error = "Something went wrong";
      await uiNotifier.notifyError("task-123", error);

      expect(mockLogger.error).toHaveBeenCalledWith("[task-123] Error: Something went wrong", undefined, undefined);
    });

    it("should handle Error object and extract message", async () => {
      const error = new Error("Database connection failed");
      await uiNotifier.notifyError("task-123", error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[task-123] Error: Database connection failed",
        error,
        undefined
      );
    });

    it("should publish ui:error event with context", async () => {
      const error = "Validation failed";
      const context = { field: "email", code: "INVALID_FORMAT" };

      await uiNotifier.notifyError("task-123", error, context);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[task-123] Error: Validation failed",
        undefined,
        context
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith("ui:error", {
        taskId: "task-123",
        error: "Validation failed",
        context,
        timestamp: expect.any(Number)
      });
    });

    it("should publish ui:error event with Error object message", async () => {
      const error = new Error("Network timeout");

      await uiNotifier.notifyError("task-123", error);

      expect(mockEventBus.emit).toHaveBeenCalledWith("ui:error", {
        taskId: "task-123",
        error: "Network timeout",
        context: undefined,
        timestamp: expect.any(Number)
      });
    });

    it("should handle error without context", async () => {
      await uiNotifier.notifyError("task-123", "Unknown error");

      expect(mockEventBus.emit).toHaveBeenCalledWith("ui:error", {
        taskId: "task-123",
        error: "Unknown error",
        context: undefined,
        timestamp: expect.any(Number)
      });
    });
  });

  describe("notifyCompletion", () => {
    it("should format completion message for success and log via logger.info", async () => {
      await uiNotifier.notifyCompletion("task-123", true);

      expect(mockLogger.info).toHaveBeenCalledWith("[task-123] Task completed successfully");
    });

    it("should format completion message for failure and log via logger.info", async () => {
      await uiNotifier.notifyCompletion("task-123", false);

      expect(mockLogger.info).toHaveBeenCalledWith("[task-123] Task failed");
    });

    it("should publish ui:completion event for success", async () => {
      await uiNotifier.notifyCompletion("task-123", true);

      expect(mockEventBus.emit).toHaveBeenCalledWith("ui:completion", {
        taskId: "task-123",
        success: true,
        result: undefined,
        timestamp: expect.any(Number)
      });
    });

    it("should publish ui:completion event for failure", async () => {
      await uiNotifier.notifyCompletion("task-123", false);

      expect(mockEventBus.emit).toHaveBeenCalledWith("ui:completion", {
        taskId: "task-123",
        success: false,
        result: undefined,
        timestamp: expect.any(Number)
      });
    });

    it("should include result in event when provided", async () => {
      const result = { storiesCompleted: 5, totalTime: 120000 };

      await uiNotifier.notifyCompletion("task-123", true, result);

      expect(mockEventBus.emit).toHaveBeenCalledWith("ui:completion", {
        taskId: "task-123",
        success: true,
        result,
        timestamp: expect.any(Number)
      });
    });

    it("should include result with failure reason", async () => {
      const result = { reason: "Task stopped by user" };

      await uiNotifier.notifyCompletion("task-123", false, result);

      expect(mockEventBus.emit).toHaveBeenCalledWith("ui:completion", {
        taskId: "task-123",
        success: false,
        result,
        timestamp: expect.any(Number)
      });
    });
  });

  describe("integration", () => {
    it("should handle multiple notifications in sequence", async () => {
      await uiNotifier.notifyProgress("task-123", 0, "Starting");
      await uiNotifier.notifyProgress("task-123", 0.5, "Processing");
      await uiNotifier.notifyCompletion("task-123", true, { completed: true });

      expect(mockLogger.info).toHaveBeenCalledTimes(3);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(3);
    });

    it("should handle mixed progress and error notifications", async () => {
      await uiNotifier.notifyProgress("task-123", 0.3, "Step 1");
      await uiNotifier.notifyError("task-123", "Step failed", { step: 1 });
      await uiNotifier.notifyCompletion("task-123", false);

      expect(mockLogger.info).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(3);
    });
  });
});
