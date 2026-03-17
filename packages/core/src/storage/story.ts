import type { Story, TerminalLog } from "@talos/types";
import { WorktreeStorage } from "./worktree";

/**
 * Story storage service
 * Manages story data within worktrees
 * Stories are embedded in worktree files, not stored separately
 */
export class StoryStorage {
  private worktreeStorage: WorktreeStorage;

  constructor(worktreeStorage?: WorktreeStorage) {
    this.worktreeStorage = worktreeStorage || new WorktreeStorage();
  }

  /**
   * Get all stories from a worktree
   *
   * @param worktreeId - The worktree identifier
   * @returns Array of all stories in the worktree
   *
   * @example
   * ```typescript
   * const stories = await storyStorage.getStories("worktree-123");
   * console.log(`Found ${stories.length} stories`);
   * ```
   */
  async getStories(worktreeId: string): Promise<Story[]> {
    const worktree = await this.worktreeStorage.getWorktree(worktreeId);
    if (!worktree) {
      return [];
    }
    return worktree.stories;
  }

  /**
   * Get a story by ID from a worktree
   *
   * @param worktreeId - The worktree identifier
   * @param storyId - The story identifier
   * @returns The story object or null if not found
   *
   * @example
   * ```typescript
   * const story = await storyStorage.getStory("worktree-123", "story-456");
   * if (story) {
   *   console.log(`Found story: ${story.title}`);
   * }
   * ```
   */
  async getStory(worktreeId: string, storyId: string): Promise<Story | null> {
    const worktree = await this.worktreeStorage.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    const story = worktree.stories.find((s: Story) => s.id === storyId);
    return story || null;
  }

