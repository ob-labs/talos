/**
 * TaskOrchestrator unit tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskOrchestrator } from "./TaskOrchestrator";
import type { TaskOrchestratorOptions } from "./TaskOrchestrator";
import type {
  ITask,
  IPRD,
  IStory,
  ISessionManager,
  IProgressTracker,
  IUINotifier,
  IMetricsCollector,
  IAuditLogger,
  IEventBus,
  ILogger
} from "@talos/types";

// Mock Task
class MockTask implements ITask {
  id = "task-001";
  status = "pending";
  title = "Test Task";
  description = "Test task description";
  conversation: any[] = [];
  timestamp = Date.now();
  prdId = "prd-001";
  storyId = "US-001";
  role = "ralph-executor";

  start() {
    if (this.status !== "pending") {
      throw new Error("Cannot start task from " + this.status);
    }
    this.status = "in_progress";
    this.startedAt = Date.now();
  }

  complete() {
    if (this.status !== "in_progress") {
      throw new Error("Cannot complete task from " + this.status);
    }
    this.status = "completed";
    this.completedAt = Date.now();
  }

  fail(error: string) {
    this.status = "failed";
    this.error = error;
    this.completedAt = Date.now();
  }

  stop() {
    this.status = "stopped";
  }

  transitionTo(newStatus: any) {
    this.status = newStatus;
  }

  canTransitionTo(newStatus: any) {
    return true;
  }

  addMessage(message: any) {
    this.conversation.push(message);
  }
}

// Mock PRD
class MockPRD implements IPRD {
  id = "prd-001";
  project = "Test Project";
  description = "Test PRD";
  branchName = "test-branch";
  userStories: IStory[] = [];
  createdAt = Date.now();
  status = "active";

  getCompletedStories() {
    return this.userStories.filter((s) => s.passes);
  }

  getPendingStories() {
    return this.userStories.filter((s) => !s.passes);
  }

  getStory(storyId: string) {
    return this.userStories.find((s) => s.id === storyId);
  }

  getStoriesByPriority() {
    return [...this.userStories].sort((a, b) => a.priority - b.priority);
  }

  getNextStory(completedStories: Set<string>) {
    const pending = this.userStories.filter(
      (s) => !completedStories.has(s.id)
    );
    return pending.sort((a, b) => a.priority - b.priority)[0];
  }

  getCompletionPercentage() {
    const completed = this.getCompletedStories().length;
    return (completed / this.userStories.length) * 100;
  }

  isComplete() {
    return this.userStories.every((s) => s.passes);
  }

  addStory(story: IStory) {
    this.userStories.push(story);
  }

  updateStory(storyId: string, updates: Partial<IStory>) {
    const story = this.getStory(storyId);
    if (story) {
      Object.assign(story, updates);
    }
  }

  markAsCompleted() {
    this.status = "completed";
  }

  markAsStarted() {
    this.status = "active";
  }
}

// Mock Story
class MockStory implements IStory {
  id = "US-001";
  title = "Test Story";
  description = "Test story description";
  acceptanceCriteria = ["Criterion 1", "Criterion 2"];
  priority = 1;
  passes = false;
  notes = "";
  status = "pending";
  dependsOn: string[] = [];
  createdAt = Date.now();

  markAsPassing() {
    if (this.dependsOn && this.dependsOn.length > 0) {
      throw new Error("Dependencies not satisfied");
    }
    this.passes = true;
    this.status = "completed";
    this.completedAt = Date.now();
  }

  markAsFailing(reason: string) {
    this.passes = false;
    this.status = "failed";
    this.completedAt = Date.now();
  }

  start() {
    if (this.dependsOn && this.dependsOn.length > 0) {
      throw new Error("Dependencies not satisfied");
    }
    this.status = "in_progress";
    this.startedAt = Date.now();
  }

  areDependenciesSatisfied(completedStories: Set<string>) {
    if (!this.dependsOn) return true;
    return this.dependsOn.every((d) => completedStories.has(d));
  }

  addNote(note: string) {
    this.notes = note;
  }

  canStart(completedStories: Set<string>) {
    return this.areDependenciesSatisfied(completedStories);
  }
}

// Mock dependencies
const mockSessionManager = {
  createSession: vi.fn(),
  getSession: vi.fn(),
  closeSession: vi.fn(),
};

const mockProgressTracker = {
  updateProgress: vi.fn(),
  getProgress: vi.fn(),
  markStoryComplete: vi.fn(),
};

const mockUINotifier = {
  notifyProgress: vi.fn(),
  notifyError: vi.fn(),
  notifyCompletion: vi.fn(),
};

const mockMetricsCollector = {
  recordMetric: vi.fn(),
  getMetrics: vi.fn(),
  resetMetrics: vi.fn(),
};

const mockAuditLogger = {
  logAction: vi.fn(),
  getAuditLogs: vi.fn(),
};

const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  listenerCount: vi.fn(),
  eventNames: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  audit: vi.fn(),
  setLevel: vi.fn(),
  getLevel: vi.fn(),
};

const mockToolExecutor = {
  execute: vi.fn(),
  stop: vi.fn(),
};

const mockToolExecutorFactory = {
  getExecutor: vi.fn(() => mockToolExecutor),
};

describe("TaskOrchestrator", () => {
  let orchestrator: TaskOrchestrator;
  let task: ITask;
  let prd: IPRD;
  let story: IStory;
  let options: TaskOrchestratorOptions;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup test data
    task = new MockTask();
    prd = new MockPRD();
    story = new MockStory();
    prd.addStory(story);

    // Setup dependencies
    options = {
      task,
      prd,
      sessionManager: mockSessionManager as any,
      progressTracker: mockProgressTracker as any,
      uiNotifier: mockUINotifier as any,
      metricsCollector: mockMetricsCollector as any,
      auditLogger: mockAuditLogger as any,
      eventBus: mockEventBus as any,
      logger: mockLogger as any,
      toolExecutorFactory: mockToolExecutorFactory as any,
    };

    orchestrator = new TaskOrchestrator(options);

    // Setup default mock return values
    mockSessionManager.createSession.mockResolvedValue({
      sessionId: "session-001",
      prdId: prd.id,
      roleId: task.role || "ralph-executor",
      createdAt: new Date(),
    });

    mockToolExecutor.execute.mockResolvedValue({
      success: true,
      output: "Story executed successfully",
    });

    mockProgressTracker.updateProgress.mockResolvedValue(undefined);
    mockProgressTracker.markStoryComplete.mockResolvedValue(undefined);
    mockUINotifier.notifyProgress.mockResolvedValue(undefined);
    mockUINotifier.notifyError.mockResolvedValue(undefined);
    mockUINotifier.notifyCompletion.mockResolvedValue(undefined);
    mockMetricsCollector.recordMetric.mockResolvedValue(undefined);
    mockAuditLogger.logAction.mockResolvedValue(undefined);
  });

  describe("start", () => {
    it("should create session and start execution", async () => {
      // Act
      await orchestrator.start();

      // Assert
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        prd.id,
        task.role || "ralph-executor",
        []
      );
      expect(orchestrator.getSessionId()).toBe("session-001");
      expect(task.status).toBe("in_progress");
      expect(mockUINotifier.notifyProgress).toHaveBeenCalledWith(task.id, 0, "Task started");
      expect(mockAuditLogger.logAction).toHaveBeenCalledWith(
        "task_orchestration_started",
        expect.objectContaining({
          taskId: task.id,
          prdId: prd.id,
        })
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith("task:started", expect.any(Object));
    });

    it("should set execution state to running", async () => {
      // Act
      await orchestrator.start();

      // Assert
      expect(orchestrator.getExecutionState()).toBe("running");
    });
  });

  describe("executeStory", () => {
    beforeEach(async () => {
      await orchestrator.start();
    });

    it("should execute story successfully", async () => {
      // Act
      const result = await orchestrator.executeStory(prd.id, story.id);

      // Assert
      expect(result.success).toBe(true);
      expect(mockProgressTracker.updateProgress).toHaveBeenCalledWith(
        prd.id,
        story.id,
        0,
        "Starting story execution"
      );
      expect(mockProgressTracker.updateProgress).toHaveBeenCalledWith(
        prd.id,
        story.id,
        0.5,
        "Executing story"
      );
      expect(mockProgressTracker.updateProgress).toHaveBeenCalledWith(
        prd.id,
        story.id,
        0.8,
        "Validating acceptance criteria"
      );
      expect(mockToolExecutor.execute).toHaveBeenCalled();
      expect(mockMetricsCollector.recordMetric).toHaveBeenCalledWith(
        "story_execution_time",
        expect.any(Number),
        expect.objectContaining({
          taskId: task.id,
          storyId: story.id,
          status: "completed",
        })
      );
    });

    it("should throw error if PRD ID doesn't match", async () => {
      // Act & Assert
      await expect(orchestrator.executeStory("wrong-prd", story.id)).rejects.toThrow(
        "PRD ID mismatch"
      );
    });

    it("should throw error if story not found", async () => {
      // Act & Assert
      await expect(orchestrator.executeStory(prd.id, "wrong-story")).rejects.toThrow(
        "Story wrong-story not found"
      );
    });

    it("should throw error if not in running state", async () => {
      // Arrange
      await orchestrator.stop();

      // Act & Assert
      await expect(orchestrator.executeStory(prd.id, story.id)).rejects.toThrow(
        "Cannot execute story in stopped state"
      );
    });

    it("should handle story execution failure", async () => {
      // Arrange
      mockToolExecutor.execute.mockResolvedValue({
        success: false,
        output: "Execution failed",
      });

      // Act
      const result = await orchestrator.executeStory(prd.id, story.id);

      // Assert
      expect(result.success).toBe(false);
      expect(result.output).toBe("Execution failed");
      expect(mockMetricsCollector.recordMetric).toHaveBeenCalledWith(
        "story_execution_time",
        expect.any(Number),
        expect.objectContaining({
          status: "error",
        })
      );
    });

    it("should handle exceptions during execution", async () => {
      // Arrange
      mockToolExecutor.execute.mockRejectedValue(new Error("Unexpected error"));

      // Act
      const result = await orchestrator.executeStory(prd.id, story.id);

      // Assert
      expect(result.success).toBe(false);
      expect(result.output).toContain("Unexpected error");
      expect(mockUINotifier.notifyError).toHaveBeenCalledWith(
        task.id,
        expect.stringContaining("Unexpected error"),
        expect.any(Object)
      );
    });
  });

  describe("pauseExecution", () => {
    beforeEach(async () => {
      await orchestrator.start();
    });

    it("should pause execution successfully", async () => {
      // Act
      await orchestrator.pauseExecution();

      // Assert
      // No executor running, so stop should not be called
      expect(mockToolExecutor.stop).not.toHaveBeenCalled();
      expect(orchestrator.getExecutionState()).toBe("paused");
      expect(mockAuditLogger.logAction).toHaveBeenCalledWith(
        "task_paused",
        expect.objectContaining({
          taskId: task.id,
        })
      );
      expect(mockUINotifier.notifyProgress).toHaveBeenCalledWith(task.id, 0, "Task paused");
    });

    it("should throw error if not running", async () => {
      // Arrange
      await orchestrator.pauseExecution();

      // Act & Assert
      await expect(orchestrator.pauseExecution()).rejects.toThrow(
        "Cannot pause in paused state"
      );
    });
  });

  describe("resumeExecution", () => {
    beforeEach(async () => {
      await orchestrator.start();
      await orchestrator.pauseExecution();
    });

    it("should resume execution successfully", async () => {
      // Act
      await orchestrator.resumeExecution();

      // Assert
      expect(orchestrator.getExecutionState()).toBe("running");
      expect(mockAuditLogger.logAction).toHaveBeenCalledWith(
        "task_resumed",
        expect.objectContaining({
          taskId: task.id,
        })
      );
      expect(mockUINotifier.notifyProgress).toHaveBeenCalledWith(task.id, 0, "Task resumed");
    });

    it("should throw error if not paused", async () => {
      // Arrange
      await orchestrator.resumeExecution();

      // Act & Assert
      await expect(orchestrator.resumeExecution()).rejects.toThrow(
        "Cannot resume in running state"
      );
    });
  });

  describe("stop", () => {
    it("should stop orchestration successfully", async () => {
      // Arrange
      await orchestrator.start();

      // Act
      await orchestrator.stop();

      // Assert
      // No executor running, so stop should not be called
      expect(mockToolExecutor.stop).not.toHaveBeenCalled();
      expect(mockSessionManager.closeSession).toHaveBeenCalledWith("session-001");
      expect(task.status).toBe("stopped");
      expect(mockUINotifier.notifyCompletion).toHaveBeenCalledWith(
        task.id,
        false,
        expect.any(Object)
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith("task:stopped", expect.any(Object));
      expect(orchestrator.getExecutionState()).toBe("stopped");
    });

    it("should not stop if already stopped", async () => {
      // Arrange
      await orchestrator.start();
      await orchestrator.stop();

      // Act
      await orchestrator.stop();

      // Assert
      expect(mockSessionManager.closeSession).toHaveBeenCalledTimes(1);
    });

    it("should not stop if idle", async () => {
      // Act
      await orchestrator.stop();

      // Assert
      expect(mockSessionManager.closeSession).not.toHaveBeenCalled();
      expect(orchestrator.getExecutionState()).toBe("idle");
    });
  });

  describe("getCurrentStory", () => {
    it("should return current story during execution", async () => {
      // Arrange
      await orchestrator.start();

      // Act
      const promise = orchestrator.executeStory(prd.id, story.id);
      const currentStory = orchestrator.getCurrentStory();

      // Wait for execution to complete
      await promise;

      // Assert
      expect(currentStory).toBeDefined();
      expect(currentStory?.id).toBe(story.id);
    });
  });

  describe("without toolExecutorFactory", () => {
    beforeEach(() => {
      // Remove toolExecutorFactory
      options.toolExecutorFactory = undefined;
      orchestrator = new TaskOrchestrator(options);
    });

    it("should return failure when executing story", async () => {
      // Arrange
      await orchestrator.start();

      // Act
      const result = await orchestrator.executeStory(prd.id, story.id);

      // Assert
      expect(result.success).toBe(false);
      expect(result.output).toContain("Tool executor factory not implemented");
    });
  });
});
