"use client";

import { useLayoutState } from "@/lib/ui/state";
import { useEffect, useState, useRef, Suspense } from "react";
import type { Worktree, Workspace, Story, TerminalLog } from "@/types";
import {
  fetchWorkspacesAndWorktrees,
  fetchWorktree,
  addTerminalLog,
  updateStoryStatus,
} from "@/lib/api/workspace-client";
import { XtermTerminal } from "@/components/terminal/xterm-terminal";
import { TerminalEmptyState } from "@/components/terminal/terminal-empty-state";
import { CommandHistoryManager } from "@talos/terminal";
import { CodeChangesPanel } from "@/components/panels/code-changes-panel";
import { CommandPalette } from "@/components/command/command-palette";
import { commandRegistry, createDefaultCommands, useCommandPalette } from "@/lib/ui/command-palette";
import { StatusBar } from "@/components/layout/status-bar";
import { useGlobalKeyboardShortcuts } from "@/lib/ui/keyboard-shortcuts";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { StoryListView } from "@/components/worktrees";
import { StoryDetailsPanel } from "@/components/stories";
import { TaskListTable, TaskDetailView } from "@/components/tasks";

/** Fallback for directory selection when showDirectoryPicker is unavailable (e.g. non-secure context). */
function selectDirectoryViaInput(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.webkitdirectory = true;
    input.setAttribute("directory", "");
    input.multiple = true;
    input.style.display = "none";

    const cleanup = () => {
      input.remove();
      clearTimeout(timeoutId);
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 120000);

    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        const firstPath = input.files[0].webkitRelativePath;
        const dirName = firstPath.split("/")[0] || input.files[0].name;
        cleanup();
        resolve(dirName);
      } else {
        cleanup();
        resolve(null);
      }
    };

    document.body.appendChild(input);
    input.click();
  });
}

