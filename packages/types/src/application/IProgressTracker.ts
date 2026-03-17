/**
 * Progress Tracker Interface
 *
 * Tracks and reports progress of PRD execution.
 * Provides real-time progress updates and story completion tracking.
 */
export interface IProgressTracker {
  /**
   * Update progress for a story
   *
   * @param prdId - PRD identifier
   * @param storyId - Story identifier
   * @param progress - Progress value between 0 and 1
   * @param message - Optional progress message
   */
  updateProgress(prdId: string, storyId: string, progress: number, message?: string): Promise<void>;

  /**
   * Get progress for a PRD or specific story
   *
   * @param prdId - PRD identifier
   * @param storyId - Optional story identifier (if omitted, returns overall PRD progress)
   * @returns Progress information with completed/total counts or specific story progress
   */
  getProgress(prdId: string, storyId?: string): Promise<{ completed: number; total: number } | { progress: number; message?: string }>;

  /**
   * Mark a story as complete
   *
   * @param prdId - PRD identifier
   * @param storyId - Story identifier
   * @param passed - Whether the story passed acceptance criteria
   * @param notes - Optional notes about story completion
   */
  markStoryComplete(prdId: string, storyId: string, passed: boolean, notes?: string): Promise<void>;

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
  };
}
