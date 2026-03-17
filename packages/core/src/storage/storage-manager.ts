/**
 * Storage Manager - Unified Storage Entry Point (Simplified)
 *
 * DESIGN PRINCIPLES:
 * - StorageManager is a thin coordinator, not a business logic layer
 * - Task persistence -> TaskRepository (domain layer)
 * - Workspace persistence -> WorkspaceRepository (domain layer)
 * - UI state -> UIStateStorage (infrastructure layer)
 */

import * as path from "path";
import { homedir } from "os";

import { WorktreeStorage } from "./worktree";
import { ProgressManager } from "./progress-manager";
import { UIStateStorage } from "./ui-state-storage";
import type { UIProcessState } from "@talos/types";

/**
 * Storage manager configuration
 */
export interface StorageManagerConfig {
  basePath?: string;
}

/**
 * Storage Manager - Simplified unified entry point for storage operations
 *
 * Provides access to UI-level storage operations.
 * For task and workspace operations, use TaskRepository and WorkspaceRepository directly.
 */
export class StorageManager {
  private worktreeStorage: WorktreeStorage;
  private progressManager: ProgressManager;
  private uiStateStorage: UIStateStorage;
  private basePath: string;

  constructor(config?: StorageManagerConfig) {
    this.basePath = config?.basePath || path.join(homedir(), ".talos");
    this.worktreeStorage = new WorktreeStorage();
    this.progressManager = new ProgressManager();
    this.uiStateStorage = new UIStateStorage();
  }

  // =========================================================================
  // UI PROCESS STATE STORAGE METHODS (Daemon-level UI management)
  // =========================================================================

  async getUIProcessState(): Promise<UIProcessState | null> {
    return this.uiStateStorage.getUIProcessState();
  }

  async setUIProcessState(state: UIProcessState): Promise<void> {
    return this.uiStateStorage.setUIProcessState(state);
  }

  async clearUIProcessState(): Promise<void> {
    return this.uiStateStorage.clearUIProcessState();
  }

  // =========================================================================
  // DIRECT STORAGE ACCESS (For specialized operations)
  // =========================================================================

  getWorktreeStorage(): WorktreeStorage {
    return this.worktreeStorage;
  }

  getProgressManager(): ProgressManager {
    return this.progressManager;
  }

  getBasePath(): string {
    return this.basePath;
  }
}

/**
 * Default singleton instance
 */
export const storageManager = new StorageManager();
