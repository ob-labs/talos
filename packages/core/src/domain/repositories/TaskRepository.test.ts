/**
 * TaskRepository Unit Tests
 *
 * Tests for Task repository implementation.
 * Verifies ITaskRepository interface compliance and Task entity conversions.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { TaskRepository } from "./TaskRepository";
import { Task } from "../entities/Task";
import type { TaskProperties, TaskProgress } from "@talos/types";

describe("TaskRepository", () => {
  let testDir: string;
  let repository: TaskRepository;

  beforeEach(async () => {
    // Create temporary directory for tests
    testDir = join("/tmp", "talos-test-task-repo", randomUUID());
    await mkdir(testDir, { recursive: true });
    repository = new TaskRepository(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe("save", () => {
    it("should create a new task", async () => {
      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "pending",
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      const found = await repository.findById("task-1");
      expect(found).not.toBeNull();
      expect(found?.id).toBe("task-1");
      expect(found?.title).toBe("Test Task");
      expect(found?.status).toBe("pending");
    });

    it("should update an existing task", async () => {
      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "pending",
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      // Update task status
      task.start();
      await repository.save(task);

      const found = await repository.findById("task-1");
      expect(found?.status).toBe("in_progress");
      expect(found?.startedAt).toBeDefined();
    });

    it("should preserve all task properties when saving", async () => {
      const progress: TaskProgress = {
        total: 10,
        passing: 5,
        incomplete: 5,
      };

      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        tool: "claude-code",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        worktree: "test-worktree",
        pid: 12345,
        progress,
        timestamp: Date.now(),
        startedAt: Date.now(),
        prdId: "prd-1",
        storyId: "story-1",
        role: "frontend",
        status: "in_progress",
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      const found = await repository.findById("task-1");
      expect(found?.tool).toBe("claude-code");
      expect(found?.worktree).toBe("test-worktree");
      expect(found?.pid).toBe(12345);
      expect(found?.progress).toEqual(progress);
      expect(found?.prdId).toBe("prd-1");
      expect(found?.storyId).toBe("story-1");
      expect(found?.role).toBe("frontend");
    });
  });

  describe("findById", () => {
    it("should return null for non-existent task", async () => {
      const found = await repository.findById("non-existent");
      expect(found).toBeNull();
    });

    it("should return task by id", async () => {
      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "pending",
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      const found = await repository.findById("task-1");
      expect(found).not.toBeNull();
      expect(found?.id).toBe("task-1");
    });

    it("should map storage status to domain status correctly", async () => {
      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "in_progress",
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      const found = await repository.findById("task-1");
      expect(found?.status).toBe("in_progress");
    });
  });

  describe("findAll", () => {
    beforeEach(async () => {
      // Create test tasks with different statuses
      const tasks: TaskProperties[] = [
        {
          id: "task-1",
          title: "Pending Task",
          description: "Pending",
          command: "npm run test1",
          workspace: testDir,
          prd: "prd-1",
          branch: "main",
          timestamp: Date.now(),
          status: "pending",
          conversation: [],
        },
        {
          id: "task-2",
          title: "In Progress Task",
          description: "In Progress",
          command: "npm run test2",
          workspace: testDir,
          prd: "prd-1",
          branch: "main",
          timestamp: Date.now(),
          status: "in_progress",
          conversation: [],
        },
        {
          id: "task-3",
          title: "Completed Task",
          description: "Completed",
          command: "npm run test3",
          workspace: testDir,
          prd: "prd-2",
          branch: "main",
          timestamp: Date.now(),
          status: "completed",
          completedAt: Date.now(),
          conversation: [],
        },
        {
          id: "task-4",
          title: "Failed Task",
          description: "Failed",
          command: "npm run test4",
          workspace: testDir,
          prd: "prd-2",
          branch: "main",
          timestamp: Date.now(),
          status: "failed",
          completedAt: Date.now(),
          error: "Test error",
          conversation: [],
        },
      ];

      for (const props of tasks) {
        const task = Task.create(props);
        await repository.save(task);
      }
    });

    it("should return all tasks when no filter provided", async () => {
      const allTasks = await repository.findAll();
      expect(allTasks).toHaveLength(4);
    });

    it("should filter tasks by status", async () => {
      const inProgressTasks = await repository.findAll({
        status: "in_progress",
      });
      expect(inProgressTasks).toHaveLength(1);
      expect(inProgressTasks[0].id).toBe("task-2");

      const completedTasks = await repository.findAll({
        status: "completed",
      });
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].id).toBe("task-3");
    });

    it("should filter tasks by prdId", async () => {
      const prd1Tasks = await repository.findAll({ prdId: "prd-1" });
      expect(prd1Tasks).toHaveLength(2);

      const prd2Tasks = await repository.findAll({ prdId: "prd-2" });
      expect(prd2Tasks).toHaveLength(2);
    });

    it("should filter tasks by storyId", async () => {
      const taskProps: TaskProperties = {
        id: "task-5",
        title: "Task with Story",
        description: "Has story",
        command: "npm run test5",
        workspace: testDir,
        prd: "prd-1",
        branch: "main",
        timestamp: Date.now(),
        status: "pending",
        storyId: "story-1",
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      const storyTasks = await repository.findAll({ storyId: "story-1" });
      expect(storyTasks).toHaveLength(1);
      expect(storyTasks[0].id).toBe("task-5");
    });

    it("should filter tasks by role", async () => {
      const taskProps: TaskProperties = {
        id: "task-6",
        title: "Task with Role",
        description: "Has role",
        command: "npm run test6",
        workspace: testDir,
        prd: "prd-1",
        branch: "main",
        timestamp: Date.now(),
        status: "pending",
        role: "frontend",
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      const frontendTasks = await repository.findAll({ role: "frontend" });
      expect(frontendTasks).toHaveLength(1);
      expect(frontendTasks[0].id).toBe("task-6");
    });

    it("should combine multiple filters", async () => {
      const taskProps: TaskProperties = {
        id: "task-7",
        title: "Filtered Task",
        description: "Multiple filters",
        command: "npm run test7",
        workspace: testDir,
        prd: "prd-1",
        branch: "main",
        timestamp: Date.now(),
        status: "pending",
        storyId: "story-1",
        role: "backend",
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      const filtered = await repository.findAll({
        prdId: "prd-1",
        storyId: "story-1",
        role: "backend",
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("task-7");
    });
  });

  describe("delete", () => {
    it("should delete an existing task", async () => {
      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "pending",
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      await repository.delete("task-1");

      const found = await repository.findById("task-1");
      expect(found).toBeNull();
    });

    it("should throw error when deleting non-existent task", async () => {
      await expect(repository.delete("non-existent")).rejects.toThrow(
        "Task with id 'non-existent' not found"
      );
    });
  });

  describe("exists", () => {
    it("should return true for existing task", async () => {
      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "pending",
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      const exists = await repository.exists("task-1");
      expect(exists).toBe(true);
    });

    it("should return false for non-existent task", async () => {
      const exists = await repository.exists("non-existent");
      expect(exists).toBe(false);
    });
  });

  describe("count", () => {
    beforeEach(async () => {
      const tasks: TaskProperties[] = [
        {
          id: "task-1",
          title: "Task 1",
          description: "Description",
          command: "npm run test1",
          workspace: testDir,
          prd: "prd-1",
          branch: "main",
          timestamp: Date.now(),
          status: "pending",
          conversation: [],
        },
        {
          id: "task-2",
          title: "Task 2",
          description: "Description",
          command: "npm run test2",
          workspace: testDir,
          prd: "prd-1",
          branch: "main",
          timestamp: Date.now(),
          status: "in_progress",
          conversation: [],
        },
        {
          id: "task-3",
          title: "Task 3",
          description: "Description",
          command: "npm run test3",
          workspace: testDir,
          prd: "prd-2",
          branch: "main",
          timestamp: Date.now(),
          status: "in_progress",
          conversation: [],
        },
      ];

      for (const props of tasks) {
        const task = Task.create(props);
        await repository.save(task);
      }
    });

    it("should count all tasks when no filter provided", async () => {
      const count = await repository.count();
      expect(count).toBe(3);
    });

    it("should count tasks by status", async () => {
      const inProgressCount = await repository.count({ status: "in_progress" });
      expect(inProgressCount).toBe(2);

      const pendingCount = await repository.count({ status: "pending" });
      expect(pendingCount).toBe(1);
    });

    it("should count tasks by prdId", async () => {
      const prd1Count = await repository.count({ prdId: "prd-1" });
      expect(prd1Count).toBe(2);

      const prd2Count = await repository.count({ prdId: "prd-2" });
      expect(prd2Count).toBe(1);
    });
  });

  describe("status mapping", () => {
    it("should correctly map pending status to stopped in storage", async () => {
      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "pending",
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      // Task status should remain pending in domain model
      const found = await repository.findById("task-1");
      expect(found?.status).toBe("pending");
    });

    it("should correctly map in_progress status to running in storage", async () => {
      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "in_progress",
        startedAt: Date.now(),
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      const found = await repository.findById("task-1");
      expect(found?.status).toBe("in_progress");
    });

    it("should correctly map completed status in both directions", async () => {
      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "completed",
        completedAt: Date.now(),
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      const found = await repository.findById("task-1");
      expect(found?.status).toBe("completed");
    });

    it("should correctly map failed status in both directions", async () => {
      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "failed",
        completedAt: Date.now(),
        error: "Test error",
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      const found = await repository.findById("task-1");
      expect(found?.status).toBe("failed");
      expect(found?.error).toBe("Test error");
    });

    it("should correctly map stopped status in both directions", async () => {
      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "stopped",
        completedAt: Date.now(),
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      const found = await repository.findById("task-1");
      expect(found?.status).toBe("stopped");
    });
  });

  describe("task state transitions", () => {
    it("should persist task state transitions correctly", async () => {
      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "pending",
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      // Start task
      task.start();
      await repository.save(task);

      let found = await repository.findById("task-1");
      expect(found?.status).toBe("in_progress");
      expect(found?.startedAt).toBeDefined();

      // Complete task
      task.complete();
      await repository.save(task);

      found = await repository.findById("task-1");
      expect(found?.status).toBe("completed");
      expect(found?.completedAt).toBeDefined();
    });

    it("should persist task failure correctly", async () => {
      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "in_progress",
        startedAt: Date.now(),
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      // Fail task
      task.fail("Test failure");
      await repository.save(task);

      const found = await repository.findById("task-1");
      expect(found?.status).toBe("failed");
      expect(found?.error).toBe("Test failure");
      expect(found?.completedAt).toBeDefined();
    });
  });

  describe("conversation persistence", () => {
    it("should persist task conversation", async () => {
      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "pending",
        conversation: [],
      };

      const task = Task.create(taskProps);
      task.addMessage({
        type: "user",
        message: "Hello",
        timestamp: Date.now(),
      });
      task.addMessage({
        type: "assistant",
        message: "Hi there!",
        timestamp: Date.now(),
      });

      await repository.save(task);

      const found = await repository.findById("task-1");
      expect(found?.conversation).toHaveLength(2);
      expect(found?.conversation[0].message).toBe("Hello");
      expect(found?.conversation[1].message).toBe("Hi there!");
    });
  });

  describe("progress tracking", () => {
    it("should persist task progress", async () => {
      const progress: TaskProgress = {
        total: 10,
        passing: 7,
        incomplete: 3,
      };

      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "in_progress",
        progress,
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      const found = await repository.findById("task-1");
      expect(found?.progress).toEqual(progress);
    });

    it("should update task progress", async () => {
      const initialProgress: TaskProgress = {
        total: 10,
        passing: 5,
        incomplete: 5,
      };

      const taskProps: TaskProperties = {
        id: "task-1",
        title: "Test Task",
        description: "Test Description",
        command: "npm test",
        workspace: testDir,
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        status: "in_progress",
        progress: initialProgress,
        conversation: [],
      };

      const task = Task.create(taskProps);
      await repository.save(task);

      // Update progress
      const updatedProgress: TaskProgress = {
        total: 10,
        passing: 8,
        incomplete: 2,
      };
      task.updateProgress(updatedProgress);
      await repository.save(task);

      const found = await repository.findById("task-1");
      expect(found?.progress).toEqual(updatedProgress);
    });
  });
});
