/**
 * Unit tests for HealthChecker
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HealthChecker } from "./HealthChecker";
import { Task } from "../../domain/entities/Task";
import type { IProcessManager, ILogger, IEventBus } from "@talos/types";
import { ProcessRegistry } from "../../infrastructure/process/ProcessRegistry";

// Mock dependencies
const mockTaskRepository = {
  findById: vi.fn(),
  findAll: vi.fn(),
  save: vi.fn(),
};

const mockProcessManager: IProcessManager = {
  spawn: vi.fn(),
  register: vi.fn(),
  get: vi.fn(),
  stop: vi.fn(),
  isAlive: vi.fn(),
  isAliveSync: vi.fn(),
  stopProcessGroup: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

const mockProcessRegistry = new ProcessRegistry();
const mockEventBus: IEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  listenerCount: vi.fn(),
  eventNames: vi.fn(),
  subscribe: vi.fn(),
  publish: vi.fn(),
  unsubscribeAll: vi.fn(),
};

const mockLogger: ILogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  audit: vi.fn(),
  setLevel: vi.fn(),
  getLevel: vi.fn(),
};

describe("HealthChecker", () => {
  let healthChecker: HealthChecker;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    healthChecker = new HealthChecker({
      taskRepository: mockTaskRepository,
      processManager: mockProcessManager,
      processRegistry: mockProcessRegistry,
      eventBus: mockEventBus,
      logger: mockLogger,
    });
  });

  afterEach(async () => {
    // Ensure health checker is stopped after each test
    await healthChecker.stop();
  });

  describe("start", () => {
    it("should start periodic health checks with default interval", async () => {
      vi.useFakeTimers();

      await healthChecker.start();

      // Should log start message
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("HealthChecker started with interval: 10000ms")
      );

      // Fast-forward 11 seconds to trigger one health check
      await vi.advanceTimersByTimeAsync(11000);

      // Should have performed health check
      expect(mockTaskRepository.findAll).toHaveBeenCalledWith({ status: "in_progress" });

      vi.useRealTimers();
    });

    it("should start periodic health checks with custom interval", async () => {
      vi.useFakeTimers();

      await healthChecker.start(5000);

      // Should log start message with custom interval
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("HealthChecker started with interval: 5000ms")
      );

      vi.useRealTimers();
    });

    it("should warn if started twice", async () => {
      await healthChecker.start();
      await healthChecker.start();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "HealthChecker already started, ignoring duplicate start() call"
      );
    });

    it("should perform health check immediately on start", async () => {
      mockTaskRepository.findAll.mockResolvedValue([]);

      await healthChecker.start(10000);

      // Should have called findAll immediately
      expect(mockTaskRepository.findAll).toHaveBeenCalledWith({ status: "in_progress" });
    });
  });

  describe("stop", () => {
    it("should stop periodic health checks", async () => {
      vi.useFakeTimers();

      await healthChecker.start(1000);
      await healthChecker.stop();

      expect(mockLogger.info).toHaveBeenCalledWith("🩺 HealthChecker stopped");

      // Fast-forward - should not trigger health check after stop
      mockTaskRepository.findAll.mockClear();
      await vi.advanceTimersByTimeAsync(2000);

      // Should not have been called after stopping
      expect(mockTaskRepository.findAll).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("should warn if stopped when not started", async () => {
      await healthChecker.stop();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "HealthChecker not started, ignoring stop() call"
      );
    });
  });

  describe("checkTaskHealth", () => {
    it("should return alive=true for healthy task", async () => {
      const task = Task.create({
        id: "task-123",
        title: "Test Task",
        description: "Test",
        command: "test",
        workspace: "/workspace",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        pid: 12345,
      });

      mockTaskRepository.findById.mockResolvedValue(task);
      mockProcessManager.isAlive.mockResolvedValue(true);

      const result = await healthChecker.checkTaskHealth("task-123");

      expect(result.alive).toBe(true);
      expect(mockTaskRepository.findById).toHaveBeenCalledWith("task-123");
      expect(mockProcessManager.isAlive).toHaveBeenCalledWith(12345);
    });

    it("should return alive=false if task not found", async () => {
      mockTaskRepository.findById.mockResolvedValue(null);

      const result = await healthChecker.checkTaskHealth("task-123");

      expect(result.alive).toBe(false);
      expect(result.error).toContain("not found");
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("should return alive=false if task has no PID", async () => {
      const task = Task.create({
        id: "task-123",
        title: "Test Task",
        description: "Test",
        command: "test",
        workspace: "/workspace",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
      });

      mockTaskRepository.findById.mockResolvedValue(task);

      const result = await healthChecker.checkTaskHealth("task-123");

      expect(result.alive).toBe(false);
      expect(result.error).toContain("no PID");
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("no PID")
      );
    });

    it("should mark task as failed when process exits", async () => {
      const task = Task.create({
        id: "task-123",
        title: "Test Task",
        description: "Test",
        command: "test",
        workspace: "/workspace",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        pid: 12345,
      });

      // Start the task to set status to in_progress
      task.start();

      mockTaskRepository.findById.mockResolvedValue(task);
      mockProcessManager.isAlive.mockResolvedValue(false);
      mockTaskRepository.save.mockResolvedValue(undefined);

      const result = await healthChecker.checkTaskHealth("task-123");

      expect(result.alive).toBe(false);
      expect(task.status).toBe("failed");
      expect(mockTaskRepository.save).toHaveBeenCalledWith(task);
      expect(mockEventBus.emit).toHaveBeenCalledWith("task:failed", {
        taskId: "task-123",
        error: "Process exited",
      });
    });

    it("should not update task status if already terminal", async () => {
      const task = Task.create({
        id: "task-123",
        title: "Test Task",
        description: "Test",
        command: "test",
        workspace: "/workspace",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        pid: 12345,
      });

      // Mark task as completed (terminal state)
      task.start();
      task.complete();

      mockTaskRepository.findById.mockResolvedValue(task);
      mockProcessManager.isAlive.mockResolvedValue(false);
      mockTaskRepository.save.mockResolvedValue(undefined);

      const result = await healthChecker.checkTaskHealth("task-123");

      expect(result.alive).toBe(false);
      // Task should remain completed, not be changed to failed
      expect(task.status).toBe("completed");
      // Should not save since state didn't change
      expect(mockTaskRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("cleanupZombieProcesses", () => {
    it("should clean up zombie processes", async () => {
      const zombieTask = Task.create({
        id: "zombie-task",
        title: "Zombie Task",
        description: "Test",
        command: "test",
        workspace: "/workspace",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        pid: 99999,
      });

      zombieTask.start();

      mockTaskRepository.findAll.mockResolvedValue([zombieTask]);
      mockProcessManager.isAlive.mockResolvedValue(false);
      mockTaskRepository.save.mockResolvedValue(undefined);

      const result = await healthChecker.cleanupZombieProcesses();

      expect(result).toBe(1);
      expect(zombieTask.status).toBe("failed");
      expect(mockTaskRepository.save).toHaveBeenCalledWith(zombieTask);
      expect(mockEventBus.emit).toHaveBeenCalledWith("task:failed", {
        taskId: "zombie-task",
        error: "Process exited without proper cleanup",
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Zombie cleanup completed: 1 zombies")
      );
    });

    it("should skip tasks with no PID", async () => {
      const taskWithoutPid = Task.create({
        id: "no-pid-task",
        title: "No PID Task",
        description: "Test",
        command: "test",
        workspace: "/workspace",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
      });

      taskWithoutPid.start();

      mockTaskRepository.findAll.mockResolvedValue([taskWithoutPid]);

      const result = await healthChecker.cleanupZombieProcesses();

      expect(result).toBe(0);
      expect(mockTaskRepository.save).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("has no PID")
      );
    });

    it("should not mark alive tasks as zombies", async () => {
      const healthyTask = Task.create({
        id: "healthy-task",
        title: "Healthy Task",
        description: "Test",
        command: "test",
        workspace: "/workspace",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        pid: 12345,
      });

      healthyTask.start();

      mockTaskRepository.findAll.mockResolvedValue([healthyTask]);
      mockProcessManager.isAlive.mockResolvedValue(true);

      const result = await healthChecker.cleanupZombieProcesses();

      expect(result).toBe(0);
      expect(healthyTask.status).toBe("in_progress");
      expect(mockTaskRepository.save).not.toHaveBeenCalled();
    });

    it("should handle multiple tasks correctly", async () => {
      const zombie1 = Task.create({
        id: "zombie-1",
        title: "Zombie 1",
        description: "Test",
        command: "test",
        workspace: "/workspace",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        pid: 11111,
      });

      const zombie2 = Task.create({
        id: "zombie-2",
        title: "Zombie 2",
        description: "Test",
        command: "test",
        workspace: "/workspace",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        pid: 22222,
      });

      const healthy = Task.create({
        id: "healthy",
        title: "Healthy",
        description: "Test",
        command: "test",
        workspace: "/workspace",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        pid: 33333,
      });

      zombie1.start();
      zombie2.start();
      healthy.start();

      mockTaskRepository.findAll.mockResolvedValue([zombie1, zombie2, healthy]);
      mockProcessManager.isAlive.mockImplementation(async (pid: number) => {
        return pid === 33333; // Only healthy task is alive
      });
      mockTaskRepository.save.mockResolvedValue(undefined);

      const result = await healthChecker.cleanupZombieProcesses();

      expect(result).toBe(2);
      expect(zombie1.status).toBe("failed");
      expect(zombie2.status).toBe("failed");
      expect(healthy.status).toBe("in_progress");
    });

    it("should log and continue on task save errors", async () => {
      const zombieTask = Task.create({
        id: "zombie-task",
        title: "Zombie Task",
        description: "Test",
        command: "test",
        workspace: "/workspace",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        pid: 99999,
      });

      zombieTask.start();

      mockTaskRepository.findAll.mockResolvedValue([zombieTask]);
      mockProcessManager.isAlive.mockResolvedValue(false);
      mockTaskRepository.save.mockRejectedValue(new Error("Save failed"));

      const result = await healthChecker.cleanupZombieProcesses();

      // Should return 0 even though zombie was found, because save failed
      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to cleanup zombie task"),
        expect.any(Error)
      );
    });
  });

  describe("integration with periodic checks", () => {
    it("should run periodic health checks on all in_progress tasks", async () => {
      vi.useFakeTimers();

      const task1 = Task.create({
        id: "task-1",
        title: "Task 1",
        description: "Test",
        command: "test",
        workspace: "/workspace",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        pid: 11111,
      });

      const task2 = Task.create({
        id: "task-2",
        title: "Task 2",
        description: "Test",
        command: "test",
        workspace: "/workspace",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        pid: 22222,
      });

      task1.start();
      task2.start();

      mockTaskRepository.findAll.mockResolvedValue([task1, task2]);
      mockProcessManager.isAlive.mockResolvedValue(true);

      await healthChecker.start(1000);

      // Fast-forward to trigger first health check
      await vi.advanceTimersByTimeAsync(1100);

      // Should have checked all tasks via periodic health check
      expect(mockTaskRepository.findAll).toHaveBeenCalledWith({ status: "in_progress" });
      // checkTaskHealth is called for each task, which calls isAlive
      expect(mockProcessManager.isAlive).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("should log health check summary", async () => {
      vi.useFakeTimers();

      const task1 = Task.create({
        id: "task-1",
        title: "Task 1",
        description: "Test",
        command: "test",
        workspace: "/workspace",
        prd: "test-prd",
        branch: "main",
        timestamp: Date.now(),
        pid: 11111,
      });

      task1.start();

      mockTaskRepository.findAll.mockResolvedValue([task1]);
      mockProcessManager.isAlive.mockResolvedValue(true);

      await healthChecker.start(1000);

      // Fast-forward to trigger health check
      await vi.advanceTimersByTimeAsync(1100);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Health check complete: 1 healthy, 0 unhealthy")
      );

      vi.useRealTimers();
    });
  });
});
