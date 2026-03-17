import { LocalStorageEngine } from "@talos/core";
import type { LayoutState, SidebarView } from "@/lib/ui/state";

const USER_PREFERENCES_FILE = "data/user-preferences.json";

/**
 * User preferences data structure
 * Mirrors LayoutState but with additional metadata
 */
export interface UserPreferences {
  // Active selections (persisted)
  activeWorkspace: string | null;
  activeWorktree: string | null;
  activeStory: string | null;

  // View state (persisted)
  sidebarView: SidebarView;

  // Panel collapse state (persisted)
  isLeftPanelCollapsed: boolean;
  isRightPanelCollapsed: boolean;

  // Metadata
  lastUpdated: number;
  version: string;
}

/**
 * Default user preferences
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
 * User preferences storage service
 * Manages user preferences persistence to data/user-preferences.json
 */
export class UserPreferencesStorage {
  private storage: LocalStorageEngine;

  constructor(storage?: LocalStorageEngine) {
    this.storage = storage || new LocalStorageEngine();
  }

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<UserPreferences> {
    const prefs = await this.storage.readJSON<UserPreferences>(USER_PREFERENCES_FILE);
    return prefs || { ...defaultPreferences };
  }

  /**
   * Save user preferences
   */
  async savePreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.getPreferences();
    const updated: UserPreferences = {
      ...current,
      ...preferences,
      lastUpdated: Date.now(),
      version: "1.0",
    };

    await this.storage.writeJSON(USER_PREFERENCES_FILE, updated);
    return updated;
  }

  /**
   * Convert LayoutState to UserPreferences
   */
  static fromLayoutState(state: LayoutState): Partial<UserPreferences> {
    return {
      activeWorkspace: state.activeWorkspace,
      activeWorktree: state.activeWorktree,
      activeStory: state.activeStory,
      sidebarView: state.sidebarView,
      isLeftPanelCollapsed: state.isLeftPanelCollapsed,
      isRightPanelCollapsed: state.isRightPanelCollapsed,
    };
  }

  /**
   * Convert UserPreferences to LayoutState
   */
  static toLayoutState(prefs: UserPreferences): LayoutState {
    return {
      activeWorkspace: prefs.activeWorkspace,
      activeWorktree: prefs.activeWorktree,
      activeStory: prefs.activeStory,
      sidebarView: prefs.sidebarView,
      isLeftPanelCollapsed: prefs.isLeftPanelCollapsed,
      isRightPanelCollapsed: prefs.isRightPanelCollapsed,
    };
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(): Promise<UserPreferences> {
    await this.storage.writeJSON(USER_PREFERENCES_FILE, defaultPreferences);
    return { ...defaultPreferences };
  }

  /**
   * Check if preferences file exists
   */
  async preferencesExist(): Promise<boolean> {
    return await this.storage.fileExists(USER_PREFERENCES_FILE);
  }

  /**
   * Get last updated timestamp
   */
  async getLastUpdated(): Promise<number | null> {
    const exists = await this.preferencesExist();
    if (!exists) {
      return null;
    }
    const prefs = await this.getPreferences();
    return prefs.lastUpdated || null;
  }
}

// Default instance for convenience
export const userPreferencesStorage = new UserPreferencesStorage();
