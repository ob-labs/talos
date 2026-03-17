/**
 * IPRD - Product Requirements Document Entity Interface
 *
 * Rich domain model for PRD (Product Requirements Document).
 * Contains user stories that need to be implemented.
 *
 * RELATIONSHIP:
 * - PRD contains multiple User Stories
 * - PRD is associated with a Git branch
 * - PRD execution creates Tasks for each story
 *
 * @example
 * ```typescript
 * const prd: IPRD = {
 *   id: 'prd-001',
 *   project: 'Talos',
 *   description: 'Complete system refactor',
 *   branchName: 'feature/refactor',
 *   userStories: [story1, story2, story3],
 *   createdAt: Date.now(),
 *   getCompletedStories() {
 *     return this.userStories.filter(s => s.passes);
 *   },
 *   getCompletionPercentage() {
 *     const completed = this.getCompletedStories().length;
 *     return (completed / this.userStories.length) * 100;
 *   }
 * };
 * ```
 */
export interface IPRD {
  /**
   * Unique PRD identifier
   */
  id: string;

  /**
   * Project name
   */
  project: string;

  /**
   * PRD description
   */
  description: string;

  /**
   * Git branch name for this PRD
   */
  branchName?: string;

  /**
   * User stories in this PRD
   */
  userStories: IStory[];

  /**
   * PRD creation timestamp
   */
  createdAt: number;

  /**
   * PRD last updated timestamp
   */
  updatedAt?: number;

  /**
   * PRD status
   */
  status: PRDStatus;

  // ============================================
  // Domain Methods
  // ============================================

  /**
   * Get all completed stories
   */
  getCompletedStories(): IStory[];

  /**
   * Get all pending stories
   */
  getPendingStories(): IStory[];

  /**
   * Get story by ID
   * @param storyId - Story identifier
   */
  getStory(storyId: string): IStory | undefined;

  /**
   * Get stories sorted by priority
   */
  getStoriesByPriority(): IStory[];

  /**
   * Get next story to work on (highest priority, dependencies met)
   * @param completedStories - Set of completed story IDs
   */
  getNextStory(completedStories: Set<string>): IStory | undefined;

  /**
   * Calculate completion percentage
   */
  getCompletionPercentage(): number;

  /**
   * Check if all stories are completed
   */
  isComplete(): boolean;

  /**
   * Add a user story to the PRD
   * @param story - Story to add
   */
  addStory(story: IStory): void;

  /**
   * Update a user story
   * @param storyId - Story ID to update
   * @param updates - Fields to update
   */
  updateStory(storyId: string, updates: Partial<IStory>): void;

  /**
   * Mark PRD as completed
   */
  markAsCompleted(): void;

  /**
   * Mark PRD as started
   */
  markAsStarted(): void;
}

/**
 * PRD status type
 */
export type PRDStatus =
  | "draft"        // Initial state, being defined
  | "active"       // Currently being executed
  | "completed"    // All stories completed
  | "archived";    // No longer active

/**
 * Import IStory interface for type reference
 * Note: This avoids circular dependency
 */
import type { IStory } from "./IStory";
