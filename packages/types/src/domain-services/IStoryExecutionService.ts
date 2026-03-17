/**
 * IStoryExecutionService - Story Execution Service Interface
 *
 * Domain service for executing user stories.
 * Orchestrates the execution of stories through Claude Code agents.
 *
 * RESPONSIBILITIES:
 * - Story execution lifecycle management
 * - Agent coordination and monitoring
 * - Execution result tracking
 * - Error handling and recovery
 *
 * @example
 * ```typescript
 * const result = await storyExecutionService.execute(story, {
 *   workingDir: '/path/to/project',
 *   model: 'claude-sonnet-4-6',
 *   debug: false
 * });
 *
 * if (result.success) {
 *   console.log('Story completed:', result.filesChanged);
 * } else {
 *   console.error('Story failed:', result.error);
 * }
 * ```
 */
export interface IStoryExecutionService {
  /**
   * Execute a user story
   *
   * @param story - Story to execute
   * @param options - Execution options
   * @returns Execution result
   */
  execute(story: IStory, options: ExecutionOptions): Promise<StoryExecutionResult>;

  /**
   * Execute multiple stories in sequence
   * Stories are executed in priority order
   *
   * @param stories - Stories to execute
   * @param options - Execution options
   * @returns Array of execution results
   */
  executeBatch(stories: IStory[], options: ExecutionOptions): Promise<StoryExecutionResult[]>;

  /**
   * Stop an ongoing story execution
   *
   * @param storyId - Story identifier to stop
   */
  stop(storyId: string): Promise<void>;

  /**
   * Get execution status for a story
   *
   * @param storyId - Story identifier
   * @returns Current execution status
   */
  getStatus(storyId: string): Promise<StoryExecutionStatus>;

  /**
   * Get execution logs for a story
   *
   * @param storyId - Story identifier
   * @returns Execution logs
   */
  getLogs(storyId: string): Promise<string[]>;
}

/**
 * Story execution options
 */
export interface ExecutionOptions {
  /**
   * Working directory for execution
   */
  workingDir: string;

  /**
   * AI model to use for execution
   */
  model?: string;

  /**
   * Debug mode (verbose logging)
   */
  debug?: boolean;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * Maximum retries for failed execution
   */
  maxRetries?: number;

  /**
   * Resume from previous execution
   */
  resume?: boolean;

  /**
   * Custom agent role
   */
  role?: string;
}

/**
 * Story execution result
 */
export interface StoryExecutionResult {
  /**
   * Story identifier
   */
  storyId: string;

  /**
   * Story title
   */
  storyTitle: string;

  /**
   * Execution success status
   */
  success: boolean;

  /**
   * Execution status
   */
  status: "completed" | "failed" | "stopped";

  /**
   * Duration in seconds
   */
  duration?: number;

  /**
   * Error message if failed
   */
  error?: string;

  /**
   * Files changed during execution
   */
  filesChanged?: string[];

  /**
   * Git commits made during execution
   */
  commits?: string[];

  /**
   * Execution notes
   */
  notes?: string;

  /**
   * Timestamp of completion
   */
  completedAt?: number;
}

/**
 * Story execution status (renamed to avoid conflict with existing ExecutionStatus)
 */
export interface StoryExecutionStatus {
  /**
   * Story identifier
   */
  storyId: string;

  /**
   * Current status
   */
  status: "pending" | "running" | "completed" | "failed" | "stopped";

  /**
   * Progress percentage (0-100)
   */
  progress: number;

  /**
   * Current operation being performed
   */
  currentOperation?: string;

  /**
   * Execution start time
   */
  startedAt?: number;

  /**
   * Estimated time remaining (seconds)
   */
  estimatedTimeRemaining?: number;
}

/**
 * Import IStory entity interface
 */
import type { IStory } from "../entities/IStory";
