import type { Worktree, Story, WorktreeState, SessionData, TaskMessage, Task } from "@talos/types";
import { LocalStorageEngine } from "./storage";
import { GitWorktree } from "@talos/git";
import { workspaceStorage } from "./workspace";
import { createHash } from "crypto";

const WORKTREES_DIR = "worktrees";
const SESSIONS_DIR = "sessions";
const TASKS_DIR = "tasks";

/**
 * Worktree storage service
 * Manages worktree data persistence to worktrees/*.json
 */
export class WorktreeStorage {
  private storage: LocalStorageEngine;

  constructor(storage?: LocalStorageEngine) {
    this.storage = storage || new LocalStorageEngine();
  }

  /**
   * Get the file path for a worktree
   */
  private getWorktreePath(worktreeId: string): string {
    return `${WORKTREES_DIR}/${worktreeId}.json`;
  }

  /**
   * Get all worktrees
   *
   * @returns Array of all worktrees
   *
   * @example
   * ```typescript
   * const worktrees = await worktreeStorage.getAllWorktrees();
   * console.log(`Found ${worktrees.length} worktrees`);
   * ```
   */
  async getAllWorktrees(): Promise<Worktree[]> {
    const files = await this.storage.listFiles(WORKTREES_DIR, ".json");
    const worktrees: Worktree[] = [];

    for (const file of files) {
      const worktreeId = file.replace(".json", "");
      const worktree = await this.getWorktree(worktreeId);
      if (worktree) {
        worktrees.push(worktree);
      }
    }

    return worktrees;
  }

  /**
   * Get worktrees by workspace ID
   *
   * @param workspaceId - The workspace identifier
   * @returns Array of worktrees belonging to the workspace
   *
   * @example
   * ```typescript
   * const worktrees = await worktreeStorage.getWorktreesByWorkspace("ws-my-repo");
   * ```
   */
  async getWorktreesByWorkspace(workspaceId: string): Promise<Worktree[]> {
    const allWorktrees = await this.getAllWorktrees();
    return allWorktrees.filter((worktree) => worktree.workspaceId === workspaceId);
  }

  /**
   * Get a worktree by ID
   *
   * @param worktreeId - The worktree identifier
   * @returns The worktree object or null if not found
   *
   * @example
   * ```typescript
   * const worktree = await worktreeStorage.getWorktree("worktree-123");
   * if (worktree) {
   *   console.log(`Found worktree: ${worktree.title}`);
   * }
   * ```
   */
  async getWorktree(worktreeId: string): Promise<Worktree | null> {
    return await this.storage.readJSON<Worktree>(this.getWorktreePath(worktreeId));
  }