// Left panel component - Workspace/Feat/Task navigation
function LeftPanel({ selectedTaskId, setSelectedTaskId }: { selectedTaskId: string | null; setSelectedTaskId: (id: string | null) => void }) {
  const {
    sidebarView,
    isLeftPanelCollapsed,
    expandLeftPanel,
    collapseLeftPanel,
    goBack,
    toggleSidebarView,
  } = useLayoutState();

  if (isLeftPanelCollapsed) {
    return (
      <div className="w-12 bg-gradient-to-b from-[#252526] to-[#1e1e1e] border-r border-[#30363d] flex flex-col items-center py-4 flex-shrink-0">
        <button
          onClick={expandLeftPanel}
          className="p-2 rounded-lg hover:bg-[#3c3c3c] text-[#8b949e] hover:text-[#e6edf3] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:shadow-lg active:scale-95"
          title="Expand sidebar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-[320px] bg-gradient-to-b from-[#252526] to-[#1e1e1e] border-r border-[#30363d] flex flex-col flex-shrink-0">
      {/* Panel Header */}
      <div className="h-10 bg-gradient-to-r from-[#333333] to-[#2d2d2d] flex items-center justify-between px-3 border-b border-[#30363d]">
        <div className="flex items-center space-x-2">
          {(sidebarView === "task" || sidebarView === "talos-tasks") && (
            <button
              onClick={() => {
                setSelectedTaskId(null);
                goBack();
              }}
              className="p-1.5 rounded-md hover:bg-[#3c3c3c] text-[#8b949e] hover:text-[#e6edf3] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-95"
              title="Back"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <span className="text-sm font-medium text-[#e6edf3]">
            {sidebarView === "workspace" ? "Workspace" : sidebarView === "talos-tasks" ? "Talos Tasks" : "Task List"}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          {sidebarView === "workspace" && (
            <>
              <button
                onClick={() => toggleSidebarView("talos-tasks")}
                className="p-1.5 rounded-md hover:bg-[#3c3c3c] text-[#8b949e] hover:text-[#e6edf3] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-95"
                title="Talos Tasks"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </button>
              <button
                onClick={() => {
                  // Trigger workspace creation
                  const event = new CustomEvent("createWorkspace");
                  window.dispatchEvent(event);
                }}
                className="p-1.5 rounded-md hover:bg-[#3c3c3c] text-[#8b949e] hover:text-[#e6edf3] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-95"
                title="Add workspace"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </>
          )}
          <button
            onClick={collapseLeftPanel}
            className="p-1.5 rounded-md hover:bg-[#3c3c3c] text-[#8b949e] hover:text-[#e6edf3] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-95"
            title="Collapse sidebar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Panel Content with transition */}
      <div className="flex-1 overflow-hidden relative">
        <div
          className={`absolute inset-0 overflow-auto p-4 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            sidebarView === "workspace" ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
          }`}
        >
          <WorkspaceView onViewTasks={() => toggleSidebarView("task")} />
        </div>
        <div
          className={`absolute inset-0 overflow-auto p-4 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            sidebarView === "talos-tasks" ? "translate-x-0 opacity-100" : sidebarView === "workspace" ? "-translate-x-full opacity-0" : "translate-x-full opacity-0"
          }`}
        >
          {selectedTaskId ? (
            <TaskDetailView
              taskId={selectedTaskId}
              onBack={() => setSelectedTaskId(null)}
            />
          ) : (
            <TaskListTable
              onTaskClick={(taskId) => setSelectedTaskId(taskId)}
            />
          )}
        </div>
        <div
          className={`absolute inset-0 overflow-auto transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            sidebarView === "task" ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
          }`}
        >
          <LeftPanelTaskView />
        </div>
      </div>
    </div>
  );
}

// Workspace/Feat view
// NOTE: onViewTasks is currently unused but kept for future implementation (US-005)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function WorkspaceView({ onViewTasks }: { onViewTasks: () => void }) {
  const { activeWorkspace, selectWorkspace, activeWorktree, selectWorktree, toggleSidebarView } = useLayoutState();
  const { showToast } = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [feats, setFeats] = useState<Worktree[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Track expanded/collapsed state for workspaces
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());

  // Load workspaces and feats
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const { workspaces: wsList, worktrees: allFeats } = await fetchWorkspacesAndWorktrees();
        setWorkspaces(wsList);
        setFeats(allFeats);

        // Auto-expand first workspace by default
        if (wsList.length > 0) {
          setExpandedWorkspaces(new Set([wsList[0].id]));
        }
      } catch (error) {
        console.error("Failed to load workspaces/feats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle feat click - select feat only (without changing view)
  const handleFeatClick = (featId: string) => {
    selectWorktree(featId);
  };

  // Handle view tasks - select feat and switch to task view
  const handleViewTasks = (featId: string) => {
    selectWorktree(featId);
    toggleSidebarView("task");
  };

  // Toggle workspace expand/collapse
  const toggleWorkspace = (workspaceId: string) => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
      } else {
        next.add(workspaceId);
      }
      return next;
    });
  };

  // Handle create workspace event
  useEffect(() => {
    const handleCreateWorkspace = async () => {
      try {
        let selectedPath = "";

        // Use File System Access API (modern browsers like Chrome)
        // This shows the native directory picker without "upload" UI
        if ("showDirectoryPicker" in window) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const directoryHandle = await (window as any).showDirectoryPicker();
            // Note: File System Access API doesn't provide full path for security
            // We'll use the handle name as identifier
            selectedPath = directoryHandle.name;
          } catch (err: unknown) {
            // User cancelled the picker
            if ((err as Error).name === "AbortError") {
              return;
            }
            throw err;
          }
        } else {
          // Fallback: use <input webkitdirectory> (works in non-secure contexts like http://local.alipay.net)
          const fallbackPath = await selectDirectoryViaInput();
          if (!fallbackPath) {
            return; // User cancelled
          }
          selectedPath = fallbackPath;
        }

        if (!selectedPath) {
          return;
        }

        // Browser APIs only provide directory name, not full path. We need the real path for Git.
        const fullPath = window.prompt(
          `Selected directory "${selectedPath}".\n\nPlease enter the full path of this directory (e.g., copy by selecting the folder in Finder and pressing Cmd+Option+C):`,
          ""
        );
        if (!fullPath?.trim()) {
          return;
        }
        const pathToUse = fullPath.trim();

        // Check for duplicate workspace by name or path
        const duplicateWorkspace = workspaces.find(
          (ws) => ws.name === selectedPath || ws.path === pathToUse || ws.path.endsWith(selectedPath)
        );

        if (duplicateWorkspace) {
          // Workspace already exists - select it and show toast
          selectWorkspace(duplicateWorkspace.id);
          showToast(`Workspace already exists: ${duplicateWorkspace.name}`, "info");
          return;
        }

        // Create new workspace via API
        const response = await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: selectedPath,
            path: pathToUse,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to create workspace");
        }

        const data = await response.json();

        if (data.success && data.workspace) {
          // Reload workspaces list
          const { workspaces: wsList } = await fetchWorkspacesAndWorktrees();
          setWorkspaces(wsList);

          // Auto-select and expand the new workspace
          selectWorkspace(data.workspace.id);
          showToast(`Workspace created: ${data.workspace.name}`, "success");
        }
      } catch (error) {
        console.error("Failed to handle create workspace:", error);
        showToast((error as Error).message || "Failed to create workspace", "error");
      }
    };

    window.addEventListener("createWorkspace", handleCreateWorkspace);

    return () => {
      window.removeEventListener("createWorkspace", handleCreateWorkspace);
    };
  }, [workspaces, selectWorkspace, showToast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-[#8b949e]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {workspaces.length === 0 ? (
        <div className="text-sm text-[#8b949e] py-4 text-center">
          No workspaces yet, please create one
        </div>
      ) : (
        workspaces.map((ws) => {
          const isExpanded = expandedWorkspaces.has(ws.id);
          const isActive = activeWorkspace === ws.id;
          const workspaceFeats = feats.filter((f) => f.workspaceId === ws.id);

          return (
            <div key={ws.id} className="select-none">
              {/* Workspace Row - VSCode folder style */}
              <div
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  isActive
                    ? "bg-[#37373d]"
                    : "hover:bg-[#2a2d2e]"
                }`}
                onClick={() => {
                  selectWorkspace(ws.id);
                  if (!isExpanded) {
                    toggleWorkspace(ws.id);
                  }
                }}
              >
                {/* Chevron for expand/collapse */}
                <svg
                  className={`w-4 h-4 text-[#8b949e] transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] flex-shrink-0 ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWorkspace(ws.id);
                  }}
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>

                {/* Folder icon */}
                <svg
                  className={`w-4 h-4 flex-shrink-0 ${
                    isActive ? "text-[#c9d1d9]" : "text-[#8b949e]"
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>

                {/* Workspace name */}
                <span
                  className={`text-sm truncate flex-1 ${
                    isActive ? "font-bold text-[#e6edf3]" : "text-[#c9d1d9]"
                  }`}
                >
                  {ws.name}
                </span>

                {/* Feat count badge */}
                <span className="text-xs text-[#8b949e] flex-shrink-0">
                  {workspaceFeats.length}
                </span>
              </div>

              {/* Feats as child items - tree structure */}
              <div
                className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="relative ml-4">
                  {/* Tree vertical line */}
                  {isExpanded && workspaceFeats.length > 0 && (
                    <div className="absolute left-[5px] top-2 bottom-2 w-px bg-[#30363d]" />
                  )}

                  {/* Feat items */}
                  {workspaceFeats.map((feat) => {
                    // Calculate completion stats
                    const completedTasks = feat.stories.filter((t) => t.passes).length || 0;
                    const totalTasks = feat.stories.length || 0;

                    // Get workspace to extract repo name
                    const workspace = workspaces.find(ws => ws.id === feat.workspaceId);
                    const repoName = workspace?.path.split('/').pop() || '';

                    // Generate worktree key: {repoName}-{worktreeName}
                    const branchNameSlug = feat.branchName
                      .replace(/^ralph\//, '')      // Remove ralph/ prefix
                      .replace(/\//g, '-');          // Replace slashes with hyphens
                    const worktreeKey = repoName ? `${repoName}-${branchNameSlug}` : branchNameSlug;

                    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                    return (
                      <div key={worktreeKey} className="relative mb-2">
                        {/* Tree horizontal line */}
                        <div className="absolute left-0 top-4 w-2 h-px bg-[#30363d]" />

                        {/* Feat item - flex-col layout with progress bar and stats */}
                        <div
                          className={`relative flex flex-col gap-1.5 px-2 py-2 rounded cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ml-1 ${
                            activeWorktree === worktreeKey
                              ? "bg-[#0969da]"
                              : "hover:bg-[#2a2d2e]"
                          }`}
                          onClick={() => handleFeatClick(worktreeKey)}
                        >
                          {/* First row: Name + Chevron button */}
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-sm truncate flex-1 ${
                                activeWorktree === worktreeKey
                                  ? "text-[#e6edf3] font-medium"
                                  : "text-[#c9d1d9]"
                              }`}
                            >
                              {feat.branchName}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewTasks(worktreeKey);
                              }}
                              className="p-0.5 rounded hover:bg-[#3c3c3c] text-[#8b949e] hover:text-[#e6edf3] transition-all duration-200 flex-shrink-0"
                              title="View tasks"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>

                          {/* Second row: Progress bar */}
                          {totalTasks > 0 && (
                            <div className="h-1.5 bg-[#30363d] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#6366f1] to-[#58a6ff] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}

                          {/* Third row: Task statistics */}
                          <div className="flex items-center justify-between text-xs">
                            <span className={activeWorktree === worktreeKey ? "text-[#8b949e]/80" : "text-[#8b949e]"}>
                              {totalTasks} task(s)
                            </span>
                            <span className={activeWorktree === worktreeKey ? "text-[#6366f1]/90" : "text-[#6366f1]"}>
                              {completedTasks} completed
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty state */}
                  {workspaceFeats.length === 0 && (
                    <div className="text-xs text-[#8b949e] py-2 pl-6">
                      No feats
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// Wrapper component for StoryListView in left panel
function LeftPanelTaskView() {
  const { activeWorktree, selectStory, activeStory } = useLayoutState();

  const handleStoryClick = (storyId: string) => {
    selectStory(storyId);
  };

  return <StoryListView worktreeId={activeWorktree} activeStory={activeStory} onStoryClick={handleStoryClick} />;
}

// Main content area
function MainContent({ selectedTaskId, onTaskSelect }: { selectedTaskId: string | null; onTaskSelect: (taskId: string | null) => void }) {
  const { activeWorktree, activeStory, activeWorkspace, selectStory } = useLayoutState();
  const [feat, setFeat] = useState<Worktree | null>(null);
  const [task, setTask] = useState<Story | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const commandHistoryRef = useRef<CommandHistoryManager | null>(null);
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize command history
  useEffect(() => {
    commandHistoryRef.current = new CommandHistoryManager();
  }, []);

  // Load workspace data when selection changes
  useEffect(() => {
    const loadWorkspace = async () => {
      if (!activeWorkspace) {
        setWorkspace(null);
        return;
      }

      try {
        const { workspaces } = await fetchWorkspacesAndWorktrees();
        const ws = workspaces.find((w) => w.id === activeWorkspace);
        setWorkspace(ws || null);
      } catch (error) {
        console.error("Failed to load workspace:", error);
      }
    };

    loadWorkspace();
  }, [activeWorkspace]);

  // Load feat and task data when selection changes
  useEffect(() => {
    const loadData = async () => {
      if (!activeWorktree) {
        setFeat(null);
        setTask(null);
        setTerminalLogs([]);
        return;
      }

      setIsLoading(true);
      try {
        const featData = await fetchWorktree(activeWorktree);
        setFeat(featData ?? null);

        if (activeStory && featData) {
          const taskData = featData.stories.find((t) => t.id === activeStory);
          setTask(taskData || null);
          // Load task terminal logs
          setTerminalLogs(taskData?.terminal || []);
        } else {
          setTask(null);
          // Load feat terminal logs
          setTerminalLogs(featData?.terminal || []);
        }
      } catch (error) {
        console.error("Failed to load feat/task data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [activeWorktree, activeStory]);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-[#3fb950]";
      case "completed":
        return "text-[#6366f1]";
      case "failed":
        return "text-[#f85149]";
      case "skipped":
        return "text-[#d29922]";
      default:
        return "text-[#8b949e]";
    }
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "running":
        return "Running";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      case "skipped":
        return "Skipped";
      case "default":
        return "Default";
      default:
        return "Pending";
    }
  };

  // Get story status from passes property
  const getStoryStatus = (story: any) => {
    if (story.passes) return "completed";
    return "pending";
  };

  // Handle retry task
  const handleRetryTask = async () => {
    if (!activeWorktree || !activeStory) return;

    try {
      await updateStoryStatus(activeWorktree, activeStory, "running");
      await addTerminalLog(activeWorktree, "info", `[${activeStory}] Task has been reset to running status`);

      const updatedFeat = await fetchWorktree(activeWorktree);
      setFeat(updatedFeat ?? null);
      if (updatedFeat) {
        const updatedTask = updatedFeat.stories.find((t) => t.id === activeStory);
        setTask(updatedTask || null);
        setTerminalLogs(updatedTask?.terminal || []);
      }
    } catch (error) {
      console.error("Failed to retry task:", error);
    }
  };

  // Handle skip task
  const handleSkipTask = async () => {
    if (!activeWorktree || !activeStory) return;

    try {
      await updateStoryStatus(activeWorktree, activeStory, "skipped");
      await addTerminalLog(activeWorktree, "warning", `[${activeStory}] Task has been skipped`);

      const updatedFeat = await fetchWorktree(activeWorktree);
      setFeat(updatedFeat ?? null);
      if (updatedFeat) {
        const updatedTask = updatedFeat.stories.find((t) => t.id === activeStory);
        setTask(updatedTask || null);
        setTerminalLogs(updatedTask?.terminal || []);
      }
    } catch (error) {
      console.error("Failed to skip task:", error);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-[#0d1117] to-[#161b22] min-w-0">
      {/* Content Header */}
      <div className="h-10 bg-gradient-to-r from-[#333333] to-[#2d2d2d] flex items-center justify-between px-4 border-b border-[#30363d]">
        <div className="flex items-center space-x-2 min-w-0">
          {isLoading ? (
            <span className="text-sm text-[#8b949e]">Loading...</span>
          ) : task ? (
            <>
              <span className="text-xs font-mono text-[#8b949e] truncate max-w-[150px]">{task.id}</span>
              <span className="text-sm text-[#e6edf3] truncate">{task.title}</span>
            </>
          ) : feat ? (
            <>
              <span className="text-xs font-mono text-[#8b949e] truncate max-w-[150px]">{feat.branchName}</span>
              <span className="text-sm text-[#e6edf3] truncate">{feat.title}</span>
            </>
          ) : workspace ? (
            <>
              <span className="text-xs font-mono text-[#8b949e] truncate max-w-[150px]">{workspace.branch}</span>
              <span className="text-sm text-[#e6edf3] truncate">{workspace.name}</span>
              <span className="text-xs text-[#8b949e] truncate max-w-[200px]">{workspace.path}</span>
            </>
          ) : (
            <span className="text-sm text-[#8b949e]">Please select a feature to start</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {task && (
            <>
              <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(getStoryStatus(task))} bg-[#1e1e1e]`}>
                {getStatusLabel(getStoryStatus(task))}
              </span>
              {(getStoryStatus(task) === "pending") && (
                <>
                  <button
                    onClick={handleRetryTask}
                    className="px-3 py-1.5 text-xs bg-gradient-to-r from-[#6366f1] to-[#5558e0] hover:from-[#5558e0] hover:to-[#4f46e5] text-white rounded-md transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-md hover:shadow-lg active:scale-95"
                  >
                    Retry
                  </button>
                  <button
                    onClick={handleSkipTask}
                    className="px-3 py-1.5 text-xs bg-[#30363d] hover:bg-[#3c3c3c] text-[#e6edf3] rounded-md transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] border border-transparent hover:border-[#4a4a4a] active:scale-95"
                  >
                    Skip
                  </button>
                </>
              )}
            </>
          )}
          {!task && feat && !feat.isDefault && (
            <>
              <button className="px-3 py-1.5 text-xs bg-gradient-to-r from-[#6366f1] to-[#5558e0] hover:from-[#5558e0] hover:to-[#4f46e5] text-white rounded-md transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-md hover:shadow-lg active:scale-95">
                Run All
              </button>
              <button className="px-3 py-1.5 text-xs bg-[#30363d] hover:bg-[#3c3c3c] text-[#e6edf3] rounded-md transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] border border-transparent hover:border-[#4a4a4a] active:scale-95">
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area - conditional render between StoryDetailsPanel and Terminal */}
      {activeStory && activeWorktree ? (
        // Show StoryDetailsPanel when a story is selected
        <div className="flex-1 overflow-hidden relative">
          <StoryDetailsPanel storyId={activeStory} prdId={activeWorktree} />
        </div>
      ) : (
        // Show Terminal when no story is selected
        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden flex flex-col shadow-lg">
            {/* Terminal Header */}
            <div className="h-8 bg-[#161b22] flex items-center justify-between px-3 border-b border-[#30363d] flex-shrink-0">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-xs text-[#8b949e]">Terminal</span>
                {workspace && (
                  <>
                    <span className="text-xs text-[#30363d]">•</span>
                    <span className="text-xs text-[#e6edf3] truncate">{workspace.name}</span>
                    <span className="text-xs text-[#8b949e] truncate max-w-[200px]">{workspace.path}</span>
                  </>
                )}
              </div>
            {workspace?.terminals && workspace.terminals.length > 0 && (
              <span className="text-xs text-[#8b949e]">
                {workspace.terminals.length} session(s)
              </span>
            )}
          </div>
          {/* Terminal Content - xterm.js integration */}
          <div className="flex-1 overflow-hidden" ref={terminalContainerRef}>
            {!activeWorkspace ? (
              <TerminalEmptyState />
            ) : !feat ? (
              <XtermTerminal
                key="workspace"
                logs={terminalLogs}
                welcomeMessage={`Workspace: ${workspace?.name || 'Unknown'} - Real Shell Mode`}
                prompt={`${workspace?.name ? `${workspace.name}>` : '➜'}`}
                webSocketMode={true}
                workspaceId={workspace?.id}
                workspacePath={workspace?.path}
              />
            ) : task ? (
              <XtermTerminal
                key={`task-${task.id}`}
                logs={terminalLogs}
                welcomeMessage={`Task: ${task.id} - ${task.title}`}
                prompt={`${task.id}>`}
                webSocketMode={true}
                workspaceId={workspace?.id}
                workspacePath={feat?.path}
              />
            ) : (
              <XtermTerminal
                key={`feat-${feat.branchName}`}
                logs={terminalLogs}
                welcomeMessage={`Feat: ${feat.branchName} - ${feat.title}`}
                prompt={`${feat.branchName}>`}
                webSocketMode={true}
                workspaceId={workspace?.id}
                workspacePath={feat?.path}
              />
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

// Right panel - Code diff and commit info
function RightPanel() {
  const { isRightPanelCollapsed, expandRightPanel, collapseRightPanel, activeWorktree, activeStory, activeWorkspace } = useLayoutState();

  if (isRightPanelCollapsed) {
    return (
      <div className="w-12 bg-gradient-to-b from-[#252526] to-[#1e1e1e] border-l border-[#30363d] flex flex-col items-center py-4 flex-shrink-0">
        <button
          onClick={expandRightPanel}
          className="p-2 rounded-lg hover:bg-[#3c3c3c] text-[#8b949e] hover:text-[#e6edf3] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:shadow-lg active:scale-95"
          title="Expand right panel"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-[380px] bg-gradient-to-b from-[#252526] to-[#1e1e1e] border-l border-[#30363d] flex flex-col flex-shrink-0">
      {/* Panel Header */}
      <div className="h-10 bg-gradient-to-r from-[#333333] to-[#2d2d2d] flex items-center justify-between px-3 border-b border-[#30363d]">
        <span className="text-sm font-medium text-[#e6edf3]">Code Changes</span>
        <button
          onClick={collapseRightPanel}
          className="p-1.5 rounded-md hover:bg-[#3c3c3c] text-[#8b949e] hover:text-[#e6edf3] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-95"
          title="Collapse right panel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">
        <CodeChangesPanel featId={activeWorktree} taskId={activeStory} workspaceId={activeWorkspace} />
      </div>
    </div>
  );
}

// Status bar component is now imported from @/components/layout/status-bar

// Hook for responsive layout behavior
function useResponsiveLayout() {
  const { collapseLeftPanel, collapseRightPanel, expandLeftPanel, expandRightPanel, isLeftPanelCollapsed, isRightPanelCollapsed } = useLayoutState();

  useEffect(() => {
    const handleResize = () => {
      const isSmallScreen = window.innerWidth < 1280;
      if (isSmallScreen) {
        // Auto-collapse both panels on small screens
        if (!isLeftPanelCollapsed) collapseLeftPanel();
        if (!isRightPanelCollapsed) collapseRightPanel();
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Check initial size

    return () => window.removeEventListener("resize", handleResize);
  }, [collapseLeftPanel, collapseRightPanel, expandLeftPanel, expandRightPanel, isLeftPanelCollapsed, isRightPanelCollapsed]);
}

// Responsive layout wrapper
function ResponsiveLayout({ children }: { children: React.ReactNode }) {
  useResponsiveLayout();
  return <>{children}</>;
}

// Main page component
export default function HomePage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const {
    toggleLeftPanel,
    toggleRightPanel,
    goBack,
    sidebarView,
  } = useLayoutState();

  // Get command palette state
  const { isOpen: isCommandPaletteOpen, open: openCommandPalette } = useCommandPalette();

  // Register global keyboard shortcuts
  useGlobalKeyboardShortcuts({
    toggleLeftPanel,
    toggleRightPanel,
    goBack,
    focusTerminal: () => {
      // Focus terminal input - find the textarea in the terminal
      const terminalTextarea = document.querySelector('.xterm-helper-textarea') as HTMLElement;
      terminalTextarea?.focus();
    },
    openCommandPalette,
    isCommandPaletteOpen,
    sidebarView,
  });

  // Register commands on mount
  useEffect(() => {
    const commands = createDefaultCommands({
      toggleLeftPanel,
      toggleRightPanel,
      goBack,
      focusTerminal: () => {
        // Focus terminal input - find the textarea in the terminal
        const terminalTextarea = document.querySelector('.xterm-helper-textarea') as HTMLElement;
        terminalTextarea?.focus();
      },
      openSettings: () => {
        console.log("Open settings - to be implemented");
      },
      showHelp: () => {
        console.log("Show help - to be implemented");
      },
    });

    commands.forEach((cmd) => commandRegistry.register(cmd));

    return () => {
      commands.forEach((cmd) => commandRegistry.unregister(cmd.id));
    };
  }, [toggleLeftPanel, toggleRightPanel, goBack]);

  return (
    <ToastProvider>
      <div className="h-screen flex flex-col">
        {/* Main Layout */}
        <div className="flex-1 flex overflow-hidden">
          <ResponsiveLayout>
            <LeftPanel selectedTaskId={selectedTaskId} setSelectedTaskId={setSelectedTaskId} />
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-[#8b949e]">Loading...</div>}>
              <MainContent selectedTaskId={selectedTaskId} onTaskSelect={setSelectedTaskId} />
            </Suspense>
            <RightPanel />
          </ResponsiveLayout>
        </div>

        {/* Status Bar */}
        <StatusBar />

        {/* Command Palette */}
        <CommandPalette />
      </div>
    </ToastProvider>
  );
}
