import {
  IStorage,
  SessionData,
  WorkspaceConfig,
  StorageError,
} from "@talos/types";
import { LocalStorageEngine } from "./storage";
import { homedir } from "os";

const WORKSPACES_DIR = "workspaces";
const SESSIONS_DIR = "sessions";

/**
 * LocalStorageEngine-based implementation for IStorage interface
 * Manages workspace and session data persistence to ~/.talos/
 *
 * Note: This is named WorkspaceSessionStorage to avoid conflict with the existing
 * LocalStorageEngine class which provides lower-level file operations.
 * This class implements the higher-level IStorage interface for workspace and
 * session management.
 */
export class WorkspaceSessionStorage implements IStorage {
  private storage: LocalStorageEngine;

  constructor(basePath?: string) {
    // Use ~/.talos as base directory for all data
    // 使用 ~/.talos 作为所有数据的基础目录
    this.storage = new LocalStorageEngine(basePath || `${homedir()}/.talos`);
  }

  // ============================================
  // Workspace Methods
  // ============================================

  /**
   * Get a workspace by ID
   * Returns null if workspace doesn't exist (never throws for missing data)
   */
  async getWorkspace(id: string): Promise<WorkspaceConfig | null> {
    try {
      return await this.storage.readJSON<WorkspaceConfig>(
        `${WORKSPACES_DIR}/${id}.json`
      );
    } catch (error) {
      // Return null for missing data, throw StorageError for IO failures
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw new StorageError(
        `Failed to read workspace ${id}`,
        error as Error
      );
    }
  }

  /**
   * Save a workspace configuration
   * Updates the updatedAt timestamp automatically
   */
  async saveWorkspace(workspace: WorkspaceConfig): Promise<void> {
    try {
      const workspaceToSave: WorkspaceConfig = {
        ...workspace,
        updatedAt: Date.now(),
      };
      await this.storage.writeJSON(
        `${WORKSPACES_DIR}/${workspaceToSave.id}.json`,
        workspaceToSave
      );
    } catch (error) {
      throw new StorageError(
        `Failed to save workspace ${workspace.id}`,
        error as Error
      );
    }
  }

  /**
   * Get all workspaces
   * Returns empty array if no workspaces exist
   */
  async getWorkspaces(): Promise<WorkspaceConfig[]> {
    try {
      const files = await this.storage.listFiles(WORKSPACES_DIR, ".json");
      const workspaces: WorkspaceConfig[] = [];

      for (const file of files) {
        const workspaceId = file.replace(".json", "");
        const workspace = await this.getWorkspace(workspaceId);
        if (workspace) {
          workspaces.push(workspace);
        }
      }

      return workspaces;
    } catch (error) {
      throw new StorageError("Failed to list workspaces", error as Error);
    }
  }

  /**
   * Delete a workspace
   * No error if workspace doesn't exist (idempotent)
   */
  async deleteWorkspace(id: string): Promise<void> {
    try {
      await this.storage.deleteFile(`${WORKSPACES_DIR}/${id}.json`);
    } catch (error) {
      throw new StorageError(
        `Failed to delete workspace ${id}`,
        error as Error
      );
    }
  }

  // ============================================
  // Session Methods
  // ============================================

  /**
   * Get a session by ID
   * Returns null if session doesn't exist (never throws for missing data)
   */
  async getSession(id: string): Promise<SessionData | null> {
    try {
      return await this.storage.readJSON<SessionData>(
        `${SESSIONS_DIR}/${id}.json`
      );
    } catch (error) {
      // Return null for missing data, throw StorageError for IO failures
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw new StorageError(
        `Failed to read session ${id}`,
        error as Error
      );
    }
  }

  /**
   * Save a session
   * Updates the lastUsedAt timestamp automatically
   */
  async saveSession(session: SessionData): Promise<void> {
    try {
      const sessionToSave: SessionData = {
        ...session,
        lastUsedAt: Date.now(),
      };
      await this.storage.writeJSON(
        `${SESSIONS_DIR}/${sessionToSave.id}.json`,
        sessionToSave
      );
    } catch (error) {
      throw new StorageError(
        `Failed to save session ${session.id}`,
        error as Error
      );
    }
  }

  /**
   * Get all sessions for a specific PRD
   * Returns empty array if no sessions found
   */
  async getSessionsByPRD(prdId: string): Promise<SessionData[]> {
    try {
      const files = await this.storage.listFiles(SESSIONS_DIR, ".json");
      const sessions: SessionData[] = [];

      for (const file of files) {
        const sessionId = file.replace(".json", "");
        const session = await this.getSession(sessionId);
        if (session && session.prdId === prdId) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch (error) {
      throw new StorageError(
        `Failed to list sessions for PRD ${prdId}`,
        error as Error
      );
    }
  }

  /**
   * Delete a session
   * No error if session doesn't exist (idempotent)
   */
  async deleteSession(id: string): Promise<void> {
    try {
      await this.storage.deleteFile(`${SESSIONS_DIR}/${id}.json`);
    } catch (error) {
      throw new StorageError(
        `Failed to delete session ${id}`,
        error as Error
      );
    }
  }
}

// Default instance for convenience
// Uses ~/.talos directory for user-level data storage
export const storage = new WorkspaceSessionStorage();
