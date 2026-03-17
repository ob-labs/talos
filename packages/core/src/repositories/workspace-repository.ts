import type {
  IWorkspace,
  IWorkspaceRepository,
  WorkspaceFilter
} from "@talos/types";
import { LocalStorageEngine } from "../storage/storage";
import { Workspace } from "../domain/entities/Workspace";
import { TALOS_DIR, WORKSPACES_FILE } from "../infrastructure/constant";

/**
 * WorkspaceRepository - Repository implementation for Workspace entities
 *
 * Implements rich domain model repository pattern.
 * Only accepts complete entities (no partial updates).
 * Reuses WorkspaceStorage logic with atomic writes.
 *
 * Storage: ~/.talos/workspaces.json (single file with array)
 *
 * @example
 * ```typescript
 * const repo = new WorkspaceRepository();
 * await repo.save(workspace);
 * const found = await repo.findById('ws-123');
 * ```
 */
export class WorkspaceRepository implements IWorkspaceRepository {
  private storage: LocalStorageEngine;

  /**
   * Create WorkspaceRepository
   *
   * Uses ~/.talos as base directory for workspace storage
   */
  constructor() {
    this.storage = new LocalStorageEngine(TALOS_DIR);
  }

  /**
   * Load all workspaces from storage
   * @private
   */
  private async loadWorkspaces(): Promise<IWorkspace[]> {
    const data = await this.storage.readJSON<{ workspaces: IWorkspace[] }>(
      WORKSPACES_FILE
    );
    return data?.workspaces || [];
  }

  /**
   * Save all workspaces to storage
   * @private
   */
  private async saveWorkspaces(workspaces: IWorkspace[]): Promise<void> {
    await this.storage.writeJSON(WORKSPACES_FILE, { workspaces });
  }

  /**
   * Save a complete workspace entity
   * Creates new or updates existing workspace
   *
   * @param workspace - Complete workspace entity to save
   * @throws Error if workspace is invalid or save fails
   */
  async save(workspace: IWorkspace): Promise<void> {
    if (!workspace.id) {
      throw new Error("Workspace must have an id");
    }

    const workspaces = await this.loadWorkspaces();
    const existingIndex = workspaces.findIndex(ws => ws.id === workspace.id);

    if (existingIndex >= 0) {
      // Update existing workspace
      workspaces[existingIndex] = workspace;
    } else {
      // Add new workspace
      workspaces.push(workspace);
    }

    await this.saveWorkspaces(workspaces);
  }

  /**
   * Find workspace by ID
   *
   * @param workspaceId - Workspace identifier
   * @returns Workspace entity or null if not found
   */
  async findById(workspaceId: string): Promise<IWorkspace | null> {
    const workspaces = await this.loadWorkspaces();
    return workspaces.find(ws => ws.id === workspaceId) || null;
  }

  /**
   * Find all workspaces
   * Optionally filter by criteria
   *
   * @param filter - Optional filter criteria
   * @returns Array of workspace entities
   */
  async findAll(filter?: WorkspaceFilter): Promise<IWorkspace[]> {
    const workspaces = await this.loadWorkspaces();

    if (!filter) {
      return workspaces;
    }

    return workspaces.filter(workspace => {
      if (filter.branch && workspace.branch !== filter.branch) {
        return false;
      }
      if (filter.name && !workspace.name.includes(filter.name)) {
        return false;
      }
      if (filter.path && !workspace.path.includes(filter.path)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Delete a workspace by ID
   *
   * @param workspaceId - Workspace identifier
   * @throws Error if workspace not found or delete fails
   */
  async delete(workspaceId: string): Promise<void> {
    const workspaces = await this.loadWorkspaces();
    const filtered = workspaces.filter(ws => ws.id !== workspaceId);

    if (filtered.length === workspaces.length) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    await this.saveWorkspaces(filtered);
  }

  /**
   * Check if workspace exists
   *
   * @param workspaceId - Workspace identifier
   * @returns true if workspace exists, false otherwise
   */
  async exists(workspaceId: string): Promise<boolean> {
    const workspace = await this.findById(workspaceId);
    return workspace !== null;
  }

  /**
   * Find workspace by path
   *
   * @param path - Absolute file system path
   * @returns Workspace entity or null if not found
   */
  async findByPath(path: string): Promise<IWorkspace | null> {
    const workspaces = await this.loadWorkspaces();
    return workspaces.find(ws => ws.path === path) || null;
  }

  /**
   * Find workspace by path using Workspace.containsPath()
   *
   * 此方法使用 Workspace 充血模型的 containsPath() 方法来查找匹配的 workspace。
   * 支持精确匹配和 worktree 路径匹配。
   *
   * 替代 ConfigManager 中的路径匹配逻辑。
   *
   * @param path - Absolute file system path
   * @returns Workspace entity or null if not found
   *
   * @example
   * ```typescript
   * // 精确匹配 workspace 根目录
   * await repo.findByPathContains('/Users/user/project');  // 返回 workspace
   *
   * // 匹配 worktree 路径
   * await repo.findByPathContains('/Users/user/project/worktrees/wt-1');  // 返回 workspace
   *
   * // 不匹配其他路径
   * await repo.findByPathContains('/other/path');  // 返回 null
   * ```
   */
  async findByPathContains(path: string): Promise<IWorkspace | null> {
    const workspaces = await this.loadWorkspaces();

    // 使用 Workspace.containsPath() 进行匹配
    for (const wsConfig of workspaces) {
      const workspace = Workspace.fromDTO({
        ...wsConfig,
        createdAt: Date.now(),
      });
      if (workspace.containsPath(path)) {
        return wsConfig;
      }
    }

    return null;
  }

  /**
   * Find workspace by name
   *
   * @param name - Workspace name
   * @returns Workspace entity or null if not found
   */
  async findByName(name: string): Promise<IWorkspace | null> {
    const workspaces = await this.loadWorkspaces();
    return workspaces.find(ws => ws.name === name) || null;
  }

  /**
   * Count workspaces matching filter
   *
   * @param filter - Optional filter criteria
   * @returns Number of matching workspaces
   */
  async count(filter?: WorkspaceFilter): Promise<number> {
    const workspaces = await this.findAll(filter);
    return workspaces.length;
  }
}
