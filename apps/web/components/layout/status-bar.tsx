"use client";

import { useLayoutState } from "@/lib/ui/state";
import { useEffect, useState } from "react";
import type { Worktree, Workspace } from "@/types";
import { fetchWorkspacesAndWorktrees } from "@/lib/api/workspace-client";
import { formatShortcut } from "@/lib/ui/keyboard-shortcuts";

interface StatusBarStats {
  runningTasks: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  currentBranch: string;
  currentWorkspace: string | null;
  currentFeat: string | null;
  isWorktree: boolean; // Is worktree
}

export function StatusBar() {
  const { activeWorkspace, activeWorktree } = useLayoutState();
  const [stats, setStats] = useState<StatusBarStats>({
    runningTasks: 0,
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    currentBranch: "main",
    currentWorkspace: null,
    currentFeat: null,
    isWorktree: false,
  });
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [feats, setFeats] = useState<Worktree[]>([]);

  // Load workspaces and feats
  useEffect(() => {
    const loadData = async () => {
      try {
        const { workspaces: wsList, worktrees: allFeats } = await fetchWorkspacesAndWorktrees();
        setWorkspaces(wsList);
        setFeats(allFeats);
      } catch (error) {
        console.error("Failed to load status bar data:", error);
      }
    };

    loadData();
  }, []);

  // Calculate stats when data changes
  useEffect(() => {
    const calculateStats = () => {
      let runningTasks = 0;
      let totalTasks = 0;
      let completedTasks = 0;
      let failedTasks = 0;
      let currentBranch = "main";
      let currentWorkspaceName: string | null = null;
      let currentFeatTitle: string | null = null;
      let isWorktree = false;

      // Calculate task stats from all feats
      for (const feat of feats) {
        for (const task of feat.stories || []) {
          totalTasks++;
          if (task.passes) {
            completedTasks++;
          }
        }
      }

      // Get current workspace name
      if (activeWorkspace) {
        const workspace = workspaces.find((w) => w.id === activeWorkspace);
        if (workspace) {
          currentWorkspaceName = workspace.name;
          currentBranch = workspace.branch;
        }
      }

      // Get current feat info（feat 即 worktree，选中 feat 即处于 worktree 模式）
      // Get current feat info (feat = worktree, having active feat = worktree mode)
      if (activeWorktree) {
        const feat = feats.find((f) => f.id === activeWorktree);
        if (feat) {
          currentFeatTitle = feat.title;
          currentBranch = feat.branchName;
          isWorktree = true;
        }
      }

      setStats({
        runningTasks,
        totalTasks,
        completedTasks,
        failedTasks,
        currentBranch,
        currentWorkspace: currentWorkspaceName,
        currentFeat: currentFeatTitle,
        isWorktree,
      });
    };

    calculateStats();
  }, [feats, workspaces, activeWorkspace, activeWorktree]);

  // Get system status text and color
  const getSystemStatus = () => {
    if (stats.failedTasks > 0) {
      return { text: `${stats.failedTasks} task(s) failed`, color: "text-[#f85149]" };
    }
    if (stats.runningTasks > 0) {
      return { text: `${stats.runningTasks} task(s) running`, color: "text-[#3fb950]" };
    }
    if (stats.completedTasks === stats.totalTasks && stats.totalTasks > 0) {
      return { text: "All completed", color: "text-[#6366f1]" };
    }
    return { text: "System ready", color: "text-white" };
  };

  const systemStatus = getSystemStatus();

  return (
    <div className="h-6 bg-gradient-to-r from-[#007acc] to-[#005a9e] flex items-center justify-between px-3 text-white text-xs select-none shadow-inner">
      {/* Left side - System status */}
      <div className="flex items-center space-x-4">
        {/* Running tasks indicator */}
        <span className="flex items-center space-x-1.5" title="Running task count">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className={stats.runningTasks > 0 ? "text-[#3fb950] font-medium" : ""}>
            {stats.runningTasks} task(s) running
          </span>
        </span>

        {/* System status */}
        <span className="flex items-center space-x-1.5" title="System status">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          <span className={systemStatus.color}>{systemStatus.text}</span>
        </span>

        {/* Current branch - feat/worktree branches use orange color and different icon */}
        <span className="flex items-center space-x-1.5" title={stats.currentFeat ? "Current feat branch" : "Current branch"}>
          {stats.currentFeat || stats.isWorktree ? (
            // Feat/Worktree branch - use orange color and file icon
            <>
              <svg className="w-3 h-3 text-[#ff9f0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-mono text-[#ff9f0a]">{stats.currentBranch}</span>
              {stats.isWorktree && (
                <span className="text-[10px] text-[#ff9f0a] ml-1">worktree</span>
              )}
            </>
          ) : (
            // Workspace branch - use default tag icon
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span className="font-mono">{stats.currentBranch}</span>
            </>
          )}
        </span>
      </div>

      {/* Right side - Selection info and shortcuts */}
      <div className="flex items-center space-x-4">
        {/* Current selection */}
        {stats.currentWorkspace && (
          <span className="flex items-center space-x-1.5" title="Current workspace">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="truncate max-w-[120px]">{stats.currentWorkspace}</span>
          </span>
        )}

        {stats.currentFeat && (
          <span className="flex items-center space-x-1.5" title="Current feature">
            <svg className="w-3 h-3 text-[#ff9f0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="truncate max-w-[120px] text-[#ff9f0a]">{stats.currentFeat}</span>
          </span>
        )}

        {/* Version */}
        <span className="opacity-80" title="Version">
          Talos v0.1.0
        </span>

        {/* Keyboard shortcuts hint */}
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1 opacity-80 hover:opacity-100 transition-opacity duration-200" title="Toggle left panel">
            <kbd className="px-1.5 py-0.5 bg-[#005a9e]/80 hover:bg-[#005a9e] rounded text-[10px] font-mono transition-colors duration-200">{formatShortcut("Ctrl+B")}</kbd>
          </span>
          <span className="flex items-center space-x-1 opacity-80 hover:opacity-100 transition-opacity duration-200" title="Toggle right panel">
            <kbd className="px-1.5 py-0.5 bg-[#005a9e]/80 hover:bg-[#005a9e] rounded text-[10px] font-mono transition-colors duration-200">{formatShortcut("Ctrl+Shift+B")}</kbd>
          </span>
          <span className="flex items-center space-x-1 opacity-80 hover:opacity-100 transition-opacity duration-200" title="Open command palette">
            <kbd className="px-1.5 py-0.5 bg-[#005a9e]/80 hover:bg-[#005a9e] rounded text-[10px] font-mono transition-colors duration-200">{formatShortcut("Ctrl+Shift+K")}</kbd>
            <span>Command Palette</span>
          </span>
        </div>
      </div>
    </div>
  );
}
