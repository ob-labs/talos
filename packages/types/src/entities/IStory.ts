/**
 * IStory - User Story Entity Interface
 *
 * Rich domain model for User Story from PRD.
 * Represents a requirement from the Product Requirements Document.
 *
 * RELATIONSHIP:
 * - Story belongs to a PRD
 * - Story execution creates Tasks
 * - Stories have acceptance criteria that must be met
 *
 * @example
 * ```typescript
 * const story: IStory = {
 *   id: 'US-001',
 *   title: 'Implement feature X',
 *   description: 'As a user, I want feature X...',
 *   acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
 *   priority: 1,
 *   passes: false,
 *   notes: '',
 *   status: 'pending',
 *   markAsPassing() {
 *     this.passes = true;
 *     this.status = 'completed';
 *   }
 * };
 * ```
 */
export interface IStory {
  /**
   * Unique story identifier (e.g., "US-001")
   */
  id: string;

  /**
   * Story title
   */
  title: string;

  /**
   * Detailed story description
   */
  description: string;

  /**
   * Acceptance criteria for this story
   * All criteria must be met for story to pass
   */
  acceptanceCriteria: string[];

  /**
   * Story priority (lower number = higher priority)
   */
  priority: number;

  /**
   * Whether all acceptance criteria have been met
   */
  passes: boolean;

  /**
   * Additional notes or observations
   */
  notes?: string;

  /**
   * Story dependencies (array of story IDs)
   * These stories must be completed before this one can start
   */
  dependsOn?: string[];

  /**
   * Current execution status
   */
  status: StoryStatus;

  /**
   * Story creation timestamp
   */
  createdAt?: number;

  /**
   * Story start timestamp
   */
  startedAt?: number;

  /**
   * Story completion timestamp
   */
  completedAt?: number;

  // ============================================
  // Domain Methods
  // ============================================

  /**
   * Mark story as passing (all acceptance criteria met)
   * @throws Error if story has unmet dependencies
   */
  markAsPassing(): void;

  /**
   * Mark story as failing
   * @param reason - Reason for failure
   */
  markAsFailing(reason: string): void;

  /**
   * Start story execution
   * @throws Error if dependencies are not met
   */
  start(): void;

  /**
   * Check if all dependencies are satisfied
   * @param completedStories - Set of completed story IDs
   */
  areDependenciesSatisfied(completedStories: Set<string>): boolean;

  /**
   * Add note to story
   * @param note - Note content
   */
  addNote(note: string): void;

  /**
   * Get story duration in seconds
   * Returns undefined if story hasn't completed
   */
  getDuration?(): number | undefined;

  /**
   * Check if story can be started
   * @param completedStories - Set of completed story IDs
   */
  canStart(completedStories: Set<string>): boolean;
}

/**
 * Story status type
 */
export type StoryStatus =
  | "pending"      // Not started, dependencies may not be met
  | "ready"        // Dependencies met, ready to start
  | "in_progress"  // Currently being executed
  | "completed"    // All acceptance criteria met
  | "failed";      // Execution failed

/**
 * Story result (renamed to avoid conflict with existing StoryExecutionResult)
 */
export interface StoryResult {
  storyId: string;
  storyTitle: string;
  status: StoryStatus;
  duration?: number; // in seconds
  error?: string;
  filesChanged?: string[];
  commits?: string[];
  notes?: string;
}