  /**
   * Create a new worktree
   *
   * Creates a new worktree with an auto-generated ID.
   * Automatically creates a Git worktree for non-default worktrees.
   *
   * @param name - The worktree name (used for file path)
   * @param title - The display title for the worktree
   * @param branchName - The Git branch name
   * @param workspaceId - The workspace identifier
   * @param isDefault - Whether this is the default worktree (defaults to false)
   * @param stories - Optional array of initial stories
   * @returns The created worktree object
   *
   * @example
   * ```typescript
   * const worktree = await worktreeStorage.createWorktree(
   *   "feature-branch",
   *   "Feature Branch",
   *   "feature/new-feature",
   *   "ws-my-repo",
   *   false,
   *   []
   * );
   * ```
   */
  async createWorktree(
    name: string,
    title: string,
    branchName: string,
    workspaceId: string,
    isDefault: boolean = false,
    stories: Story[] = []
  ): Promise<Worktree> {
    const id = `worktree-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const progress = this.calculateProgress(stories);

    // Get workspace to determine worktree path
    const workspace = await workspaceStorage.getWorkspace(workspaceId);
    const worktreePath = workspace ? `${workspace.path}/../${branchName}` : "";

    const worktree: Worktree = {
      id,
      name,
      title,
      branchName,
      status: "pending",
      progress,
      isDefault,
      terminal: [],
      stories,
      workspaceId,
      path: worktreePath, // Include worktree path for terminal sessions
    };

    // Determine status based on stories and isDefault flag
    worktree.status = this.determineWorktreeState(worktree);

    // Create Git worktree for non-default worktrees
    if (!isDefault) {
      try {
        if (workspace) {
          const gitWorktree = new GitWorktree(workspace.path);
          const result = await gitWorktree.createFromBranch(worktreePath, branchName);

          if (!result.success) {
            console.warn(`Failed to create worktree for worktree ${id}:`, result.error);
            // Don't throw - worktree is still created even if worktree creation fails
          }
        }
      } catch (error) {
        console.warn(`Error creating worktree for worktree ${id}:`, error);
        // Don't throw - worktree is still created even if worktree creation fails
      }
    }

    await this.storage.writeJSON(this.getWorktreePath(id), worktree);
    return worktree;
  }

  /**
   * Create a default worktree for the current branch
   *
   * Creates a default worktree that represents the current branch.
   * Does not create a Git worktree (uses the workspace path directly).
   *
   * @param branchName - The current branch name
   * @param workspaceId - The workspace identifier
   * @param workspacePath - The file system path to the workspace
   * @returns The created default worktree
   *
   * @example
   * ```typescript
   * const worktree = await worktreeStorage.createDefaultWorktree(
   *   "main",
   *   "ws-my-repo",
   *   "/path/to/project"
   * );
   * ```
   */
  async createDefaultWorktree(
    branchName: string,
    workspaceId: string,
    workspacePath: string
  ): Promise<Worktree> {
    const id = `worktree-default-${workspaceId}`;
    const name = workspacePath.split("/").pop() || "default";

    const worktree: Worktree = {
      id,
      name,
      title: `当前分支: ${branchName}`,
      branchName,
      status: "default",
      progress: 0,
      isDefault: true,
      terminal: [],
      stories: [],
      workspaceId,
      path: workspacePath, // Default worktree uses workspace path
    };

    await this.storage.writeJSON(this.getWorktreePath(id), worktree);
    return worktree;
  }

  /**
   * Update a worktree
   *
   * Updates worktree fields with partial data.
   * The worktree ID and progress cannot be directly changed (progress is recalculated if stories change).
   *
   * @param worktreeId - The worktree identifier
   * @param updates - Partial worktree object with fields to update
   * @returns The updated worktree or null if not found
   *
   * @example
   * ```typescript
   * const updated = await worktreeStorage.updateWorktree("worktree-123", {
   *   title: "Updated Title",
   *   status: "running"
   * });
   * ```
   */
  async updateWorktree(
    worktreeId: string,
    updates: Partial<Omit<Worktree, "id" | "progress">>
  ): Promise<Worktree | null> {
    const worktree = await this.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    const updatedWorktree = { ...worktree, ...updates };
    // Recalculate progress if stories changed
    if (updates.stories) {
      updatedWorktree.progress = this.calculateProgress(updates.stories);
    }

    await this.storage.writeJSON(this.getWorktreePath(worktreeId), updatedWorktree);
    return updatedWorktree;
  }

  /**
   * Delete a worktree
   *
   * Permanently removes a worktree from storage.
   * Automatically removes the Git worktree for non-default worktrees.
   *
   * @param worktreeId - The worktree identifier
   * @returns True if deleted, false if not found
   *
   * @example
   * ```typescript
   * const deleted = await worktreeStorage.deleteWorktree("worktree-123");
   * if (deleted) {
   *   console.log("Worktree deleted successfully");
   * }
   * ```
   */
  async deleteWorktree(worktreeId: string): Promise<boolean> {
    const worktree = await this.getWorktree(worktreeId);
    if (!worktree) {
      return false;
    }

    // Remove Git worktree for non-default worktrees
    if (!worktree.isDefault) {
      try {
        const workspace = await workspaceStorage.getWorkspace(worktree.workspaceId);
        if (workspace) {
          const worktreePath = `${workspace.path}/../${worktree.branchName}`;
          const gitWorktree = new GitWorktree(workspace.path);
          const result = await gitWorktree.remove(worktreePath, true);

          if (!result.success) {
            console.warn(`Failed to remove worktree for worktree ${worktreeId}:`, result.error);
            // Don't throw - worktree is still deleted even if worktree removal fails
          }
        }
      } catch (error) {
        console.warn(`Error removing worktree for worktree ${worktreeId}:`, error);
        // Don't throw - worktree is still deleted even if worktree removal fails
      }
    }

    await this.storage.deleteFile(this.getWorktreePath(worktreeId));
    return true;
  }

  /**
   * Add a story to a worktree
   *
   * Adds a story to the worktree and recalculates progress.
   *
   * @param worktreeId - The worktree identifier
   * @param story - The story object to add
   * @returns The updated worktree or null if not found
   *
   * @example
   * ```typescript
   * const worktree = await worktreeStorage.addStoryToWorktree(
   *   "worktree-123",
   *   { id: "story-456", title: "My Story", ... }
   * );
   * ```
   */
  async addStoryToWorktree(
    worktreeId: string,
    story: Story
  ): Promise<Worktree | null> {
    const worktree = await this.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    worktree.stories.push(story);
    worktree.progress = this.calculateProgress(worktree.stories);

    await this.storage.writeJSON(this.getWorktreePath(worktreeId), worktree);
    return worktree;
  }

  /**
   * Update a story in a worktree
   *
   * Updates a specific story within the worktree.
   * Recalculates progress and updates worktree status.
   *
   * @param worktreeId - The worktree identifier
   * @param storyId - The story identifier
   * @param updates - Partial story object with fields to update
   * @returns The updated worktree or null if not found
   *
   * @example
   * ```typescript
   * const worktree = await worktreeStorage.updateStoryInWorktree(
   *   "worktree-123",
   *   "story-456",
   *   { status: "completed" }
   * );
   * ```
   */
  async updateStoryInWorktree(
    worktreeId: string,
    storyId: string,
    updates: Partial<Story>
  ): Promise<Worktree | null> {
    const worktree = await this.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    const storyIndex = worktree.stories.findIndex((s: Story) => s.id === storyId);
    if (storyIndex === -1) {
      return null;
    }

    worktree.stories[storyIndex] = { ...worktree.stories[storyIndex], ...updates };
    worktree.progress = this.calculateProgress(worktree.stories);
    worktree.status = this.determineWorktreeState(worktree);

    await this.storage.writeJSON(this.getWorktreePath(worktreeId), worktree);
    return worktree;
  }

  /**
   * Remove a story from a worktree
   *
   * Removes a story from the worktree and recalculates progress.
   *
   * @param worktreeId - The worktree identifier
   * @param storyId - The story identifier to remove
   * @returns The updated worktree or null if not found
   *
   * @example
   * ```typescript
   * const worktree = await worktreeStorage.removeStoryFromWorktree(
   *   "worktree-123",
   *   "story-456"
   * );
   * ```
   */
  async removeStoryFromWorktree(
    worktreeId: string,
    storyId: string
  ): Promise<Worktree | null> {
    const worktree = await this.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    worktree.stories = worktree.stories.filter((s: Story) => s.id !== storyId);
    worktree.progress = this.calculateProgress(worktree.stories);

    await this.storage.writeJSON(this.getWorktreePath(worktreeId), worktree);
    return worktree;
  }

  /**
   * Toggle story completion status
   *
   * Toggles the completed flag for a story and updates worktree progress and status.
   *
   * @param worktreeId - The worktree identifier
   * @param storyId - The story identifier
   * @returns The updated worktree or null if not found
   *
   * @example
   * ```typescript
   * const worktree = await worktreeStorage.toggleStoryCompletion(
   *   "worktree-123",
   *   "story-456"
   * );
   * ```
   */
  async toggleStoryCompletion(
    worktreeId: string,
    storyId: string
  ): Promise<Worktree | null> {
    const worktree = await this.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    const story = worktree.stories.find((s: Story) => s.id === storyId);
    if (!story) {
      return null;
    }

    story.passes = !story.passes;
    worktree.progress = this.calculateProgress(worktree.stories);
    worktree.status = this.determineWorktreeState(worktree);

    await this.storage.writeJSON(this.getWorktreePath(worktreeId), worktree);
    return worktree;
  }

  /**
   * Update worktree status
   *
   * Sets the worktree status directly.
   *
   * @param worktreeId - The worktree identifier
   * @param status - The new status
   * @returns The updated worktree or null if not found
   *
   * @example
   * ```typescript
   * const worktree = await worktreeStorage.updateStatus(
   *   "worktree-123",
   *   "running"
   * );
   * ```
   */
  async updateStatus(
    worktreeId: string,
    status: WorktreeState
  ): Promise<Worktree | null> {
    const worktree = await this.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    worktree.status = status;
    await this.storage.writeJSON(this.getWorktreePath(worktreeId), worktree);
    return worktree;
  }

  /**
   * Add terminal log to worktree
   *
   * Adds a terminal log entry to the worktree's terminal history.
   * Limits history to 1000 entries, removing oldest when limit is reached.
   *
   * @param worktreeId - The worktree identifier
   * @param type - The log type (system, info, success, error, warning, command)
   * @param message - The log message
   * @returns The updated worktree or null if not found
   *
   * @example
   * ```typescript
   * const worktree = await worktreeStorage.addTerminalLog(
   *   "worktree-123",
   *   "info",
   *   "Starting execution"
   * );
   * ```
   */
  async addTerminalLog(
    worktreeId: string,
    type: "system" | "info" | "success" | "error" | "warning" | "command",
    message: string
  ): Promise<Worktree | null> {
    const worktree = await this.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    worktree.terminal.push({
      type,
      message,
      timestamp: Date.now(),
    });

    // Limit terminal history to 1000 entries (reduced for performance)
    if (worktree.terminal.length > 1000) {
      worktree.terminal = worktree.terminal.slice(-1000);
    }

    await this.storage.writeJSON(this.getWorktreePath(worktreeId), worktree);
    return worktree;
  }

  /**
   * Clear terminal logs for a worktree
   *
   * Removes all terminal log entries from the worktree.
   *
   * @param worktreeId - The worktree identifier
   * @returns The updated worktree or null if not found
   *
   * @example
   * ```typescript
   * const worktree = await worktreeStorage.clearTerminalLogs("worktree-123");
   * ```
   */
  async clearTerminalLogs(worktreeId: string): Promise<Worktree | null> {
    const worktree = await this.getWorktree(worktreeId);
    if (!worktree) {
      return null;
    }

    worktree.terminal = [];
    await this.storage.writeJSON(this.getWorktreePath(worktreeId), worktree);
    return worktree;
  }

  /**
   * Check if a worktree exists
   *
   * @param worktreeId - The worktree identifier
   * @returns True if the worktree exists, false otherwise
   *
   * @example
   * ```typescript
   * if (await worktreeStorage.worktreeExists("worktree-123")) {
   *   console.log("Worktree exists");
   * }
   * ```
   */
  async worktreeExists(worktreeId: string): Promise<boolean> {
    return await this.storage.fileExists(this.getWorktreePath(worktreeId));
  }

  // ============================================
  // Session Methods
  // ============================================

  /**
   * Get the file path for a session
   * @private
   */
  private getSessionPath(sessionId: string): string {
    return `${SESSIONS_DIR}/${sessionId}.json`;
  }

  /**
   * Generate a session ID from PRD ID and role ID
   * Uses SHA-256 hash to create deterministic session IDs
   * @private
   */
  private generateSessionId(prdId: string, roleId: string): string {
    const hash = createHash("sha256")
      .update(`${prdId}:${roleId}`)
      .digest("hex");
    return `sess_${hash.substring(0, 16)}`;
  }

  /**
   * Get a session by ID
   *
   * Retrieves session data from storage.
   *
   * @param sessionId - The session identifier
   * @returns The session object or null if not found
   *
   * @example
   * ```typescript
   * const session = await worktreeStorage.getSession("sess_abc123");
   * if (session) {
   *   console.log(`Found session: ${session.id}`);
   * }
   * ```
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    return await this.storage.readJSON<SessionData>(this.getSessionPath(sessionId));
  }

  /**
   * Get or create a session for a PRD and role
   *
   * Returns an existing session if found, creates a new one otherwise.
   * The session ID is deterministically generated from the PRD ID and role ID.
   *
   * @param prdId - The PRD identifier
   * @param roleId - The role identifier
   * @param initialConversation - Optional initial conversation messages
   * @returns The existing or newly created session
   *
   * @example
   * ```typescript
   * const session = await worktreeStorage.getOrCreateSession(
   *   "my-prd",
   *   "developer",
   *   [{ role: "user", content: "Hello" }]
   * );
   * ```
   */
  async getOrCreateSession(
    prdId: string,
    roleId: string,
    initialConversation: TaskMessage[] = []
  ): Promise<SessionData> {
    const sessionId = this.generateSessionId(prdId, roleId);
    const existingSession = await this.getSession(sessionId);

    if (existingSession) {
      return existingSession;
    }

    const newSession: SessionData = {
      id: sessionId,
      prdId,
      roleId,
      conversation: initialConversation,
      lastUsedAt: Date.now(),
    };

    await this.createSession(newSession);
    return newSession;
  }

  /**
   * Create a new session
   *
   * Creates a new session with the provided data.
   * Automatically sets the lastUsedAt timestamp.
   *
   * @param session - The session object to create
   * @returns The created session with updated timestamp
   *
   * @example
   * ```typescript
   * const session = await worktreeStorage.createSession({
   *   id: "sess_abc123",
   *   prdId: "my-prd",
   *   roleId: "developer",
   *   conversation: []
   * });
   * ```
   */
  async createSession(session: SessionData): Promise<SessionData> {
    const sessionToSave: SessionData = {
      ...session,
      lastUsedAt: Date.now(),
    };

    await this.storage.writeJSON(
      this.getSessionPath(sessionToSave.id),
      sessionToSave
    );

    return sessionToSave;
  }

  /**
   * Update an existing session
   *
   * Updates session fields with partial data.
   * The session ID cannot be changed.
   * Automatically updates the lastUsedAt timestamp.
   *
   * @param sessionId - The session identifier
   * @param updates - Partial session object with fields to update
   * @returns The updated session or null if not found
   *
   * @example
   * ```typescript
   * const updated = await worktreeStorage.updateSession(
   *   "sess_abc123",
   *   { conversation: [...newMessages] }
   * );
   * ```
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Omit<SessionData, "id">>
  ): Promise<SessionData | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const updatedSession: SessionData = {
      ...session,
      ...updates,
      id: session.id, // Ensure ID cannot be changed
      lastUsedAt: Date.now(),
    };

    await this.storage.writeJSON(
      this.getSessionPath(sessionId),
      updatedSession
    );

    return updatedSession;
  }

  /**
   * Delete a session
   *
   * Permanently removes a session from storage.
   *
   * @param sessionId - The session identifier
   * @returns True if deleted, false if not found
   *
   * @example
   * ```typescript
   * const deleted = await worktreeStorage.deleteSession("sess_abc123");
   * if (deleted) {
   *   console.log("Session deleted successfully");
   * }
   * ```
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const exists = await this.storage.fileExists(this.getSessionPath(sessionId));
    if (!exists) {
      return false;
    }

    await this.storage.deleteFile(this.getSessionPath(sessionId));
    return true;
  }

  /**
   * List all sessions
   *
   * @returns Array of all sessions
   *
   * @example
   * ```typescript
   * const sessions = await worktreeStorage.listSessions();
   * console.log(`Found ${sessions.length} sessions`);
   * ```
   */
  async listSessions(): Promise<SessionData[]> {
    const files = await this.storage.listFiles(SESSIONS_DIR, ".json");
    const sessions: SessionData[] = [];

    for (const file of files) {
      const sessionId = file.replace(".json", "");
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * List sessions for a specific PRD
   *
   * @param prdId - The PRD identifier to filter by
   * @returns Array of sessions for the PRD
   *
   * @example
   * ```typescript
   * const sessions = await worktreeStorage.listSessionsByPRD("my-prd");
   * ```
   */
  async listSessionsByPRD(prdId: string): Promise<SessionData[]> {
    const allSessions = await this.listSessions();
    return allSessions.filter((session) => session.prdId === prdId);
  }

  /**
   * List sessions for a specific role
   *
   * @param roleId - The role identifier to filter by
   * @returns Array of sessions for the role
   *
   * @example
   * ```typescript
   * const sessions = await worktreeStorage.listSessionsByRole("developer");
   * ```
   */
  async listSessionsByRole(roleId: string): Promise<SessionData[]> {
    const allSessions = await this.listSessions();
    return allSessions.filter((session) => session.roleId === roleId);
  }

  // ============================================
  // Task Methods
  // ============================================

  /**
   * Get the file path for a task
   * @private
   */
  private getTaskPath(taskId: string): string {
    return `${TASKS_DIR}/${taskId}.json`;
  }

  /**
   * Get a task by ID
   *
   * Retrieves task metadata from storage.
   *
   * @param taskId - The task identifier
   * @returns The task object or null if not found
   *
   * @example
   * ```typescript
   * const task = await worktreeStorage.getTask("task-123");
   * if (task) {
   *   console.log(`Found task: ${task.id}`);
   * }
   * ```
   */
  async getTask(taskId: string): Promise<Task | null> {
    return await this.storage.readJSON<Task>(this.getTaskPath(taskId));
  }

  /**
   * Create a new task
   *
   * Creates a task with an auto-generated ID if not provided.
   *
   * @param task - Task object without required ID (will be generated if not provided)
   * @returns The created task with generated ID
   *
   * @example
   * ```typescript
   * const task = await worktreeStorage.createTask({
   *   status: "pending",
   *   conversation: [],
   *   role: "developer"
   * });
   * console.log(`Created task: ${task.id}`);
   * ```
   */
  async createTask(task: Omit<Task, "id"> & { id?: string }): Promise<Task> {
    const taskId = task.id || `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const taskToSave: Task = {
      id: taskId,
      status: task.status,
      conversation: task.conversation,
      role: task.role,
      timestamp: task.timestamp || Date.now(),
    };

    await this.storage.writeJSON(this.getTaskPath(taskId), taskToSave);
    return taskToSave;
  }

