// Import path utilities
export { getRepoRoot, isWorktreePath, isGitRepo, getRepoRootPath } from "./path-utils";

// Import PRD manager
export { PRDManager } from "./prd-manager";

// Import Progress manager
export { ProgressManager, progressManager, ProgressLogError } from "./progress-manager";
export type { ProgressEntry, ParsedProgressLog, ProgressContext } from "./progress-manager";

// Import project initialization
export { initializeTalosProject } from "./project-init";
export type { TalosProjectConfig } from "./project-init";

export { LocalStorageEngine, storage } from "./storage";

// Import UI state storage
export { UIStateStorage, uiStateStorage } from "./ui-state-storage";

// Import workspace and session storage (IStorage implementation)
export {
  WorkspaceSessionStorage,
  storage as workspaceSessionStorage,
} from "./workspace-session-storage";

// Import specialized storage classes
import { WorkspaceStorage, workspaceStorage } from "./workspace";
import { WorktreeStorage, worktreeStorage } from "./worktree";
import { StoryStorage, storyStorage } from "./story";

// Re-export specialized storage classes
export { WorkspaceStorage, workspaceStorage };

// Export UserPreferences interface from WorkspaceStorage
export type { UserPreferences } from "./workspace";

// Export worktree and story storage classes
export { WorktreeStorage, worktreeStorage, StoryStorage, storyStorage };

// Lazy getters to avoid circular dependency at module load time
let _worktreeStorageInstance: WorktreeStorage | null = null;
let _storyStorageInstance: StoryStorage | null = null;

export function getWorktreeStorage(): WorktreeStorage {
  if (!_worktreeStorageInstance) {
    _worktreeStorageInstance = new WorktreeStorage();
  }
  return _worktreeStorageInstance;
}

export function getStoryStorage(): StoryStorage {
  if (!_storyStorageInstance) {
    _storyStorageInstance = new StoryStorage(getWorktreeStorage());
  }
  return _storyStorageInstance;
}

// NOTE: UserPreferences CRUD is now available in WorkspaceStorage.
// See WorkspaceStorage.getPreferences(), updatePreferences(), resetPreferences().
// The UserPreferencesStorage class in apps/web/lib/storage/user-preferences.ts
// continues to exist for backward compatibility and UI-specific features.
// The UserPreferences interface is exported from @talos/storage/workspace.ts.

// Import session storage functions
export {
  getSession,
  saveSession,
  listSessions,
  deleteSession,
  updateSessionStatus,
  // Note: SESSIONS_DIR is now exported from infrastructure/constant
} from "./session-storage";

// Import file utilities (path-related only, process operations moved to ProcessManager)
export {
  cleanupSessionFiles,
  getPidPath,
  getSocketPath,
} from "./file-utils";

// Export Task DTO types (moved from local-task-config)
export type { TaskMetadata, TaskProgress, ProjectTasksConfig, TaskStatus } from "./task-dto";

// Import SimpleTask storage for lightweight task management
export { SimpleTaskStorage } from "./simple-task-storage";
export type { SimpleTask } from "@talos/types";
export type { UIProcessState, UIConfig } from "@talos/types";

// Import StorageManager - simplified daemon-level storage
export { StorageManager, storageManager } from "./storage-manager";
export type {
  StorageManagerConfig,
} from "./storage-manager";

// Import Repository implementations for rich domain model
export { WorkspaceRepository } from "../repositories/index";

// Also re-export from domain/repositories for convenience
export { TaskRepository } from "../domain/repositories/index";
export { WorktreeRepository } from "../domain/repositories/index";
