/**
 * Progress Tracker Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProgressTracker } from "./ProgressTracker";
import type { ITask, IPRD, IStory, IPRDRepository, IEventBus, ILogger } from "@talos/types";
import { Story, PRD } from "../../domain/entities";

describe("ProgressTracker", () => {
  let progressTracker: ProgressTracker;
  let mockTask: ITask;
  let mockPRD: PRD;
  let mockStory1: Story;
  let mockStory2: Story;
  let mockStory3: Story;
  let mockPRDRepository: IPRDRepository;
  let mockEventBus: IEventBus;
  let mockLogger: ILogger;

  beforeEach(() => {
    // Create mock stories
    mockStory1 = Story.create({
      id: "US-001",
      title: "First Story",
      description: "Test story 1",
      acceptanceCriteria: ["Criteria 1"],
      priority: 1,
    });

    mockStory2 = Story.create({
      id: "US-002",
      title: "Second Story",
      description: "Test story 2",
      acceptanceCriteria: ["Criteria 2"],
      priority: 2,
    });

    mockStory3 = Story.create({
      id: "US-003",
      title: "Third Story",
      description: "Test story 3",
      acceptanceCriteria: ["Criteria 3"],
      priority: 3,
    });

    // Create mock PRD
    mockPRD = PRD.create({
      id: "prd-001",
      project: "Test Project",
      description: "Test PRD",
      branchName: "test-branch",
      userStories: [mockStory1, mockStory2, mockStory3],
    });

    // Create mock task
    mockTask = {
      id: "task-001",
      status: "running",
      command: "test",
      tool: "claude",
      workspace: {
        name: "test-workspace",
        path: "/test/path",
      },
      prdId: "prd-001",
      branch: "test-branch",
      worktree: "/test/worktree",
      pid: 12345,
      progress: 0,
      createdAt: Date.now(),
      startedAt: Date.now(),
    } as ITask;

    // Create mock PRD repository
    mockPRDRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      findByBranch: vi.fn(),
      findActive: vi.fn(),
    };

    // Create mock event bus
    mockEventBus = {
      on: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      removeAllListeners: vi.fn(),
      listenerCount: vi.fn(),
      eventNames: vi.fn(),
    };

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      audit: vi.fn(),
      setLevel: vi.fn(),
      getLevel: vi.fn(),
    };

    // Create progress tracker
    progressTracker = new ProgressTracker({
      task: mockTask,
      prd: mockPRD,
      prdRepository: mockPRDRepository,
      eventBus: mockEventBus,
      logger: mockLogger,
    });
  });

  describe("updateProgress", () => {
    it("should update story progress and publish event", async () => {
      await progressTracker.updateProgress("prd-001", "US-001", 0.5, "Half complete");

      const progress = await progressTracker.getProgress("prd-001", "US-001");
      expect(progress).toEqual({ progress: 0.5, message: "Half complete" });

      expect(mockEventBus.emit).toHaveBeenCalledWith("story:progress", {
        storyId: "US-001",
        prdId: "prd-001",
        progress: 0.5,
        message: "Half complete",
        taskId: "task-001",
        timestamp: expect.any(Number),
      });
    });

    it("should throw error for invalid PRD ID", async () => {
      await expect(
        progressTracker.updateProgress("wrong-prd", "US-001", 0.5)
      ).rejects.toThrow("PRD ID mismatch");
    });

    it("should throw error for progress < 0", async () => {
      await expect(
        progressTracker.updateProgress("prd-001", "US-001", -0.1)
      ).rejects.toThrow("Progress must be between 0 and 1");
    });

    it("should throw error for progress > 1", async () => {
      await expect(
        progressTracker.updateProgress("prd-001", "US-001", 1.1)
      ).rejects.toThrow("Progress must be between 0 and 1");
    });

    it("should allow progress of 0 and 1", async () => {
      await progressTracker.updateProgress("prd-001", "US-001", 0);
      await progressTracker.updateProgress("prd-001", "US-002", 1);

      expect(mockEventBus.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe("getProgress", () => {
    it("should return overall PRD progress when storyId is not provided", async () => {
      const progress = await progressTracker.getProgress("prd-001");

      expect(progress).toEqual({
        completed: 0,
        total: 3,
      });
    });

    it("should return story-specific progress when storyId is provided", async () => {
      await progressTracker.updateProgress("prd-001", "US-001", 0.75, "Almost done");

      const progress = await progressTracker.getProgress("prd-001", "US-001");

      expect(progress).toEqual({
        progress: 0.75,
        message: "Almost done",
      });
    });

    it("should return progress 1 for completed stories", async () => {
      mockStory1.start();
      mockStory1.markAsPassing();
      const progress = await progressTracker.getProgress("prd-001", "US-001");

      expect(progress).toEqual({
        progress: 1,
        message: "Completed",
      });
    });

    it("should return progress 0 for not started stories", async () => {
      const progress = await progressTracker.getProgress("prd-001", "US-001");

      expect(progress).toEqual({
        progress: 0,
        message: "Not started",
      });
    });

    it("should throw error for invalid PRD ID", async () => {
      await expect(
        progressTracker.getProgress("wrong-prd")
      ).rejects.toThrow("PRD ID mismatch");
    });
  });

  describe("markStoryComplete", () => {
    it("should mark story as passing and publish event", async () => {
      await progressTracker.markStoryComplete("prd-001", "US-001", true, "All tests passed");

      expect(mockStory1.passes).toBe(true);
      expect(mockStory1.status).toBe("completed");
      expect(mockStory1.notes).toContain("All tests passed");
      expect(mockPRDRepository.save).toHaveBeenCalledWith(mockPRD);
      expect(mockEventBus.emit).toHaveBeenCalledWith("story:completed", {
        storyId: "US-001",
        storyTitle: "First Story",
        prdId: "prd-001",
        taskId: "task-001",
        timestamp: expect.any(Number),
      });
    });

    it("should mark story as failing and publish failed event", async () => {
      await progressTracker.markStoryComplete("prd-001", "US-001", false, "Tests failed");

      expect(mockStory1.passes).toBe(false);
      expect(mockStory1.status).toBe("failed");
      expect(mockStory1.notes).toContain("Tests failed");
      expect(mockPRDRepository.save).toHaveBeenCalledWith(mockPRD);
      expect(mockEventBus.emit).toHaveBeenCalledWith("story:failed", {
        storyId: "US-001",
        storyTitle: "First Story",
        prdId: "prd-001",
        taskId: "task-001",
        timestamp: expect.any(Number),
        error: "Tests failed",
      });
    });

    it("should publish PRD completed event when all stories pass", async () => {
      // Complete all stories
      await progressTracker.markStoryComplete("prd-001", "US-001", true);
      await progressTracker.markStoryComplete("prd-001", "US-002", true);
      await progressTracker.markStoryComplete("prd-001", "US-003", true);

      expect(mockPRD.status).toBe("completed");
      expect(mockEventBus.emit).toHaveBeenCalledWith("prd:completed", {
        prdId: "prd-001",
        projectName: "Test Project",
        timestamp: expect.any(Number),
        totalStories: 3,
        completedStories: 3,
      });
    });

    it("should throw error for invalid PRD ID", async () => {
      await expect(
        progressTracker.markStoryComplete("wrong-prd", "US-001", true)
      ).rejects.toThrow("PRD ID mismatch");
    });

    it("should throw error for non-existent story", async () => {
      await expect(
        progressTracker.markStoryComplete("prd-001", "US-999", true)
      ).rejects.toThrow("Story US-999 not found in PRD prd-001");
    });

    it("should update in-memory progress after marking complete", async () => {
      await progressTracker.markStoryComplete("prd-001", "US-001", true, "Done");

      const progress = await progressTracker.getProgress("prd-001", "US-001");
      expect(progress).toEqual({
        progress: 1,
        message: "Done",
      });
    });

    it("should set progress to 0 for failed stories", async () => {
      await progressTracker.markStoryComplete("prd-001", "US-001", false, "Failed");

      const progress = await progressTracker.getProgress("prd-001", "US-001");
      expect(progress).toEqual({
        progress: 0,
        message: "Failed",
      });
    });
  });

  describe("isPRDComplete", () => {
    it("should return false when no stories are completed", () => {
      expect(progressTracker.isPRDComplete()).toBe(false);
    });

    it("should return false when some stories are completed", async () => {
      await progressTracker.markStoryComplete("prd-001", "US-001", true);

      expect(progressTracker.isPRDComplete()).toBe(false);
    });

    it("should return true when all stories are completed", async () => {
      await progressTracker.markStoryComplete("prd-001", "US-001", true);
      await progressTracker.markStoryComplete("prd-001", "US-002", true);
      await progressTracker.markStoryComplete("prd-001", "US-003", true);

      expect(progressTracker.isPRDComplete()).toBe(true);
    });

    it("should return false when any story fails", async () => {
      await progressTracker.markStoryComplete("prd-001", "US-001", true);
      await progressTracker.markStoryComplete("prd-001", "US-002", false, "Failed");
      await progressTracker.markStoryComplete("prd-001", "US-003", true);

      expect(progressTracker.isPRDComplete()).toBe(false);
    });
  });

  describe("getExecutionProgress", () => {
    it("should return initial progress", () => {
      const progress = progressTracker.getExecutionProgress();

      expect(progress).toEqual({
        total: 3,
        passing: 0,
        incomplete: 3,
        percentage: 0,
      });
    });

    it("should return updated progress after completing stories", async () => {
      await progressTracker.markStoryComplete("prd-001", "US-001", true);

      const progress = progressTracker.getExecutionProgress();

      expect(progress).toEqual({
        total: 3,
        passing: 1,
        incomplete: 2,
        percentage: 33,
      });
    });

    it("should return 100% when all stories complete", async () => {
      await progressTracker.markStoryComplete("prd-001", "US-001", true);
      await progressTracker.markStoryComplete("prd-001", "US-002", true);
      await progressTracker.markStoryComplete("prd-001", "US-003", true);

      const progress = progressTracker.getExecutionProgress();

      expect(progress).toEqual({
        total: 3,
        passing: 3,
        incomplete: 0,
        percentage: 100,
      });
    });
  });

  describe("clearProgress", () => {
    it("should clear in-memory progress tracking", async () => {
      await progressTracker.updateProgress("prd-001", "US-001", 0.5, "Half done");
      await progressTracker.updateProgress("prd-001", "US-002", 0.75, "Almost done");

      progressTracker.clearProgress();

      const progress1 = await progressTracker.getProgress("prd-001", "US-001");
      const progress2 = await progressTracker.getProgress("prd-001", "US-002");

      // After clearing, should return default progress for non-completed stories
      expect(progress1).toEqual({ progress: 0, message: "Not started" });
      expect(progress2).toEqual({ progress: 0, message: "Not started" });
    });

    it("should log debug message when clearing", () => {
      progressTracker.clearProgress();

      expect(mockLogger.info).toHaveBeenCalledWith("Progress tracking cleared");
    });
  });

  describe("integration scenarios", () => {
    it("should track progress through multiple story updates", async () => {
      // Start first story
      await progressTracker.updateProgress("prd-001", "US-001", 0, "Starting");
      await progressTracker.updateProgress("prd-001", "US-001", 0.5, "In progress");
      await progressTracker.markStoryComplete("prd-001", "US-001", true);

      // Start second story
      await progressTracker.updateProgress("prd-001", "US-002", 0.25, "Started");
      await progressTracker.updateProgress("prd-001", "US-002", 0.5, "Half done");
      await progressTracker.markStoryComplete("prd-001", "US-002", true);

      // Start third story
      await progressTracker.updateProgress("prd-001", "US-003", 0.1, "Just started");

      // Check overall progress
      const overallProgress = await progressTracker.getProgress("prd-001");
      expect(overallProgress).toEqual({ completed: 2, total: 3 });

      // Check individual story progress
      const story3Progress = await progressTracker.getProgress("prd-001", "US-003");
      expect(story3Progress).toEqual({ progress: 0.1, message: "Just started" });

      // Complete third story
      await progressTracker.markStoryComplete("prd-001", "US-003", true);

      // Verify PRD is complete
      expect(progressTracker.isPRDComplete()).toBe(true);
    });
  });
});