  /**
   * Update an existing task
   *
   * Updates task fields with partial data.
   * The task ID cannot be changed.
   *
   * @param taskId - The task identifier
   * @param updates - Partial task object with fields to update
   * @returns The updated task or null if not found
   *
   * @example
   * ```typescript
   * const updated = await worktreeStorage.updateTask("task-123", {
   *   status: "completed",
   *   conversation: [...newMessages]
   * });
   * ```
   */
  async updateTask(
    taskId: string,
    updates: Partial<Omit<Task, "id">>
  ): Promise<Task | null> {
    const task = await this.getTask(taskId);
    if (!task) {
      return null;
    }

    const updatedTask: Task = {
      ...task,
      ...updates,
      id: task.id, // Ensure ID cannot be changed
    };

    await this.storage.writeJSON(this.getTaskPath(taskId), updatedTask);
    return updatedTask;
  }

  /**
   * Delete a task
   *
   * Permanently removes a task from storage.
   *
   * @param taskId - The task identifier
   * @returns True if deleted, false if not found
   *
   * @example
   * ```typescript
   * const deleted = await worktreeStorage.deleteTask("task-123");
   * if (deleted) {
   *   console.log("Task deleted successfully");
   * }
   * ```
   */
  async deleteTask(taskId: string): Promise<boolean> {
    const exists = await this.storage.fileExists(this.getTaskPath(taskId));
    if (!exists) {
      return false;
    }

    await this.storage.deleteFile(this.getTaskPath(taskId));
    return true;
  }

