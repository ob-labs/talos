import type { Workspace } from "@talos/types";
import { LocalStorageEngine } from "./storage";
import { homedir } from "os";
import * as path from "path";
import { promises as fs } from "fs";

const WORKSPACES_DIR = "workspaces";
const USER_PREFERENCES_FILE = "user-preferences.json";

/**
 * User preferences data structure
 * 用户偏好设置数据结构
 *
 * Note: This interface is duplicated from apps/web/lib/storage/user-preferences.ts
 * to avoid circular dependency with UI types (LayoutState, SidebarView).
 * This version is maintained in the storage package for WorkspaceStorage to use.
 */
export interface UserPreferences {
  /** Currently selected workspace ID */
  activeWorkspace: string | null;
  /** Currently selected worktree ID */
  activeWorktree: string | null;
  /** Currently selected story ID */
  activeStory: string | null;
  /** Current sidebar view mode */
  sidebarView: "workspace" | "task" | "worktree";
  /** Left panel collapsed state */
  isLeftPanelCollapsed: boolean;
  /** Right panel collapsed state */
  isRightPanelCollapsed: boolean;
  /** Last update timestamp */
  lastUpdated: number;
  /** Preferences version */
  version: string;
}

/**
 * Default user preferences
 * 默认用户偏好设置
 */
const defaultPreferences: UserPreferences = {
  activeWorkspace: null,
  activeWorktree: null,
  activeStory: null,
  sidebarView: "workspace",
  isLeftPanelCollapsed: false,
  isRightPanelCollapsed: false,
  lastUpdated: Date.now(),
  version: "1.0",
};

/**
 * Workspace storage service
 * Manages workspace data persistence to ~/.talos/workspaces/*.json
 *
 * 工作区存储服务
 * 管理工作区数据持久化到 ~/.talos/workspaces/*.json
 */
export class WorkspaceStorage {
  private storage: LocalStorageEngine;

  constructor(storage?: LocalStorageEngine) {
    // Use ~/.talos as base directory for all workspace data
    // 使用 ~/.talos 作为所有工作区数据的基础目录
    this.storage = storage || new LocalStorageEngine(`${homedir()}/.talos`);
  }

  /**
   * Get the file path for a workspace
   */
  private getWorkspacePath(workspaceId: string): string {
    return `${WORKSPACES_DIR}/${workspaceId}.json`;
  }

  /**
   * Get all workspaces
   *
   * Retrieves all workspace metadata from storage.
   *
   * @returns Array of all workspaces
   *
   * @example
   * ```typescript
   * const workspaces = await workspaceStorage.getAllWorkspaces();
   * console.log(`Found ${workspaces.length} workspaces`);
   * ```
   */
  async getAllWorkspaces(): Promise<Workspace[]> {
    // Try workspaces.json first (current format)
    try {
      const workspacesData = await this.storage.readJSON<any>("workspaces.json");
      if (workspacesData && workspacesData.workspaces) {
        return workspacesData.workspaces;
      }
    } catch (error) {
      // Fall through to try other formats
    }

    // Try config.json (legacy format)
    try {
      const globalConfig = await this.storage.readJSON<any>("config.json");
      return globalConfig.workspaces || [];
    } catch (error) {
      // Fallback to old format if global config doesn't exist
      const files = await this.storage.listFiles(WORKSPACES_DIR, ".json");
      const workspaces: Workspace[] = [];

      for (const file of files) {
        const workspaceId = file.replace(".json", "");
        const workspace = await this.getWorkspace(workspaceId);
        if (workspace) {
          workspaces.push(workspace);
        }
      }

      return workspaces;
    }
  }

