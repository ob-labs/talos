"use client";

import { useEffect, useState, useRef } from "react";

export interface Task {
  id: string;
  pid?: number;
  status: string;
  workingDir: string;
  prdId?: string;
  progress?: number;
  currentStory?: {
    id: string;
    title: string;
  };
  stories?: Array<{
    id: string;
    title: string;
    passes: boolean;
  }>;
}

interface TaskDetailViewProps {
  taskId: string;
  onBack: () => void;
}

export function TaskDetailView({ taskId, onBack }: TaskDetailViewProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    loadTask();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [taskId]);

  const loadTask = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      if (!response.ok) {
        throw new Error("Failed to load task details");
      }
      const data = await response.json();
      setTask(data.data || null);

      // Setup SSE for real-time updates
      setupEventStream();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const setupEventStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/tasks/${taskId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "log") {
          setLogs((prev) => [...prev, data.message]);
        } else if (data.type === "status") {
          setTask((prev) => (prev ? { ...prev, status: data.status, progress: data.progress } : null));
        } else if (data.type === "story") {
          setTask((prev) =>
            prev
              ? {
                  ...prev,
                  currentStory: data.story,
                  progress: data.progress,
                }
              : null
          );
        }
      } catch (err) {
        console.error("Failed to parse SSE message:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE error:", err);
      eventSource.close();
    };
  };

  const handleStopTask = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to stop task");
      await loadTask();
    } catch (err) {
      console.error("Failed to stop task:", err);
    }
  };

  const handleResumeTask = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/resume`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to resume task");
      await loadTask();
    } catch (err) {
      console.error("Failed to resume task:", err);
    }
  };

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
        <div className="flex space-x-2">
          <button
            onClick={loadTask}
            className="px-3 py-1.5 text-xs bg-[#238636] hover:bg-[#2ea043] text-white rounded-md transition-all"
          >
            Retry
          </button>
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-xs bg-[#30363d] hover:bg-[#3c3c3c] text-white rounded-md transition-all"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="text-sm text-[#8b949e] mb-4">Task not found</div>
        <button
          onClick={onBack}
          className="px-3 py-1.5 text-xs bg-[#30363d] hover:bg-[#3c3c3c] text-white rounded-md transition-all"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-md hover:bg-[#3c3c3c] text-[#8b949e] hover:text-[#e6edf3] transition-all"
            title="Back"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-sm font-medium text-[#e6edf3]">{task.id}</h2>
            <p className="text-xs text-[#8b949e]">{task.workingDir}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(task.status)} bg-[#1e1e1e]`}>
            {getStatusIcon(task.status)} {task.status}
          </span>
          {task.status === "running" && (
            <button
              onClick={handleStopTask}
              className="px-3 py-1.5 text-xs bg-[#f85149] hover:bg-[#da3633] text-white rounded-md transition-all"
            >
              Stop
            </button>
          )}
          {task.status === "stopped" && (
            <button
              onClick={handleResumeTask}
              className="px-3 py-1.5 text-xs bg-[#238636] hover:bg-[#2ea043] text-white rounded-md transition-all"
            >
              Resume
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {task.status !== "stopped" && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#8b949e]">Task Progress</span>
            <span className="text-xs text-[#6366f1]">{task.progress || 0}%</span>
          </div>
          <div className="h-2 bg-[#30363d] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#6366f1] to-[#58a6ff] transition-all duration-300"
              style={{ width: `${task.progress || 0}%` }}
            />
          </div>
          {task.currentStory && (
            <div className="mt-2 text-xs text-[#8b949e]">
              Current: {task.currentStory.id} - {task.currentStory.title}
            </div>
          )}
        </div>
      )}

      {/* User Stories */}
      {task.stories && task.stories.length > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h3 className="text-xs font-medium text-[#e6edf3] mb-3">User Stories</h3>
          <div className="space-y-2">
            {task.stories.map((story) => (
              <div
                key={story.id}
                className={`flex items-center justify-between px-3 py-2 rounded ${
                  story.passes ? "bg-[#1e1e1e]" : "bg-[#21262d]"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className={story.passes ? "text-[#6366f1]" : "text-[#8b949e]"}>
                    {story.passes ? "✅" : "⏳"}
                  </span>
                  <span className="text-xs text-[#e6edf3]">{story.id}</span>
                  <span className="text-xs text-[#8b949e] truncate">{story.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Logs */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
        <h3 className="text-xs font-medium text-[#e6edf3] mb-3">Task Logs</h3>
        <div className="bg-[#0d1117] rounded p-3 h-[400px] overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-[#8b949e]">No logs yet</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="text-[#8b949e] mb-1">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Task Info */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
        <h3 className="text-xs font-medium text-[#e6edf3] mb-3">Task Information</h3>
        <div className="space-y-2 text-xs">
          <div className="flex">
            <span className="text-[#8b949e] w-20">Task ID:</span>
            <span className="text-[#e6edf3] font-mono">{task.id}</span>
          </div>
          <div className="flex">
            <span className="text-[#8b949e] w-20">PID:</span>
            <span className="text-[#e6edf3] font-mono">{task.pid || "-"}</span>
          </div>
          <div className="flex">
            <span className="text-[#8b949e] w-20">PRD:</span>
            <span className="text-[#e6edf3]">{task.prdId || "-"}</span>
          </div>
          <div className="flex">
            <span className="text-[#8b949e] w-20">Working Dir:</span>
            <span className="text-[#e6edf3] truncate" title={task.workingDir}>
              {task.workingDir}
            </span>
          </div>
          <div className="flex">
            <span className="text-[#8b949e] w-20">Status:</span>
            <span className={`flex items-center space-x-1 ${getStatusColor(task.status)}`}>
              <span>{getStatusIcon(task.status)}</span>
              <span>{task.status}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