  /**
   * List all tasks
   *
   * @returns Array of all tasks
   *
   * @example
   * ```typescript
   * const tasks = await worktreeStorage.listTasks();
   * console.log(`Found ${tasks.length} tasks`);
   * const pendingTasks = tasks.filter(t => t.status === "pending");
   * ```
   */
  async listTasks(): Promise<Task[]> {
    const files = await this.storage.listFiles(TASKS_DIR, ".json");
    const tasks: Task[] = [];

    for (const file of files) {
      const taskId = file.replace(".json", "");
      const task = await this.getTask(taskId);
      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  /**
   * Calculate progress percentage based on stories
   */
  private calculateProgress(stories: Story[]): number {
    if (stories.length === 0) {
      return 0;
    }

    const passingCount = stories.filter((s) => s.passes).length;
    return Math.round((passingCount / stories.length) * 100);
  }

  /**
   * Determine worktree status based on stories
   */
  private determineWorktreeState(worktree: Worktree): WorktreeState {
    if (worktree.isDefault) {
      return "default";
    }

    if (worktree.stories.length === 0) {
      return "pending";
    }

    const allPassing = worktree.stories.every((s: Story) => s.passes);
    if (allPassing) {
      return "completed";
    }

    return "pending";
  }
}

// Default instance for convenience
export const worktreeStorage = new WorktreeStorage();