  /**
   * Get a workspace by ID
   *
   * Retrieves workspace metadata from storage.
   *
   * @param workspaceId - The workspace identifier (e.g., "ws-my-repo")
   * @returns The workspace object or null if not found
   *
   * @example
   * ```typescript
   * const workspace = await workspaceStorage.getWorkspace("ws-my-repo");
   * if (workspace) {
   *   console.log(`Found workspace: ${workspace.name}`);
   * }
   * ```
   */
  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    return await this.storage.readJSON<Workspace>(
      this.getWorkspacePath(workspaceId)
    );
  }

  /**
   * Create a new workspace
   *
   * Creates a new workspace with the given name, branch, and path.
   * The workspace ID is automatically generated from the path.
   *
   * @param name - The display name for the workspace
   * @param branch - The Git branch name
   * @param path - The file system path to the workspace
   * @returns The created workspace object
   *
   * @example
   * ```typescript
   * const workspace = await workspaceStorage.createWorkspace(
   *   "My Project",
   *   "main",
   *   "/path/to/project"
   * );
   * console.log(`Created workspace: ${workspace.id}`);
   * ```
   */
  async createWorkspace(
    name: string,
    branch: string,
    path: string
  ): Promise<Workspace> {
    // Extract repository name from path for predictable workspace ID
    // 从路径中提取仓库名称以获得可预测的工作区 ID
    // Support both Unix (/) and Windows (\) path separators
    const repoName = path.split(/[/\\]/).pop() || name.replace(/\s+/g, '-').toLowerCase();
    const id = `ws-${repoName}`;
    const workspace: Workspace = {
      id,
      name,
      branch,
      path,
      worktrees: [],
      terminals: [],
      expanded: true,
    };

    await this.storage.writeJSON(this.getWorkspacePath(id), workspace);
    return workspace;
  }

  /**
   * Update a workspace
   *
   * Updates workspace fields with partial data.
   * The workspace ID cannot be changed.
   *
   * @param workspaceId - The workspace identifier
   * @param updates - Partial workspace object with fields to update
   * @returns The updated workspace or null if not found
   *
   * @example
   * ```typescript
   * const updated = await workspaceStorage.updateWorkspace("ws-my-repo", {
   *   name: "Updated Name",
   *   expanded: false
   * });
   * ```
   */
  async updateWorkspace(
    workspaceId: string,
    updates: Partial<Omit<Workspace, "id">>
  ): Promise<Workspace | null> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      return null;
    }

    const updatedWorkspace = { ...workspace, ...updates };
    await this.storage.writeJSON(
      this.getWorkspacePath(workspaceId),
      updatedWorkspace
    );
    return updatedWorkspace;
  }

  /**
   * Delete a workspace
   *
   * Permanently removes a workspace from storage.
   *
   * @param workspaceId - The workspace identifier
   * @returns True if deleted, false if not found
   *
   * @example
   * ```typescript
   * const deleted = await workspaceStorage.deleteWorkspace("ws-my-repo");
   * if (deleted) {
   *   console.log("Workspace deleted successfully");
   * }
   * ```
   */
  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      return false;
    }

    await this.storage.deleteFile(this.getWorkspacePath(workspaceId));
    return true;
  }

  /**
   * Add a worktree to a workspace
   *
   * Associates a worktree ID with a workspace.
   * If the worktree is already associated, does nothing.
   *
   * @param workspaceId - The workspace identifier
   * @param worktreeId - The worktree identifier to add
   * @returns The updated workspace or null if not found
   *
   * @example
   * ```typescript
   * const workspace = await workspaceStorage.addWorktreeToWorkspace(
   *   "ws-my-repo",
   *   "worktree-123"
   * );
   * ```
   */
  async addWorktreeToWorkspace(
    workspaceId: string,
    worktreeId: string
  ): Promise<Workspace | null> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      return null;
    }

    if (!workspace.worktrees.includes(worktreeId)) {
      workspace.worktrees.push(worktreeId);
      await this.storage.writeJSON(
        this.getWorkspacePath(workspaceId),
        workspace
      );
    }

    return workspace;
  }

  /**
   * Toggle workspace expanded state
   *
   * Toggles the expanded/collapsed UI state for a workspace.
   *
   * @param workspaceId - The workspace identifier
   * @returns The updated workspace or null if not found
   *
   * @example
   * ```typescript
   * const workspace = await workspaceStorage.toggleExpanded("ws-my-repo");
   * console.log(`Expanded: ${workspace?.expanded}`);
   * ```
   */
  async toggleExpanded(workspaceId: string): Promise<Workspace | null> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      return null;
    }

    workspace.expanded = !workspace.expanded;
    await this.storage.writeJSON(
      this.getWorkspacePath(workspaceId),
      workspace
    );

    return workspace;
  }

  /**
   * Check if a workspace exists
   *
   * @param workspaceId - The workspace identifier
   * @returns True if the workspace exists, false otherwise
   *
   * @example
   * ```typescript
   * if (await workspaceStorage.workspaceExists("ws-my-repo")) {
   *   console.log("Workspace exists");
   * }
   * ```
   */
  async workspaceExists(workspaceId: string): Promise<boolean> {
    return await this.storage.fileExists(this.getWorkspacePath(workspaceId));
  }

  /**
   * Add a terminal session to workspace
   *
   * Tracks a terminal session associated with the workspace.
   * Keeps maximum of 50 sessions, removing oldest when limit is reached.
   *
   * @param workspaceId - The workspace identifier
   * @param sessionId - The terminal session identifier
   * @param shellPid - The process ID of the shell
   * @returns The updated workspace or null if not found
   *
   * @example
   * ```typescript
   * const workspace = await workspaceStorage.addTerminalSession(
   *   "ws-my-repo",
   *   "session-123",
   *   45678
   * );
   * ```
   */
  async addTerminalSession(
    workspaceId: string,
    sessionId: string,
    shellPid: number
  ): Promise<Workspace | null> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      return null;
    }

    const now = Date.now();
    const newSession = {
      id: sessionId,
      createdAt: now,
      lastActiveAt: now,
      shellPid,
    };

    // Add new session
    workspace.terminals.push(newSession);

    // Keep only the most recent 50 sessions
    if (workspace.terminals.length > 50) {
      workspace.terminals = workspace.terminals.slice(-50);
    }

    await this.storage.writeJSON(
      this.getWorkspacePath(workspaceId),
      workspace
    );
    return workspace;
  }

  /**
   * Update terminal session last active time
   *
   * Updates the lastActiveAt timestamp for a terminal session.
   *
   * @param workspaceId - The workspace identifier
   * @param sessionId - The terminal session identifier
   * @returns The updated workspace or null if not found
   *
   * @example
   * ```typescript
   * await workspaceStorage.updateTerminalSessionActive("ws-my-repo", "session-123");
   * ```
   */
  async updateTerminalSessionActive(
    workspaceId: string,
    sessionId: string
  ): Promise<Workspace | null> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      return null;
    }

    const session = workspace.terminals.find((t) => t.id === sessionId);
    if (session) {
      session.lastActiveAt = Date.now();
      await this.storage.writeJSON(
        this.getWorkspacePath(workspaceId),
        workspace
      );
    }

    return workspace;
  }

  /**
   * Get most recent terminal session for a workspace
   *
   * Returns the most recently created terminal session.
   *
   * @param workspace - The workspace object
   * @returns The most recent terminal session or null if no sessions exist
   *
   * @example
   * ```typescript
   * const workspace = await workspaceStorage.getWorkspace("ws-my-repo");
   * const session = workspaceStorage.getMostRecentTerminalSession(workspace);
   * if (session) {
   *   console.log(`Most recent session: ${session.id}`);
   * }
   * ```
   */
  getMostRecentTerminalSession(workspace: Workspace): {
    id: string;
    createdAt: number;
    lastActiveAt: number;
    shellPid: number;
  } | null {
    if (workspace.terminals.length === 0) {
      return null;
    }

    // Return the most recent session (last in array)
    return workspace.terminals[workspace.terminals.length - 1];
  }

  /**
   * Get user preferences
   * 获取用户偏好设置
   *
   * @returns User preferences or default if not exists
   */
  async getPreferences(): Promise<UserPreferences> {
    const prefs = await this.storage.readJSON<UserPreferences>(USER_PREFERENCES_FILE);
    return prefs || { ...defaultPreferences };
  }

  /**
   * Update user preferences
   * 更新用户偏好设置
   *
   * Merges partial updates with current preferences and persists to storage.
   * Automatically updates lastUpdated timestamp.
   *
   * @param updates - Partial preferences to update
   * @returns Updated user preferences
   */
  async updatePreferences(updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.getPreferences();
    const updated: UserPreferences = {
      ...current,
      ...updates,
      lastUpdated: Date.now(),
      version: "1.0",
    };

    await this.storage.writeJSON(USER_PREFERENCES_FILE, updated);
    return updated;
  }

  /**
   * Reset user preferences to defaults
   * 重置用户偏好设置为默认值
   *
   * @returns Default user preferences
   */
  async resetPreferences(): Promise<UserPreferences> {
    await this.storage.writeJSON(USER_PREFERENCES_FILE, defaultPreferences);
    return { ...defaultPreferences };
  }
}

// Default instance for convenience
// Uses ~/.talos directory for user-level workspace storage
// 使用 ~/.talos 目录进行用户级工作区存储
export const workspaceStorage = new WorkspaceStorage();
