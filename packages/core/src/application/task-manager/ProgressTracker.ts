/**
 * Progress Tracker
 *
 * Tracks and reports progress of PRD execution.
 * Provides real-time progress updates and story completion tracking.
 *
 * RESPONSIBILITIES:
 * - Track story execution progress
 * - Calculate overall PRD completion
 * - Mark stories as complete/failed
 * - Publish progress events
 *
 * DEPENDENCIES:
 * - task: ITask - Task being executed
 * - prd: IPRD - PRD containing user stories
 * - prdRepository: IPRDRepository - PRD persistence
 * - eventBus: IEventBus - Event emission
 * - logger: ILogger - Logging
 */

import type {
  ITask,
  IPRD,
  IStory,
  IPRDRepository,
  IEventBus,
  ILogger,
  IProgressTracker,
} from "@talos/types";

/**
 * Progress Tracker Options
 */
export interface ProgressTrackerOptions {
  task: ITask;
  prd: IPRD;
  prdRepository: IPRDRepository;
  eventBus: IEventBus;
  logger: ILogger;
}

/**
 * Progress Tracker Class
 *
 * Implements progress tracking for PRD execution.
 * Tracks story-level progress and overall PRD completion.
 */
export class ProgressTracker implements IProgressTracker {
  private task: ITask;
  private prd: IPRD;
  private prdRepository: IPRDRepository;
  private eventBus: IEventBus;
  private logger: ILogger;

  // In-memory progress tracking for active stories
  private storyProgress = new Map<string, { progress: number; message?: string }>();

  constructor(options: ProgressTrackerOptions) {
    this.task = options.task;
    this.prd = options.prd;
    this.prdRepository = options.prdRepository;
    this.eventBus = options.eventBus;
    this.logger = options.logger;
  }

  /**
   * Update progress for a story
   *
   * Updates story progress in memory and publishes progress event.
   * Progress is not persisted to storage until story is marked complete.
   *
   * @param prdId - PRD identifier
   * @param storyId - Story identifier
   * @param progress - Progress value between 0 and 1
   * @param message - Optional progress message
   */
  async updateProgress(
    prdId: string,
    storyId: string,
    progress: number,
    message?: string
  ): Promise<void> {
    if (prdId !== this.prd.id) {
      throw new Error(`PRD ID mismatch: expected ${this.prd.id}, got ${prdId}`);
    }

    // Validate progress value
    if (progress < 0 || progress > 1) {
      throw new Error(`Progress must be between 0 and 1, got ${progress}`);
    }

    // Store progress in memory
    this.storyProgress.set(storyId, { progress, message });

    // Publish progress event
    this.eventBus.emit("story:progress", {
      storyId,
      prdId,
      progress,
      message,
      taskId: this.task.id,
      timestamp: Date.now(),
    });

    this.logger.info(
      `Progress updated for story ${storyId}: ${(progress * 100).toFixed(1)}%${message ? ` - ${message}` : ""}`
    );
  }

  /**
   * Get progress for a PRD or specific story
   *
   * Returns either overall PRD progress (completed/total counts)
   * or specific story progress (progress value and message).
   *
   * @param prdId - PRD identifier
   * @param storyId - Optional story identifier (if omitted, returns overall PRD progress)
   * @returns Progress information with completed/total counts or specific story progress
   */
  async getProgress(
    prdId: string,
    storyId?: string
  ): Promise<{ completed: number; total: number } | { progress: number; message?: string }> {
    if (prdId !== this.prd.id) {
      throw new Error(`PRD ID mismatch: expected ${this.prd.id}, got ${prdId}`);
    }

    // If storyId is provided, return story-specific progress
    if (storyId) {
      const storyProgress = this.storyProgress.get(storyId);
      if (storyProgress) {
        return { progress: storyProgress.progress, message: storyProgress.message };
      }
      // If no in-memory progress, check if story is completed
      const story = this.prd.getStory(storyId);
      if (story?.passes) {
        return { progress: 1, message: "Completed" };
      }
      return { progress: 0, message: "Not started" };
    }


    // Return overall PRD progress
    const total = this.prd.userStories.length;
    const completed = this.prd.getCompletedStories().length;
    return {
      completed,
      total,
    };
  }

  /**

  /**
   * Mark a story as complete
   *
   * Marks story completion status, updates story.passes in PRD,
   * saves PRD to repository, and publishes completion event.
   *
   * @param prdId - PRD identifier
   * @param storyId - Story identifier
   * @param passed - Whether the story passed acceptance criteria
   * @param notes - Optional notes about story completion
   */
  async markStoryComplete(
    prdId: string,
    storyId: string,
    passed: boolean,
    notes?: string
  ): Promise<void> {
    if (prdId !== this.prd.id) {
      throw new Error(`PRD ID mismatch: expected ${this.prd.id}, got ${prdId}`);
    }

    const story = this.prd.getStory(storyId);
    if (!story) {
      throw new Error(`Story ${storyId} not found in PRD ${prdId}`);
    }

    // Update story status in PRD
    if (passed) {
      // Start story if not already in progress, then mark as passing
      if (story.status === "pending" || story.status === "ready") {
        story.start();
      }
      story.markAsPassing();
      this.logger.info(`Story ${storyId} marked as passing`);
    } else {
      // markAsFailing can be called from any state
      story.markAsFailing(notes || "Failed acceptance criteria");
      this.logger.warn(`Story ${storyId} marked as failing: ${notes}`);
    }

    // Add notes if provided
    if (notes) {
      story.addNote(notes);
    }

    // Save PRD to repository
    await this.prdRepository.save(this.prd);

    // Update in-memory progress to 100% or 0% based on pass/fail
    this.storyProgress.set(storyId, { progress: passed ? 1 : 0, message: notes });

    // Publish completion event
    if (passed) {
      this.eventBus.emit("story:completed", {
        storyId,
        storyTitle: story.title,
        prdId,
        taskId: this.task.id,
        timestamp: Date.now(),
      });
    } else {
      this.eventBus.emit("story:failed", {
        storyId,
        storyTitle: story.title,
        prdId,
        taskId: this.task.id,
        timestamp: Date.now(),
        error: notes,
      });
    }

    // Check if PRD is complete and publish event if so
    if (this.isPRDComplete()) {
      this.prd.markAsCompleted();
      await this.prdRepository.save(this.prd);

      this.eventBus.emit("prd:completed", {
        prdId: this.prd.id,
        projectName: this.prd.project,
        timestamp: Date.now(),
        totalStories: this.prd.userStories.length,
        completedStories: this.prd.getCompletedStories().length,
      });

      this.logger.info(`PRD ${prdId} completed`);
    }
  }

  /**
   * Check if all stories in the PRD pass acceptance criteria
   *
   * @returns true if all stories pass, false otherwise
   */
  isPRDComplete(): boolean {
    return this.prd.isComplete();
  }

  /**
   * Get current execution progress summary
   *
   * Returns detailed progress information including total, passing,
   * incomplete counts, and percentage.
   *
   * @returns Progress summary object
   */
  getExecutionProgress(): {
    total: number;
    passing: number;
    incomplete: number;
    percentage: number;
  } {
    const total = this.prd.userStories.length;
    const passing = this.prd.getCompletedStories().length;
    const incomplete = total - passing;
    const percentage = this.prd.getCompletionPercentage();
    return { total, passing, incomplete, percentage };
  }

  /**
   * Clear in-memory progress tracking
   * Useful for testing or resetting progress state.
   */
  clearProgress(): void {
    this.storyProgress.clear();
    this.logger.info("Progress tracking cleared");
  }
}