  /**
   * Create a new story in a worktree
   *
   * Creates a new story with an auto-generated ID.
   *
   * @param worktreeId - The worktree identifier
   * @param title - The story title
   * @param description - The story description
   * @param options - Optional story configuration (acceptanceCriteria, priority, status)
   * @returns The created story or null if worktree not found
   *
   * @example
   * ```typescript
   * const story = await storyStorage.createStory(
   *   "worktree-123",
   *   "Add user authentication",
   *   "Implement login and signup",
   *   {
   *     acceptanceCriteria: ["Login form", "Signup form"],
   *     priority: 1,
   *     status: "pending"
   *   }
   * );
   * ```
   */
  async createStory(
    worktreeId: string,
    title: string,
    description: string,
    options: {
      acceptanceCriteria?: string[];
      priority?: number;
    } = {}
  ): Promise<Story | null> {
    const worktree = await this.worktreeStorage.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    const id = `story-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const story: Story = {
      id,
      title,
      description,
      acceptanceCriteria: options.acceptanceCriteria || [],
      priority: options.priority ?? 0,
      passes: false,
      terminal: [],
    };

    worktree.stories.push(story);
    await this.worktreeStorage.updateWorktree(worktreeId, { stories: worktree.stories });

    return story;
  }

  /**
   * Update a story
   *
   * Updates story fields with partial data.
   * The story ID cannot be changed.
   * Automatically syncs completed status with status field.
   *
   * @param worktreeId - The worktree identifier
   * @param storyId - The story identifier
   * @param updates - Partial story object with fields to update
   * @returns The updated story or null if not found
   *
   * @example
   * ```typescript
   * const updated = await storyStorage.updateStory(
   *   "worktree-123",
   *   "story-456",
   *   { title: "Updated title", status: "completed" }
   * );
   * ```
   */
  async updateStory(
    worktreeId: string,
    storyId: string,
    updates: Partial<Omit<Story, "id">>
  ): Promise<Story | null> {
    const worktree = await this.worktreeStorage.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    const storyIndex = worktree.stories.findIndex((s: Story) => s.id === storyId);
    if (storyIndex === -1) {
      return null;
    }

    worktree.stories[storyIndex] = { ...worktree.stories[storyIndex], ...updates };
    await this.worktreeStorage.updateWorktree(worktreeId, { stories: worktree.stories });

    return worktree.stories[storyIndex];
  }

  /**
   * Delete a story from a worktree
   *
   * @param worktreeId - The worktree identifier
   * @param storyId - The story identifier to delete
   * @returns True if deleted, false if story or worktree not found
   *
   * @example
   * ```typescript
   * const deleted = await storyStorage.deleteStory("worktree-123", "story-456");
   * if (deleted) {
   *   console.log("Story deleted successfully");
   * }
   * ```
   */
  async deleteStory(worktreeId: string, storyId: string): Promise<boolean> {
    const worktree = await this.worktreeStorage.getWorktree(worktreeId);
    if (!worktree) {
      return false;
    }

    const initialLength = worktree.stories.length;
    worktree.stories = worktree.stories.filter((s: Story) => s.id !== storyId);

    if (worktree.stories.length === initialLength) {
      return false;
    }

    await this.worktreeStorage.updateWorktree(worktreeId, { stories: worktree.stories });
    return true;
  }

  /**
   * Toggle story passes status
   *
   * Toggles the passes flag.
   *
   * @param worktreeId - The worktree identifier
   * @param storyId - The story identifier
   * @returns The updated story or null if not found
   *
   * @example
   * ```typescript
   * const story = await storyStorage.toggleStoryPasses("worktree-123", "story-456");
   * console.log(`Passes: ${story?.passes}`);
   * ```
   */
  async toggleStoryPasses(
    worktreeId: string,
    storyId: string
  ): Promise<Story | null> {
    const worktree = await this.worktreeStorage.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    const story = worktree.stories.find((s: Story) => s.id === storyId);
    if (!story) {
      return null;
    }

    story.passes = !story.passes;

    await this.worktreeStorage.updateWorktree(worktreeId, { stories: worktree.stories });
    return story;
  }

  /**
   * Update story passes status
   *
   * Updates the story passes flag.
   *
   * @param worktreeId - The worktree identifier
   * @param storyId - The story identifier
   * @param passes - Whether the story passes acceptance criteria
   * @returns The updated story or null if not found
   *
   * @example
   * ```typescript
   * const story = await storyStorage.updateStoryPasses(
   *   "worktree-123",
   *   "story-456",
   *   true
   * );
   * ```
   */
  async updateStoryPasses(
    worktreeId: string,
    storyId: string,
    passes: boolean
  ): Promise<Story | null> {
    const worktree = await this.worktreeStorage.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    const story = worktree.stories.find((s: Story) => s.id === storyId);
    if (!story) {
      return null;
    }

    story.passes = passes;

    await this.worktreeStorage.updateWorktree(worktreeId, { stories: worktree.stories });
    return story;
  }

  /**
   * Mark story as completed (passes = true)
   *
   * Convenience method to mark story as completed.
   *
   * @param worktreeId - The worktree identifier
   * @param storyId - The story identifier
   * @returns The updated story or null if not found
   *
   * @example
   * ```typescript
   * await storyStorage.markStoryCompleted("worktree-123", "story-456");
   * ```
   */
  async markStoryCompleted(
    worktreeId: string,
    storyId: string
  ): Promise<Story | null> {
    return this.updateStoryPasses(worktreeId, storyId, true);
  }

  /**
   * Add terminal log to a story
   *
   * Adds a terminal log entry to the story's terminal history.
   * Limits history to 1000 entries, removing oldest when limit is reached.
   *
   * @param worktreeId - The worktree identifier
   * @param storyId - The story identifier
   * @param type - The log type (system, info, success, error, warning, command)
   * @param message - The log message
   * @returns The updated story or null if not found
   *
   * @example
   * ```typescript
   * await storyStorage.addTerminalLog(
   *   "worktree-123",
   *   "story-456",
   *   "info",
   *   "Starting task execution"
   * );
   * ```
   */
  async addTerminalLog(
    worktreeId: string,
    storyId: string,
    type: TerminalLog["type"],
    message: string
  ): Promise<Story | null> {
    const worktree = await this.worktreeStorage.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    const story = worktree.stories.find((s: Story) => s.id === storyId);
    if (!story) {
      return null;
    }

    story.terminal.push({
      type,
      message,
      timestamp: Date.now(),
    });

    // Limit terminal history to 1000 entries
    if (story.terminal.length > 1000) {
      story.terminal = story.terminal.slice(-1000);
    }

    await this.worktreeStorage.updateWorktree(worktreeId, { stories: worktree.stories });
    return story;
  }

  /**
   * Clear terminal logs for a story
   *
   * Removes all terminal log entries from the story.
   *
   * @param worktreeId - The worktree identifier
   * @param storyId - The story identifier
   * @returns The updated story or null if not found
   *
   * @example
   * ```typescript
   * await storyStorage.clearTerminalLogs("worktree-123", "story-456");
   * ```
   */
  async clearTerminalLogs(
    worktreeId: string,
    storyId: string
  ): Promise<Story | null> {
    const worktree = await this.worktreeStorage.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    const story = worktree.stories.find((s: Story) => s.id === storyId);
    if (!story) {
      return null;
    }

    story.terminal = [];
    await this.worktreeStorage.updateWorktree(worktreeId, { stories: worktree.stories });
    return story;
  }

  /**
   * Add a commit to a story
   *
   * Associates a Git commit with the story.
   *
   * @param worktreeId - The worktree identifier
   * @param storyId - The story identifier
   * @param commit - The commit information (hash, message, timestamp)
   * @returns The updated story or null if not found
   *
   * @example
   * ```typescript
   * await storyStorage.addStoryCommit(
   *   "worktree-123",
   *   "story-456",
   *   {
   *     hash: "abc123def",
   *     message: "feat: Implement story",
   *     timestamp: Date.now()
   *   }
   * );
   * ```
   */
  async addStoryCommit(
    worktreeId: string,
    storyId: string,
    commit: {
      hash: string;
      message: string;
      timestamp?: number;
    }
  ): Promise<Story | null> {
    const worktree = await this.worktreeStorage.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    const story = worktree.stories.find((s: Story) => s.id === storyId);
    if (!story) {
      return null;
    }

    story.commit = {
      hash: commit.hash,
      message: commit.message,
      timestamp: commit.timestamp || Date.now(),
    };

    await this.worktreeStorage.updateWorktree(worktreeId, { stories: worktree.stories });
    return story;
  }

  /**
   * Remove commit from a story
   *
   * Removes the associated Git commit from the story.
   *
   * @param worktreeId - The worktree identifier
   * @param storyId - The story identifier
   * @returns The updated story or null if not found
   *
   * @example
   * ```typescript
   * await storyStorage.removeStoryCommit("worktree-123", "story-456");
   * ```
   */
  async removeStoryCommit(
    worktreeId: string,
    storyId: string
  ): Promise<Story | null> {
    const worktree = await this.worktreeStorage.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    const story = worktree.stories.find((s: Story) => s.id === storyId);
    if (!story) {
      return null;
    }

    delete story.commit;
    await this.worktreeStorage.updateWorktree(worktreeId, { stories: worktree.stories });
    return story;
  }

  /**
   * Get stories by passes status
   *
   * Filters stories by their passes status.
   *
   * @param worktreeId - The worktree identifier
   * @param passes - The passes status to filter by
   * @returns Array of stories with the given passes status
   *
   * @example
   * ```typescript
   * const incompleteStories = await storyStorage.getStoriesByPasses("worktree-123", false);
   * ```
   */
  async getStoriesByPasses(
    worktreeId: string,
    passes: boolean
  ): Promise<Story[]> {
    const stories = await this.getStories(worktreeId);
    return stories.filter((s: Story) => s.passes === passes);
  }

  /**
   * Get incomplete stories (passes = false)
   *
   * Convenience method to get all incomplete stories.
   *
   * @param worktreeId - The worktree identifier
   * @returns Array of incomplete stories
   *
   * @example
   * ```typescript
   * const incompleteStories = await storyStorage.getIncompleteStories("worktree-123");
   * ```
   */
  async getIncompleteStories(worktreeId: string): Promise<Story[]> {
    return this.getStoriesByPasses(worktreeId, false);
  }

  /**
   * Get passing stories (passes = true)
   *
   * Convenience method to get all passing stories.
   *
   * @param worktreeId - The worktree identifier
   * @returns Array of passing stories
   *
   * @example
   * ```typescript
   * const passingStories = await storyStorage.getPassingStories("worktree-123");
   * ```
   */
  async getPassingStories(worktreeId: string): Promise<Story[]> {
    return this.getStoriesByPasses(worktreeId, true);
  }

  /**
   * Reorder stories within a worktree
   *
   * Changes the order of stories based on the provided array of story IDs.
   * All story IDs must exist in the worktree.
   *
   * @param worktreeId - The worktree identifier
   * @param storyIds - Array of story IDs in the desired order
   * @returns True if reordered, false if validation failed
   *
   * @example
   * ```typescript
   * const success = await storyStorage.reorderStories(
   *   "worktree-123",
   *   ["story-456", "story-789", "story-123"]
   * );
   * ```
   */
  async reorderStories(worktreeId: string, storyIds: string[]): Promise<boolean> {
    const worktree = await this.worktreeStorage.getWorktree(worktreeId);
    if (!worktree) {
      return false;
    }

    // Validate all story IDs exist
    const validStoryIds = new Set(worktree.stories.map((s: Story) => s.id));
    const allExist = storyIds.every((id) => validStoryIds.has(id));

    if (!allExist) {
      return false;
    }

    // Reorder stories based on the provided order
    const storyMap = new Map(worktree.stories.map((s: Story) => [s.id, s]));
    worktree.stories = storyIds.map((id) => storyMap.get(id)!);

    await this.worktreeStorage.updateWorktree(worktreeId, { stories: worktree.stories });
    return true;
  }

  /**
   * Get story count by passes status
   *
   * Returns counts of stories grouped by passes status.
   *
   * @param worktreeId - The worktree identifier
   * @returns Object with counts for each status
   *
   * @example
   * ```typescript
   * const counts = await storyStorage.getStoryCounts("worktree-123");
   * console.log(`Total: ${counts.total}, Passing: ${counts.passing}`);
   * ```
   */
  async getStoryCounts(worktreeId: string): Promise<{
    total: number;
    passing: number;
    incomplete: number;
  }> {
    const stories = await this.getStories(worktreeId);

    return {
      total: stories.length,
      passing: stories.filter((s: Story) => s.passes).length,
      incomplete: stories.filter((s: Story) => !s.passes).length,
    };
  }

  /**
   * Check if a story exists
   *
   * @param worktreeId - The worktree identifier
   * @param storyId - The story identifier
   * @returns True if the story exists, false otherwise
   *
   * @example
   * ```typescript
   * if (await storyStorage.storyExists("worktree-123", "story-456")) {
   *   console.log("Story exists");
   * }
   * ```
   */
  async storyExists(worktreeId: string, storyId: string): Promise<boolean> {
    const story = await this.getStory(worktreeId, storyId);
    return story !== null;
  }
}

// Default instance for convenience
export const storyStorage = new StoryStorage();
