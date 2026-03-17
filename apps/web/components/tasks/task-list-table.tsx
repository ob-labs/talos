"use client";

import { useEffect, useState } from "react";

export interface Task {
  id: string;
  pid?: number;
  status: string;
  workingDir: string;
  prdId?: string;
  createdAt?: string;
}

interface TaskListTableProps {
  onTaskClick: (taskId: string) => void;
  refreshTrigger?: number;
}

export function TaskListTable({ onTaskClick, refreshTrigger = 0 }: TaskListTableProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "running" | "stopped" | "completed">("all");
  const [sortBy, setSortBy] = useState<"id" | "status" | "createdAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/tasks");
      if (!response.ok) {
        throw new Error("Failed to load tasks");
      }
      const data = await response.json();
      setTasks(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [refreshTrigger]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return "🔄";
      case "stopped":
        return "⏸️";
      case "completed":
        return "✅";
      case "failed":
        return "❌";
      default:
        return "⏳";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-[#3fb950]";
      case "stopped":
        return "text-[#8b949e]";
      case "completed":
        return "text-[#6366f1]";
      case "failed":
        return "text-[#f85149]";
      default:
        return "text-[#d29922]";
    }
  };

  const handleStopTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to stop task");
      await loadTasks();
    } catch (err) {
      console.error("Failed to stop task:", err);
    }
  };

  const handleRemoveTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      const response = await fetch(`/api/tasks/${taskId}/remove`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to remove task");
      await loadTasks();
    } catch (err) {
      console.error("Failed to remove task:", err);
    }
  };

  const handleResumeTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/resume`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to resume task");
      await loadTasks();
    } catch (err) {
      console.error("Failed to resume task:", err);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filter === "all") return true;
    return task.status === filter;
  });

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let comparison = 0;
    if (sortBy === "id") {
      comparison = a.id.localeCompare(b.id);
    } else if (sortBy === "status") {
      comparison = a.status.localeCompare(b.status);
    } else if (sortBy === "createdAt") {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      comparison = aTime - bTime;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-[#8b949e]">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="text-sm text-[#f85149] mb-4">{error}</div>
        <button
          onClick={loadTasks}
          className="px-3 py-1.5 text-xs bg-[#238636] hover:bg-[#2ea043] text-white rounded-md transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter and Sort Controls */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-[#8b949e]">Filter:</span>
          <button
            onClick={() => setFilter("all")}
            className={`px-2 py-1 text-xs rounded ${
              filter === "all"
                ? "bg-[#238636] text-white"
                : "bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]"
            } transition-all`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("running")}
            className={`px-2 py-1 text-xs rounded ${
              filter === "running"
                ? "bg-[#238636] text-white"
                : "bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]"
            } transition-all`}
          >
            Running
          </button>
          <button
            onClick={() => setFilter("stopped")}
            className={`px-2 py-1 text-xs rounded ${
              filter === "stopped"
                ? "bg-[#238636] text-white"
                : "bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]"
            } transition-all`}
          >
            Stopped
          </button>
          <button
            onClick={() => setFilter("completed")}
            className={`px-2 py-1 text-xs rounded ${
              filter === "completed"
                ? "bg-[#238636] text-white"
                : "bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]"
            } transition-all`}
          >
            Completed
          </button>
        </div>
        <button
          onClick={loadTasks}
          className="px-2 py-1 text-xs bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] rounded transition-all"
        >
          Refresh
        </button>
      </div>

      {/* Task Table */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#30363d]">
              <th
                onClick={() => {
                  if (sortBy === "id") setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  else setSortBy("id");
                }}
                className="px-4 py-2 text-left text-xs font-medium text-[#8b949e] cursor-pointer hover:text-[#e6edf3]"
              >
                ID {sortBy === "id" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => {
                  if (sortBy === "status") setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  else setSortBy("status");
                }}
                className="px-4 py-2 text-left text-xs font-medium text-[#8b949e] cursor-pointer hover:text-[#e6edf3]"
              >
                Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[#8b949e]">PRD</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[#8b949e]">Working Dir</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[#8b949e]">PID</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[#8b949e]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedTasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8b949e]">
                  {filter === "all" ? "No tasks" : `No ${filter} tasks`}
                </td>
              </tr>
            ) : (
              sortedTasks.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => onTaskClick(task.id)}
                  className="border-b border-[#30363d] hover:bg-[#21262d] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2 text-xs text-[#e6edf3] font-mono">{task.id}</td>
                  <td className="px-4 py-2 text-xs">
                    <span className={`flex items-center space-x-1 ${getStatusColor(task.status)}`}>
                      <span>{getStatusIcon(task.status)}</span>
                      <span>{task.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-[#8b949e]">{task.prdId || "-"}</td>
                  <td className="px-4 py-2 text-xs text-[#8b949e] truncate max-w-[200px]" title={task.workingDir}>
                    {task.workingDir.split("/").pop() || task.workingDir}
                  </td>
                  <td className="px-4 py-2 text-xs text-[#8b949e]">{task.pid || "-"}</td>
                  <td className="px-4 py-2 text-xs">
                    <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                      {task.status === "running" && (
                        <button
                          onClick={() => handleStopTask(task.id)}
                          className="px-2 py-1 bg-[#f85149] hover:bg-[#da3633] text-white rounded transition-all"
                          title="Stop"
                        >
                          Stop
                        </button>
                      )}
                      {task.status === "stopped" && (
                        <button
                          onClick={() => handleResumeTask(task.id)}
                          className="px-2 py-1 bg-[#238636] hover:bg-[#2ea043] text-white rounded transition-all"
                          title="Resume"
                        >
                          Resume
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveTask(task.id)}
                        className="px-2 py-1 bg-[#30363d] hover:bg-[#3c3c3c] text-white rounded transition-all"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Task Count */}
      <div className="px-2 text-xs text-[#8b949e]">
        Total: {sortedTasks.length} task(s)
      </div>
    </div>
  );
}
