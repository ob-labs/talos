"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";

// Layout view types for the sidebar
export type SidebarView = "workspace" | "task" | "worktree" | "talos-tasks";

// Layout state interface
export interface LayoutState {
  // Active selections
  activeWorkspace: string | null;
  activeWorktree: string | null;
  activeStory: string | null;

  // View state
  sidebarView: SidebarView;

  // Panel collapse state
  isLeftPanelCollapsed: boolean;
  isRightPanelCollapsed: boolean;
}

// Layout actions interface
export interface LayoutActions {
  selectWorkspace: (workspaceId: string | null) => void;
  selectWorktree: (worktreeId: string | null) => void;
  selectStory: (storyId: string | null) => void;
  toggleSidebarView: (view?: SidebarView) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  expandLeftPanel: () => void;
  expandRightPanel: () => void;
  collapseLeftPanel: () => void;
  collapseRightPanel: () => void;
  goBack: () => void;
}

// Combined context type
export type LayoutContextType = LayoutState & LayoutActions;

// Default state
export const defaultState: LayoutState = {
  activeWorkspace: null,
  activeWorktree: null,
  activeStory: null,
  sidebarView: "workspace",
  isLeftPanelCollapsed: false,
  isRightPanelCollapsed: false,
};

// Create context
const LayoutContext = createContext<LayoutContextType | null>(null);

// Storage key for localStorage (client-side fallback)
const STORAGE_KEY = "talos-layout-state";

// Debounce delay for saving preferences (ms)
const SAVE_DEBOUNCE = 300;

// Provider component
export function LayoutProvider({ children }: { children: ReactNode }) {
  // Track if initial load is complete
  const isLoadedRef = useRef(false);

  // Always start with defaultState so server and client render identically (avoids hydration mismatch).
  // Load from localStorage in useEffect after mount.
  const [state, setState] = useState<LayoutState>(defaultState);

  // Load preferences from localStorage (instant) and server (authoritative) on mount.
  // Must run only on client to avoid hydration mismatch.
  useEffect(() => {
    // Restore from localStorage first for instant UI
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          setState((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {
      // Invalid JSON, ignore
    }

    const loadPreferences = async () => {
      try {
        const response = await fetch("/api/preferences");
        if (response.ok) {
          const prefs = await response.json();
          if (prefs && typeof prefs === "object") {
            setState((prev) => ({
              ...prev,
              activeWorkspace: prefs.activeWorkspace ?? prev.activeWorkspace,
              activeWorktree: prefs.activeWorktree ?? prev.activeWorktree,
              activeStory: prefs.activeStory ?? prev.activeStory,
              sidebarView: prefs.sidebarView ?? prev.sidebarView,
              isLeftPanelCollapsed: prefs.isLeftPanelCollapsed ?? prev.isLeftPanelCollapsed,
              isRightPanelCollapsed: prefs.isRightPanelCollapsed ?? prev.isRightPanelCollapsed,
              // Skip isFeatDrawerOpen - removed from state
            }));
          }
        }
      } catch (error) {
        console.error("Failed to load preferences:", error);
      } finally {
        isLoadedRef.current = true;
      }
    };

    loadPreferences();
  }, []);

  // Persist state to localStorage (client-side fallback)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, SAVE_DEBOUNCE);
    return () => clearTimeout(timeoutId);
  }, [state]);

  // Persist state to server-side storage
  useEffect(() => {
    // Skip initial save until we've loaded from server
    if (!isLoadedRef.current) return;

    const timeoutId = setTimeout(async () => {
      try {
        await fetch("/api/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
      } catch (error) {
        console.error("Failed to save preferences:", error);
      }
    }, SAVE_DEBOUNCE);

    return () => clearTimeout(timeoutId);
  }, [state]);

  // Actions
  const selectWorkspace = useCallback((workspaceId: string | null) => {
    setState((prev) => ({
      ...prev,
      activeWorkspace: workspaceId,
      activeWorktree: null,
      activeStory: null,
      sidebarView: "workspace",
    }));
  }, []);

  const selectWorktree = useCallback((worktreeId: string | null) => {
    setState((prev) => ({
      ...prev,
      activeWorktree: worktreeId,
      activeStory: null,
    }));
  }, []);

  const selectStory = useCallback((storyId: string | null, switchView: boolean = false) => {
    setState((prev) => ({
      ...prev,
      activeStory: storyId,
      sidebarView: switchView && storyId ? "task" : prev.sidebarView,
    }));
  }, []);

  const toggleSidebarView = useCallback((view?: SidebarView) => {
    setState((prev) => ({
      ...prev,
      sidebarView: view ?? (prev.sidebarView === "workspace" ? "task" : "workspace"),
    }));
  }, []);

  const toggleLeftPanel = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isLeftPanelCollapsed: !prev.isLeftPanelCollapsed,
    }));
  }, []);

  const toggleRightPanel = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isRightPanelCollapsed: !prev.isRightPanelCollapsed,
    }));
  }, []);

  const expandLeftPanel = useCallback(() => {
    setState((prev) => ({ ...prev, isLeftPanelCollapsed: false }));
  }, []);

  const expandRightPanel = useCallback(() => {
    setState((prev) => ({ ...prev, isRightPanelCollapsed: false }));
  }, []);

  const collapseLeftPanel = useCallback(() => {
    setState((prev) => ({ ...prev, isLeftPanelCollapsed: true }));
  }, []);

  const collapseRightPanel = useCallback(() => {
    setState((prev) => ({ ...prev, isRightPanelCollapsed: true }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.activeStory) {
        return { ...prev, activeStory: null }; // Keep sidebarView as "task"
      }
      if (prev.activeWorktree && prev.sidebarView === "task") {
        return { ...prev, sidebarView: "workspace" }; // Return to workspace view
      }
      if (prev.activeWorktree) {
        return { ...prev, activeWorktree: null };
      }
      if (prev.activeWorkspace) {
        return { ...prev, activeWorkspace: null, activeWorktree: null };
      }
      return prev;
    });
  }, []);

  const value: LayoutContextType = {
    ...state,
    selectWorkspace,
    selectWorktree,
    selectStory,
    toggleSidebarView,
    toggleLeftPanel,
    toggleRightPanel,
    expandLeftPanel,
    expandRightPanel,
    collapseLeftPanel,
    collapseRightPanel,
    goBack,
  };

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

// Hook for consuming the context
export function useLayoutState(): LayoutContextType {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayoutState must be used within a LayoutProvider");
  }
  return context;
}
