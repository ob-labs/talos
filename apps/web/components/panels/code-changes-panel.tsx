"use client";

import { useState, useEffect, useCallback } from "react";
import type { Worktree, Story } from "@/types";
import { fetchWorktree } from "@/lib/api/workspace-client";
import { useToast } from "@/components/ui/toast";
import { useLayoutState } from "@/lib/ui/state";

// File change entry
interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  diff?: string;
  status?: "added" | "modified" | "deleted" | "untracked";
}

// Commit entry
interface CommitEntry {
  hash: string;
  taskId: string;
  message: string;
  timestamp: number;
  files: FileChange[];
}

// Aggregated stats for a feat
interface FeatCodeStats {
  commitCount: number;
  fileCount: number;
  totalAdditions: number;
  totalDeletions: number;
}

// Task level code stats
interface TaskCodeStats {
  hasCommit: boolean;
  fileCount: number;
  totalAdditions: number;
  totalDeletions: number;
}

interface CodeChangesPanelProps {
  featId: string | null;
  taskId?: string | null;
  workspaceId?: string | null;
}

export function CodeChangesPanel({ featId, taskId, workspaceId }: CodeChangesPanelProps) {
  const [feat, setFeat] = useState<Worktree | null>(null);
  const [task, setTask] = useState<Story | null>(null);
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [stats, setStats] = useState<FeatCodeStats>({
    commitCount: 0,
    fileCount: 0,
    totalAdditions: 0,
    totalDeletions: 0,
  });
  const [taskStats, setTaskStats] = useState<TaskCodeStats>({
    hasCommit: false,
    fileCount: 0,
    totalAdditions: 0,
    totalDeletions: 0,
  });
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [workspaceChanges, setWorkspaceChanges] = useState<FileChange[]>([]);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const { showToast } = useToast();
  const layoutState = useLayoutState();

  // Use provided workspaceId or fall back to active workspace from state
  const effectiveWorkspaceId = workspaceId || layoutState.activeWorkspace;

  // Fetch real git diff from API
  const fetchGitDiff = useCallback(async () => {
    if (!effectiveWorkspaceId || !featId) return;

    console.log('[CodeChangesPanel] Fetching git diff:', { effectiveWorkspaceId, featId, taskId });

    try {
      const response = await fetch(
        `/api/git/diff?workspaceId=${effectiveWorkspaceId}&featId=${featId}${taskId ? `&taskId=${taskId}` : ""}`
      );

      console.log('[CodeChangesPanel] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[CodeChangesPanel] Response data:', data);

        if (data.diff && data.diff.length > 0) {
          console.log('[CodeChangesPanel] Found', data.diff.length, 'file changes');
          // Convert API diff format to FileChange format
          const changes: FileChange[] = data.diff.map((d: { file: string; status: string; additions: number; deletions: number; diff: string }) => ({
            path: d.file,
            additions: d.additions || 0,
            deletions: d.deletions || 0,
            diff: d.diff,
            status: d.status as FileChange["status"],
          }));

          if (taskId) {
            setWorkspaceChanges(changes);
            const totalAdditions = changes.reduce((sum, f) => sum + f.additions, 0);
            const totalDeletions = changes.reduce((sum, f) => sum + f.deletions, 0);
            setTaskStats(prev => ({
              ...prev,
              fileCount: changes.length,
              totalAdditions,
              totalDeletions,
            }));
          } else {
            setFileChanges(changes);
            const totalAdditions = changes.reduce((sum, f) => sum + f.additions, 0);
            const totalDeletions = changes.reduce((sum, f) => sum + f.deletions, 0);
            setStats(prev => ({
              ...prev,
              fileCount: changes.length,
              totalAdditions,
              totalDeletions,
            }));
          }

          // Auto-expand first file
          if (changes.length > 0) {
            setExpandedFiles(new Set([changes[0].path]));
          }
        } else {
          console.log('[CodeChangesPanel] No diff data found in response');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[CodeChangesPanel] API error:', response.status, errorData);
      }
    } catch (error) {
      console.error('[CodeChangesPanel] Failed to fetch git diff:', error);
    }
  }, [effectiveWorkspaceId, featId, taskId]);

  // Load feat/task data and aggregate commits
  useEffect(() => {
    const loadData = async () => {
      if (!featId) {
        setFeat(null);
        setTask(null);
        setCommits([]);
        setFileChanges([]);
        setWorkspaceChanges([]);
        setStats({
          commitCount: 0,
          fileCount: 0,
          totalAdditions: 0,
          totalDeletions: 0,
        });
        setTaskStats({
          hasCommit: false,
          fileCount: 0,
          totalAdditions: 0,
          totalDeletions: 0,
        });
        return;
      }

      setIsLoading(true);
      try {
        const featData = await fetchWorktree(featId);
        setFeat(featData ?? null);

        if (featData) {
          // If taskId is provided, load task-specific data
          if (taskId) {
            const taskData = featData.stories.find((t) => t.id === taskId) || null;
            setTask(taskData);

            if (taskData) {
              if (taskData.commit) {
                // Task has commit - show commit info
                const taskCommit: CommitEntry = {
                  hash: taskData.commit.hash,
                  taskId: taskData.id,
                  message: taskData.commit.message,
                  timestamp: taskData.commit.timestamp,
                  files: [],
                };
                const taskFiles = generateMockFileChanges(taskCommit);
                setFileChanges(taskFiles);
                setWorkspaceChanges([]);

                const totalAdditions = taskFiles.reduce((sum, f) => sum + f.additions, 0);
                const totalDeletions = taskFiles.reduce((sum, f) => sum + f.deletions, 0);
                setTaskStats({
                  hasCommit: true,
                  fileCount: taskFiles.length,
                  totalAdditions,
                  totalDeletions,
                });

                // Auto-expand first file
                if (taskFiles.length > 0) {
                  setExpandedFiles(new Set([taskFiles[0].path]));
                }
              } else {
                // Task has no commit - fetch real workspace changes
                setTaskStats({
                  hasCommit: false,
                  fileCount: 0,
                  totalAdditions: 0,
                  totalDeletions: 0,
                });
                await fetchGitDiff();
              }
            }
          } else {
            // Feat level - show all commits
            setTask(null);
            const taskCommits = aggregateCommits(featData.stories || []);
            setCommits(taskCommits);

            // Calculate stats from commits
            const totalAdditions = taskCommits.length * 50; // Estimate
            const totalDeletions = taskCommits.length * 10; // Estimate
            setStats({
              commitCount: taskCommits.length,
              fileCount: taskCommits.length,
              totalAdditions,
              totalDeletions,
            });

            // Clear old file changes before fetching new data
            setFileChanges([]);


            // Try to fetch real diff data
            await fetchGitDiff();

            // Auto-expand first file if exists
            if (fileChanges.length > 0) {
              setExpandedFiles(new Set([fileChanges[0].path]));
            }
          }
        }
      } catch (error) {
        console.error("Failed to load code changes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [featId, taskId, fetchGitDiff]);

  // Aggregate commits from completed tasks
  const aggregateCommits = (tasks: Story[]): CommitEntry[] => {
    const commits: CommitEntry[] = [];

    for (const task of tasks) {
      if (task.commit) {
        commits.push({
          hash: task.commit.hash,
          taskId: task.id,
          message: task.commit.message,
          timestamp: task.commit.timestamp,
          files: [], // Will be populated from git diff in the future
        });
      }
    }

    // Sort by timestamp (newest first)
    return commits.sort((a, b) => b.timestamp - a.timestamp);
  };

  // Aggregate file changes from all commits
  const aggregateFileChanges = (commits: CommitEntry[]): FileChange[] => {
    const fileMap = new Map<string, FileChange>();

    // For now, generate mock file changes based on commit messages
    // In the future, this will come from git diff
    for (const commit of commits) {
      // Mock file changes - in real implementation, these come from git
      const mockFiles = generateMockFileChanges(commit);

      for (const file of mockFiles) {
        const existing = fileMap.get(file.path);
        if (existing) {
          existing.additions += file.additions;
          existing.deletions += file.deletions;
        } else {
          fileMap.set(file.path, { ...file });
        }
      }
    }

    return Array.from(fileMap.values());
  };

  // Generate mock file changes for demonstration
  // TODO: Replace with actual git diff when US-013 is implemented
  const generateMockFileChanges = (commit: CommitEntry): FileChange[] => {
    // This is temporary - will be replaced by actual git operations
    return [
      {
        path: `app/${commit.taskId.toLowerCase().replace("-", "/")}.tsx`,
        additions: Math.floor(Math.random() * 100) + 10,
        deletions: Math.floor(Math.random() * 20),
        diff: `@@ -1,5 +1,10 @@\n+import { useState } from "react";\n+\n export default function Component() {\n+  const [state, setState] = useState(null);\n+\n   return (\n     <div>\n+      <h1>New Feature</h1>\n       <p>Content</p>\n     </div>\n   );`,
      },
    ];
  };

  // Generate mock workspace changes for uncommitted task
  // TODO: Replace with actual git status when US-013 is implemented
  const generateMockWorkspaceChanges = (task: Story): FileChange[] => {
    // This is temporary - will be replaced by actual git operations
    return [
      {
        path: `lib/${task.id.toLowerCase().replace(/-/g, "/")}.ts`,
        additions: Math.floor(Math.random() * 50) + 5,
        deletions: Math.floor(Math.random() * 10),
        status: "modified",
        diff: `@@ -1,10 +1,15 @@\n import { something } from "./utils";\n \n export function processData(data: unknown) {\n+  // TODO: Implement ${task.title}\n+  console.log("Processing:", data);\n+\n   if (!data) {\n     return null;\n   }\n   \n-  return data;\n+  const result = transform(data);\n+  return result;\n }\n \n+function transform(input: unknown) {\n+  return input;\n+}`,
      },
      {
        path: `components/${task.id.toLowerCase().replace(/-/g, "-")}-view.tsx`,
        additions: Math.floor(Math.random() * 80) + 20,
        deletions: 0,
        status: "added",
        diff: `@@ -0,0 +1,20 @@\n+"use client";\n+\n+import { useState } from "react";\n+\n+interface Props {\n+  taskId: string;\n+}\n+\n+export function TaskView({ taskId }: Props) {\n+  const [loading, setLoading] = useState(false);\n+\n+  return (\n+    <div className="p-4">\n+      <h1>Task: {taskId}</h1>\n+      <p>Status: In Progress</p>\n+    </div>\n  );\n+}`,
      },
    ];
  };

  // Toggle file expansion
  const toggleFileExpansion = (path: string) => {
    setExpandedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  // Format timestamp
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Handle view history
  const handleViewHistory = () => {
    // TODO: Open history view when implemented
    console.log("View history for feat:", featId);
  };

  // Handle create PR
  const handleCreatePR = async () => {
    if (!effectiveWorkspaceId || !feat) {
      showToast("请先选择工作区和功能", "warning");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/git/pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: effectiveWorkspaceId,
          featId: feat.id,
          title: feat.title,
          body: feat.name,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.pr?.url) {
          window.open(data.pr.url, "_blank");
          showToast("PR 创建成功", "success");
        } else {
          // Fallback: open GitHub compare page
          const url = `https://github.com/owner/repo/compare/${feat.branchName}?expand=1`;
          window.open(url, "_blank");
          showToast("请在浏览器中完成 PR 创建", "info");
        }
      } else {
        const error = await response.json();
        showToast(error.message || "创建 PR 失败", "error");
      }
    } catch (error) {
      console.error("Failed to create PR:", error);
      showToast("创建 PR 失败", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle commit changes (for uncommitted task)
  const handleCommitChanges = () => {
    if (!task) return;
    // Generate default commit message
    const defaultMessage = `feat: ${task.title}`;
    setCommitMessage(defaultMessage);
    setShowCommitDialog(true);
  };

  // Handle confirm commit
  const handleConfirmCommit = async () => {
    if (!effectiveWorkspaceId || !featId || !task) {
      showToast("缺少必要信息", "error");
      return;
    }

    if (!commitMessage.trim()) {
      showToast("请输入提交信息", "warning");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: effectiveWorkspaceId,
          featId,
          taskId: task.id,
          message: commitMessage,
          addAll: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        showToast("提交成功", "success");
        setShowCommitDialog(false);
        // Refresh data
        const updatedFeat = await fetchWorktree(featId);
        if (updatedFeat) {
          setFeat(updatedFeat);
          const updatedTask = updatedFeat.stories.find((t) => t.id === task.id);
          if (updatedTask) {
            setTask(updatedTask);
            setTaskStats(prev => ({ ...prev, hasCommit: true }));
          }
        }
      } else {
        const error = await response.json();
        showToast(error.message || "提交失败", "error");
      }
    } catch (error) {
      console.error("Failed to commit changes:", error);
      showToast("提交失败", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle discard changes (for uncommitted task)
  const handleDiscardChanges = async () => {
    if (!effectiveWorkspaceId || !featId) {
      showToast("缺少必要信息", "error");
      return;
    }

    if (!confirm("确定要丢弃所有未提交的变更吗？此操作不可恢复。")) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/git/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: effectiveWorkspaceId,
          featId,
        }),
      });

      if (response.ok) {
        showToast("变更已丢弃", "success");
        setWorkspaceChanges([]);
        setTaskStats(prev => ({
          ...prev,
          fileCount: 0,
          totalAdditions: 0,
          totalDeletions: 0,
        }));
      } else {
        const error = await response.json();
        showToast(error.message || "丢弃变更失败", "error");
      }
    } catch (error) {
      console.error("Failed to discard changes:", error);
      showToast("丢弃变更失败", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center space-x-2 text-sm text-[#8b949e]">
          <div className="w-4 h-4 border-2 border-[#30363d] border-t-[#6366f1] rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Render file change item
  const renderFileChange = (file: FileChange, isWorkspaceChange = false) => (
    <div
      key={file.path}
      className="bg-gradient-to-r from-[#1e1e1e] to-[#1a1a1a] rounded-lg border border-[#30363d] overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-[#3c3c3c] hover:shadow-md"
    >
      <button
        onClick={() => toggleFileExpansion(file.path)}
        className="w-full flex items-center justify-between p-2.5 text-sm hover:bg-[#252526] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
      >
        <div className="flex items-center space-x-2 min-w-0">
          <svg
            className={`w-3 h-3 text-[#8b949e] transition-transform ${
              expandedFiles.has(file.path) ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          {isWorkspaceChange && file.status && (
            <span className={`text-[10px] px-1 rounded ${
              file.status === "added" ? "bg-[#3fb950]/20 text-[#3fb950]" :
              file.status === "deleted" ? "bg-[#f85149]/20 text-[#f85149]" :
              "bg-[#d29922]/20 text-[#d29922]"
            }`}>
              {file.status === "added" ? "A" :
               file.status === "deleted" ? "D" :
               file.status === "untracked" ? "?" : "M"}
            </span>
          )}
          <span className="text-[#e6edf3] truncate">{file.path}</span>
        </div>
        <div className="flex items-center space-x-2 text-xs flex-shrink-0">
          {file.additions > 0 && (
            <span className="text-[#3fb950]">+{file.additions}</span>
          )}
          {file.deletions > 0 && (
            <span className="text-[#f85149]">-{file.deletions}</span>
          )}
        </div>
      </button>

      {/* Diff Content */}
      {expandedFiles.has(file.path) && file.diff && (
        <div className="border-t border-[#30363d] bg-[#0d1117]">
          <pre className="p-3 text-xs font-mono overflow-x-auto">
            <code>
              {file.diff.split("\n").map((line, index) => {
                let className = "text-[#e6edf3]";
                if (line.startsWith("+")) className = "text-[#3fb950]";
                else if (line.startsWith("-")) className = "text-[#f85149]";
                else if (line.startsWith("@@")) className = "text-[#8b949e]";
                return (
                  <div key={index} className={className}>
                    {line || " "}
                  </div>
                );
              })}
            </code>
          </pre>
        </div>
      )}
    </div>
  );

  // Render empty state
  const renderEmptyState = (message: string, subMessage?: string) => (
    <div className="text-center py-6">
      <div className="text-xs text-[#8b949e]">{message}</div>
      {subMessage && <div className="text-[10px] text-[#6e7681] mt-1">{subMessage}</div>}
    </div>
  );

  // Render commit dialog
  const renderCommitDialog = () => {
    if (!showCommitDialog) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#1e1e1e] border border-[#30363d] rounded-lg p-4 w-[400px] max-w-[90vw]">
          <h3 className="text-sm font-medium text-[#e6edf3] mb-3">提交变更</h3>
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="输入提交信息..."
            className="w-full h-24 bg-[#0d1117] border border-[#30363d] rounded p-2 text-sm text-[#e6edf3] placeholder-[#6e7681] resize-none focus:outline-none focus:border-[#6366f1]"
            autoFocus
          />
          <div className="flex justify-end space-x-2 mt-3">
            <button
              onClick={() => setShowCommitDialog(false)}
              className="px-3 py-1.5 text-sm text-[#8b949e] hover:text-[#e6edf3] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmCommit}
              disabled={isLoading || !commitMessage.trim()}
              className="px-3 py-1.5 bg-[#6366f1] hover:bg-[#5558e0] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
            >
              {isLoading ? "提交中..." : "提交"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!feat) {
    return (
      <div className="flex items-center justify-center h-full text-[#8b949e]">
        <div className="text-center">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-[#30363d]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm">选择一个功能ViewCode Changes</p>
        </div>
      </div>
    );
  }

  // Task Level View
  if (taskId && task) {
    return (
      <>
        {renderCommitDialog()}
        <div className="h-full overflow-auto">
          <div className="p-4 space-y-4">
          {/* Task Title and Info */}
          <div className="border-b border-[#30363d] pb-3">
            <h3 className="text-sm font-medium text-[#e6edf3]">{task.title}</h3>
            <p className="text-xs text-[#8b949e] mt-1">{task.id}</p>
            <div className="flex items-center space-x-2 mt-2">
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  task.passes
                    ? "bg-[#6366f1]/20 text-[#6366f1]"
                    : "bg-[#30363d] text-[#8b949e]"
                }`}
              >
                {task.passes ? "已完成" : "待开始"}
              </span>
              {task.commit ? (
                <span className="text-xs font-mono text-[#58a6ff]">
                  {task.commit.hash.slice(0, 7)}
                </span>
              ) : (
                <span className="text-xs text-[#8b949e]">未提交</span>
              )}
            </div>
          </div>

          {/* Task has commit - show commit info */}
          {taskStats.hasCommit && task.commit ? (
            <>
              {/* Commit Info */}
              <div className="bg-[#1e1e1e] p-3 rounded border border-[#30363d]">
                <div className="text-xs text-[#8b949e] mb-1">提交信息</div>
                <div className="text-sm text-[#e6edf3]">{task.commit.message}</div>
                <div className="flex items-center space-x-3 mt-2 text-xs">
                  <span className="font-mono text-[#58a6ff]">{task.commit.hash.slice(0, 7)}</span>
                  <span className="text-[#8b949e]">{formatTime(task.commit.timestamp)}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gradient-to-b from-[#1e1e1e] to-[#1a1a1a] p-2 rounded-lg text-center border border-[#30363d] shadow-sm">
                  <div className="text-lg font-mono text-[#e6edf3]">{taskStats.fileCount}</div>
                  <div className="text-[10px] text-[#8b949e]">文件</div>
                </div>
                <div className="bg-gradient-to-b from-[#1e1e1e] to-[#1a1a1a] p-2 rounded-lg text-center border border-[#30363d] shadow-sm">
                  <div className="text-lg font-mono text-[#3fb950]">+{taskStats.totalAdditions}</div>
                  <div className="text-[10px] text-[#8b949e]">添加</div>
                </div>
                <div className="bg-gradient-to-b from-[#1e1e1e] to-[#1a1a1a] p-2 rounded-lg text-center border border-[#30363d] shadow-sm">
                  <div className="text-lg font-mono text-[#f85149]">-{taskStats.totalDeletions}</div>
                  <div className="text-[10px] text-[#8b949e]">Delete</div>
                </div>
              </div>

              {/* File Changes */}
              {fileChanges.length > 0 ? (
                <div>
                  <div className="text-xs font-medium text-[#8b949e] uppercase tracking-wider mb-2">
                    Changed Files
                  </div>
                  <div className="space-y-1">
                    {fileChanges.map((file) => renderFileChange(file))}
                  </div>
                </div>
              ) : (
                renderEmptyState("暂无文件变更")
              )}

              {/* Action Buttons */}
              <div className="flex space-x-2 pt-2 border-t border-[#30363d]">
                <button
                  onClick={handleViewHistory}
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-[#30363d] to-[#2d2d2d] hover:from-[#3c3c3c] hover:to-[#363636] text-[#e6edf3] text-sm rounded-lg transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] border border-[#3c3c3c] hover:border-[#4a4a4a] active:scale-95"
                >
                  View历史
                </button>
                <button
                  onClick={handleCreatePR}
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-[#6366f1] to-[#5558e0] hover:from-[#5558e0] hover:to-[#4f46e5] text-white text-sm rounded-lg transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-md hover:shadow-lg active:scale-95"
                >
                  创建 PR
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Task has no commit - show workspace changes */}
              <div className="bg-gradient-to-r from-[#d29922]/10 to-[#d29922]/5 border border-[#d29922]/30 p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-[#d29922]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm text-[#d29922]">工作区变更</span>
                </div>
                <p className="text-xs text-[#8b949e] mt-1">
                  此任务有未提交的变更，请View并提交。
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gradient-to-b from-[#1e1e1e] to-[#1a1a1a] p-2 rounded-lg text-center border border-[#30363d] shadow-sm">
                  <div className="text-lg font-mono text-[#e6edf3]">{taskStats.fileCount}</div>
                  <div className="text-[10px] text-[#8b949e]">文件</div>
                </div>
                <div className="bg-gradient-to-b from-[#1e1e1e] to-[#1a1a1a] p-2 rounded-lg text-center border border-[#30363d] shadow-sm">
                  <div className="text-lg font-mono text-[#3fb950]">+{taskStats.totalAdditions}</div>
                  <div className="text-[10px] text-[#8b949e]">添加</div>
                </div>
                <div className="bg-gradient-to-b from-[#1e1e1e] to-[#1a1a1a] p-2 rounded-lg text-center border border-[#30363d] shadow-sm">
                  <div className="text-lg font-mono text-[#f85149]">-{taskStats.totalDeletions}</div>
                  <div className="text-[10px] text-[#8b949e]">Delete</div>
                </div>
              </div>

              {/* Workspace Changes */}
              {workspaceChanges.length > 0 ? (
                <div>
                  <div className="text-xs font-medium text-[#8b949e] uppercase tracking-wider mb-2">
                    未提交变更
                  </div>
                  <div className="space-y-1">
                    {workspaceChanges.map((file) => renderFileChange(file, true))}
                  </div>
                </div>
              ) : (
                renderEmptyState("暂无未提交变更")
              )}

              {/* Action Buttons */}
              <div className="flex space-x-2 pt-2 border-t border-[#30363d]">
                <button
                  onClick={handleDiscardChanges}
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-[#f85149]/20 to-[#f85149]/10 hover:from-[#f85149]/30 hover:to-[#f85149]/20 text-[#f85149] text-sm rounded-lg transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] border border-[#f85149]/30 hover:border-[#f85149]/50 active:scale-95"
                >
                  丢弃变更
                </button>
                <button
                  onClick={handleCommitChanges}
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-[#6366f1] to-[#5558e0] hover:from-[#5558e0] hover:to-[#4f46e5] text-white text-sm rounded-lg transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-md hover:shadow-lg active:scale-95"
                >
                  提交变更
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
    );
  }

  // Feat Level View
  return (
    <div className="h-full overflow-auto">
      <div className="p-4 space-y-4">
        {/* Feat Title and Description */}
        <div className="border-b border-[#30363d] pb-3">
          <h3 className="text-sm font-medium text-[#e6edf3]">{feat.title}</h3>
          <p className="text-xs text-[#8b949e] mt-1">{feat.name}</p>
          <div className="flex items-center space-x-2 mt-2">
            <span className="text-xs font-mono text-[#8b949e]">{feat.branchName}</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                feat.status === "running"
                  ? "bg-[#3fb950]/20 text-[#3fb950]"
                  : feat.status === "completed"
                  ? "bg-[#6366f1]/20 text-[#6366f1]"
                  : feat.status === "default"
                  ? "bg-[#30363d] text-[#8b949e]"
                  : "bg-[#30363d] text-[#8b949e]"
              }`}
            >
              {feat.status === "running"
                ? "运行中"
                : feat.status === "completed"
                ? "已完成"
                : feat.status === "default"
                ? "默认"
                : "待开始"}
            </span>
          </div>
        </div>

        {/* Commit Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-gradient-to-b from-[#1e1e1e] to-[#1a1a1a] p-2 rounded-lg text-center border border-[#30363d] shadow-sm">
            <div className="text-lg font-mono text-[#e6edf3]">{stats.commitCount}</div>
            <div className="text-[10px] text-[#8b949e]">提交</div>
          </div>
          <div className="bg-gradient-to-b from-[#1e1e1e] to-[#1a1a1a] p-2 rounded-lg text-center border border-[#30363d] shadow-sm">
            <div className="text-lg font-mono text-[#e6edf3]">{stats.fileCount}</div>
            <div className="text-[10px] text-[#8b949e]">文件</div>
          </div>
          <div className="bg-gradient-to-b from-[#1e1e1e] to-[#1a1a1a] p-2 rounded-lg text-center border border-[#30363d] shadow-sm">
            <div className="text-lg font-mono text-[#3fb950]">+{stats.totalAdditions}</div>
            <div className="text-[10px] text-[#8b949e]">添加</div>
          </div>
          <div className="bg-gradient-to-b from-[#1e1e1e] to-[#1a1a1a] p-2 rounded-lg text-center border border-[#30363d] shadow-sm">
            <div className="text-lg font-mono text-[#f85149]">-{stats.totalDeletions}</div>
            <div className="text-[10px] text-[#8b949e]">Delete</div>
          </div>
        </div>

        {/* Commit History */}
        {commits.length > 0 && (
          <div>
            <div className="text-xs font-medium text-[#8b949e] uppercase tracking-wider mb-2">
              Commit History
            </div>
            <div className="space-y-2">
              {commits.map((commit) => (
                <div
                  key={commit.hash}
                  className="bg-gradient-to-r from-[#1e1e1e] to-[#1a1a1a] p-2 rounded-lg text-sm border border-[#30363d] hover:border-[#3c3c3c] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#58a6ff]">
                      {commit.hash.slice(0, 7)}
                    </span>
                    <span className="text-[10px] text-[#8b949e]">{formatTime(commit.timestamp)}</span>
                  </div>
                  <div className="text-xs text-[#8b949e] mt-1">{commit.taskId}</div>
                  <div className="text-xs text-[#e6edf3] mt-0.5 truncate">{commit.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File Changes */}
        {fileChanges.length > 0 && (
          <div>
            <div className="text-xs font-medium text-[#8b949e] uppercase tracking-wider mb-2">
              Changed Files
            </div>
            <div className="space-y-1">
              {fileChanges.map((file) => renderFileChange(file))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {commits.length === 0 && fileChanges.length === 0 && (
          renderEmptyState("暂无Code Changes", "完成任务后将显示提交记录")
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2 border-t border-[#30363d]">
          <button
            onClick={handleViewHistory}
            className="flex-1 px-3 py-2 bg-gradient-to-r from-[#30363d] to-[#2d2d2d] hover:from-[#3c3c3c] hover:to-[#363636] text-[#e6edf3] text-sm rounded-lg transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] border border-[#3c3c3c] hover:border-[#4a4a4a] active:scale-95"
          >
            View历史
          </button>
          <button
            onClick={handleCreatePR}
            className="flex-1 px-3 py-2 bg-gradient-to-r from-[#6366f1] to-[#5558e0] hover:from-[#5558e0] hover:to-[#4f46e5] text-white text-sm rounded-lg transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-md hover:shadow-lg active:scale-95"
          >
            创建 PR
          </button>
        </div>
      </div>
    </div>
  );
}
