/**
 * Task Orchestrator Interface
 *
 * Coordinates the execution of PRD user stories.
 * Manages story execution flow, pause/resume capabilities.
 */
export interface ITaskOrchestrator {
  /**
   * Start task orchestration
   *
   * Creates session and starts execution loop.
   */
  start(): Promise<void>;

  /**
   * Stop task orchestration
   *
   * Stops AI tool execution, closes session.
   */
  stop(): Promise<void>;

  /**
   * Execute a user story
   *
   * @param prdId - PRD identifier
   * @param storyId - Story identifier to execute
   * @returns Execution result with success status and optional output
   */
  executeStory(prdId: string, storyId: string): Promise<{ success: boolean; output?: string }>;

  /**
   * Pause current execution
   *
   * Gracefully pauses ongoing story execution.
   * Allows resumption from the current state.
   *
   * @returns Promise that resolves when execution is paused
   */
  pauseExecution(): Promise<void>;

  /**
   * Resume paused execution
   *
   * Continues execution from where it was paused.
   *
   * @returns Promise that resolves when execution is resumed
   */
  resumeExecution(): Promise<void>;
}
