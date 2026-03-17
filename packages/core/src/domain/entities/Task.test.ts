/**
 * Task Entity Unit Tests
 * 任务实体单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Task, type TaskDTO, type TaskProperties } from "./Task";

describe("Task Entity", () => {
  describe("Creation", () => {
    it("should create a task with required properties", () => {
      const props: TaskProperties = {
        id: "task-123",
        title: "Test Task",
        description: "Test task description",
        command: "npm test",
        workspace: "/path/to/workspace",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        conversation: []
      };

      const task = Task.create(props);

      expect(task.id).toBe("task-123");
      expect(task.title).toBe("Test Task");
      expect(task.description).toBe("Test task description");
      expect(task.command).toBe("npm test");
      expect(task.workspace).toBe("/path/to/workspace");
      expect(task.prd).toBe("test-prd");
      expect(task.branch).toBe("main");
      expect(task.status).toBe("pending");
      expect(task.conversation).toEqual([]);
    });

    it("should create a task with optional properties", () => {
      const props: TaskProperties = {
        id: "task-456",
        title: "Test Task with Options",
        description: "Test",
        command: "npm build",
        workspace: "/path",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        conversation: [],
        tool: "claude-code",
        worktree: "ralph-test",
        pid: 12345,
        progress: { total: 10, passing: 5, incomplete: 5 },
        startedAt: Date.now(),
        prdId: "prd-123",
        storyId: "us-001",
        role: "frontend"
      };

      const task = Task.create(props);

      expect(task.tool).toBe("claude-code");
      expect(task.worktree).toBe("ralph-test");
      expect(task.pid).toBe(12345);
      expect(task.progress).toEqual({ total: 10, passing: 5, incomplete: 5 });
      expect(task.startedAt).toBeDefined();
      expect(task.prdId).toBe("prd-123");
      expect(task.storyId).toBe("us-001");
      expect(task.role).toBe("frontend");
    });

    it("should initialize status as pending if not provided", () => {
      const props: TaskProperties = {
        id: "task-789",
        title: "Test",
        description: "Test",
        command: "npm test",
        workspace: "/path",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        conversation: []
      };

      const task = Task.create(props);
      expect(task.status).toBe("pending");
    });

    it("should accept provided status", () => {
      const props: TaskProperties = {
        id: "task-101",
        title: "Test",
        description: "Test",
        command: "npm test",
        workspace: "/path",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        conversation: [],
        status: "in_progress"
      };

      const task = Task.create(props);
      expect(task.status).toBe("in_progress");
    });
  });

  describe("State Transitions", () => {
    let task: Task;

    beforeEach(() => {
      const props: TaskProperties = {
        id: "task-state",
        title: "State Transition Test",
        description: "Test",
        command: "npm test",
        workspace: "/path",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        conversation: []
      };
      task = Task.create(props);
    });

    describe("start()", () => {
      it("should transition from pending to in_progress", () => {
        task.start();
        expect(task.status).toBe("in_progress");
        expect(task.startedAt).toBeDefined();
        expect(task.startedAt).toBeLessThanOrEqual(Date.now());
      });

      it("should throw error when starting from in_progress", () => {
        task.start();
        expect(() => task.start()).toThrow(
          "Cannot start task from status 'in_progress'. Task must be in 'pending' or 'stopped' state."
        );
      });

      it("should throw error when starting from completed", () => {
        task.start();
        task.complete();
        expect(() => task.start()).toThrow(
          "Cannot start task from status 'completed'. Task must be in 'pending' or 'stopped' state."
        );
      });

      it("should throw error when starting from failed", () => {
        task.start();
        task.fail("Test error");
        expect(() => task.start()).toThrow(
          "Cannot start task from status 'failed'. Task must be in 'pending' or 'stopped' state."
        );
      });

      it("should allow starting from stopped state (resume)", () => {
        task.start();
        task.stop();
        expect(() => task.start()).not.toThrow();
        expect(task.status).toBe("in_progress");
      });
    });

    describe("complete()", () => {
      it("should transition from in_progress to completed", () => {
        task.start();
        task.complete();
        expect(task.status).toBe("completed");
        expect(task.completedAt).toBeDefined();
        expect(task.completedAt).toBeLessThanOrEqual(Date.now());
      });

      it("should throw error when completing from pending", () => {
        expect(() => task.complete()).toThrow(
          "Cannot complete task from status 'pending'. Task must be in 'in_progress' state."
        );
      });

      it("should throw error when completing from failed", () => {
        task.start();
        task.fail("Error");
        expect(() => task.complete()).toThrow(
          "Cannot complete task from status 'failed'. Task must be in 'in_progress' state."
        );
      });
    });

    describe("fail()", () => {
      it("should transition from pending to failed", () => {
        task.fail("Build failed");
        expect(task.status).toBe("failed");
        expect(task.error).toBe("Build failed");
        expect(task.completedAt).toBeDefined();
      });

      it("should transition from in_progress to failed", () => {
        task.start();
        task.fail("Runtime error");
        expect(task.status).toBe("failed");
        expect(task.error).toBe("Runtime error");
      });

      it("should transition from completed to failed", () => {
        task.start();
        task.complete();
        task.fail("Post-process error");
        expect(task.status).toBe("failed");
        expect(task.error).toBe("Post-process error");
      });

      it("should transition from stopped to failed", () => {
        task.stop();
        task.fail("Cleanup error");
        expect(task.status).toBe("failed");
        expect(task.error).toBe("Cleanup error");
      });
    });

    describe("stop()", () => {
      it("should transition from pending to stopped", () => {
        task.stop();
        expect(task.status).toBe("stopped");
        expect(task.completedAt).toBeDefined();
      });

      it("should transition from in_progress to stopped", () => {
        task.start();
        task.stop();
        expect(task.status).toBe("stopped");
      });

      it("should throw error when stopping from completed", () => {
        task.start();
        task.complete();
        expect(() => task.stop()).toThrow(
          "Invalid state transition from 'completed' to 'stopped'"
        );
      });

      it("should throw error when stopping from failed", () => {
        task.start();
        task.fail("Error");
        expect(() => task.stop()).toThrow(
          "Invalid state transition from 'failed' to 'stopped'"
        );
      });
    });

    describe("transitionTo()", () => {
      it("should allow valid transition: pending → in_progress", () => {
        task.transitionTo("in_progress");
        expect(task.status).toBe("in_progress");
      });

      it("should allow valid transition: pending → stopped", () => {
        task.transitionTo("stopped");
        expect(task.status).toBe("stopped");
      });

      it("should allow valid transition: in_progress → completed", () => {
        task.start();
        task.transitionTo("completed");
        expect(task.status).toBe("completed");
      });

      it("should allow valid transition: in_progress → failed", () => {
        task.start();
        task.transitionTo("failed");
        expect(task.status).toBe("failed");
      });

      it("should throw error for invalid transition: pending → completed", () => {
        expect(() => task.transitionTo("completed")).toThrow(
          "Invalid state transition from 'pending' to 'completed'. Valid transitions from 'pending' are: in_progress, stopped"
        );
      });

      it("should throw error for invalid transition: completed → in_progress", () => {
        task.start();
        task.complete();
        expect(() => task.transitionTo("in_progress")).toThrow(
          "Invalid state transition from 'completed' to 'in_progress'. Valid transitions from 'completed' are: (none)"
        );
      });
    });

    describe("canTransitionTo()", () => {
      it("should return true for valid transitions", () => {
        expect(task.canTransitionTo("in_progress")).toBe(true);
        expect(task.canTransitionTo("stopped")).toBe(true);
      });

      it("should return false for invalid transitions", () => {
        expect(task.canTransitionTo("completed")).toBe(false);
        expect(task.canTransitionTo("failed")).toBe(false);
      });

      it("should return false for terminal states", () => {
        task.start();
        task.complete();
        expect(task.canTransitionTo("in_progress")).toBe(false);
        expect(task.canTransitionTo("failed")).toBe(false);
        expect(task.canTransitionTo("stopped")).toBe(false);
      });
    });
  });

  describe("Business Methods", () => {
    let task: Task;

    beforeEach(() => {
      const props: TaskProperties = {
        id: "task-business",
        title: "Business Methods Test",
        description: "Test",
        command: "npm test",
        workspace: "/path",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        conversation: []
      };
      task = Task.create(props);
    });

    describe("updateProgress()", () => {
      it("should update task progress", () => {
        const progress = { total: 20, passing: 15, incomplete: 5 };
        task.updateProgress(progress);
        expect(task.progress).toEqual(progress);
      });

      it("should allow updating progress multiple times", () => {
        task.updateProgress({ total: 10, passing: 5, incomplete: 5 });
        expect(task.progress?.passing).toBe(5);

        task.updateProgress({ total: 10, passing: 8, incomplete: 2 });
        expect(task.progress?.passing).toBe(8);
      });
    });

    describe("isAlive()", () => {
      it("should return false when task is pending", () => {
        expect(task.isAlive()).toBe(false);
      });

      it("should return false when task is completed", () => {
        task.start();
        task.pid = 12345;
        task.complete();
        expect(task.isAlive()).toBe(false);
      });

      it("should return true when task is in_progress with valid PID", () => {
        task.start();
        task.pid = 12345;
        expect(task.isAlive()).toBe(true);
      });

      it("should return false when task is in_progress without PID", () => {
        task.start();
        expect(task.isAlive()).toBe(false);
      });

      it("should return false when task is in_progress with invalid PID", () => {
        task.start();
        task.pid = 0;
        expect(task.isAlive()).toBe(false);
      });
    });

    describe("getDuration()", () => {
      it("should return undefined for pending task", () => {
        expect(task.getDuration()).toBeUndefined();
      });

      it("should return undefined for in_progress task without completion", () => {
        task.start();
        expect(task.getDuration()).toBeUndefined();
      });

      it("should return duration for completed task", () => {
        const startTime = Date.now();
        task.start();
        // Simulate task completion after 5 seconds
        const completedTime = startTime + 5000;
        task.complete();
        task.startedAt = startTime;
        task.completedAt = completedTime;

        const duration = task.getDuration();
        expect(duration).toBe(5); // 5 seconds
      });

      it("should calculate duration from timestamp if startedAt is missing", () => {
        const baseTime = Date.now();
        task.timestamp = baseTime;
        task.completedAt = baseTime + 10000; // 10 seconds later
        task.status = "completed";

        const duration = task.getDuration();
        expect(duration).toBe(10); // 10 seconds
      });
    });

    describe("addMessage()", () => {
      it("should add message to conversation", () => {
        const message = {
          role: "user" as const,
          content: "Test message"
        };
        task.addMessage(message);
        expect(task.conversation).toHaveLength(1);
        expect(task.conversation[0]).toEqual(message);
      });

      it("should allow adding multiple messages", () => {
        task.addMessage({ role: "user" as const, content: "Message 1" });
        task.addMessage({ role: "assistant" as const, content: "Message 2" });
        expect(task.conversation).toHaveLength(2);
      });
    });

    describe("getSummary()", () => {
      it("should return summary for pending task", () => {
        const summary = task.getSummary();
        expect(summary).toContain("task-business");
        expect(summary).toContain("[pending]");
        expect(summary).toContain("Business Methods Test");
        expect(summary).toContain("ongoing");
      });

      it("should return summary with duration for completed task", () => {
        task.start();
        task.complete();
        task.startedAt = Date.now() - 10000; // 10 seconds ago
        task.completedAt = Date.now();

        const summary = task.getSummary();
        expect(summary).toContain("[completed]");
        expect(summary).toContain("10s");
      });
    });
  });

  describe("Serialization", () => {
    describe("toDTO()", () => {
      it("should convert task to DTO", () => {
        const props: TaskProperties = {
          id: "task-dto",
          title: "DTO Test",
          description: "Test",
          command: "npm test",
          workspace: "/path",
          prd: "test-prd",
          branch: "main",
          timestamp: Date.now(),
          conversation: [{ role: "user" as const, content: "Hello" }]
        };

        const task = Task.create(props);
        const dto = task.toDTO();

        expect(dto.id).toBe("task-dto");
        expect(dto.title).toBe("DTO Test");
        expect(dto.status).toBe("pending");
        expect(dto.conversation).toEqual([{ role: "user" as const, content: "Hello" }]);
      });

      it("should clone conversation array to prevent mutation", () => {
        const message = { role: "user" as const, content: "Test" };
        const props: TaskProperties = {
          id: "task-clone",
          title: "Clone Test",
          description: "Test",
          command: "npm test",
          workspace: "/path",
          prd: "test-prd",
          branch: "main",
          timestamp: Date.now(),
          conversation: [message]
        };

        const task = Task.create(props);
        const dto = task.toDTO();

        // Modify DTO conversation
        dto.conversation.push({ role: "assistant" as const, content: "New message" });

        // Original task conversation should be unchanged
        expect(task.conversation).toHaveLength(1);
      });
    });

    describe("fromDTO()", () => {
      it("should create task from DTO", () => {
        const dto: TaskDTO = {
          id: "task-from-dto",
          title: "From DTO Test",
          description: "Test",
          command: "npm test",
          workspace: "/path",
          prd: "test-prd",
          branch: "main",
          timestamp: Date.now(),
          status: "in_progress",
          conversation: [{ role: "user" as const, content: "Hello" }],
          startedAt: Date.now()
        };

        const task = Task.fromDTO(dto);

        expect(task.id).toBe("task-from-dto");
        expect(task.title).toBe("From DTO Test");
        expect(task.status).toBe("in_progress");
        expect(task.startedAt).toBeDefined();
      });

      it("should round-trip task through DTO", () => {
        const props: TaskProperties = {
          id: "task-roundtrip",
          title: "Roundtrip Test",
          description: "Test",
          command: "npm test",
          workspace: "/path",
          prd: "test-prd",
          branch: "main",
          timestamp: Date.now(),
          conversation: [{ role: "user" as const, content: "Hello" }],
          progress: { total: 10, passing: 5, incomplete: 5 },
          tool: "claude-code"
        };

        const originalTask = Task.create(props);
        const dto = originalTask.toDTO();
        const restoredTask = Task.fromDTO(dto);

        expect(restoredTask.id).toBe(originalTask.id);
        expect(restoredTask.title).toBe(originalTask.title);
        expect(restoredTask.status).toBe(originalTask.status);
        expect(restoredTask.progress).toEqual(originalTask.progress);
        expect(restoredTask.tool).toBe(originalTask.tool);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty conversation", () => {
      const props: TaskProperties = {
        id: "task-edge",
        title: "Edge Case",
        description: "Test",
        command: "npm test",
        workspace: "/path",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now()
        // conversation not provided
      };

      const task = Task.create(props);
      expect(task.conversation).toEqual([]);
    });

    it("should handle status with completedAt timestamp", () => {
      const props: TaskProperties = {
        id: "task-timestamp",
        title: "Timestamp Test",
        description: "Test",
        command: "npm test",
        workspace: "/path",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        conversation: [],
        status: "completed",
        completedAt: Date.now()
      };

      const task = Task.create(props);
      expect(task.status).toBe("completed");
      expect(task.completedAt).toBeDefined();
    });
  });
});
