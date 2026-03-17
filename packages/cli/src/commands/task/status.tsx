/**
 * Task Status Command
 *
 * View real-time task status (with continuous monitoring mode)
 */

import { WorkspaceRepository, TaskRepository } from "@talos/core";
import { renderInk, ErrorBoundary } from "../../ui";
import { existsSync } from "fs";
import { execSync } from "child_process";
import React, { useState, useEffect, useCallback } from "react";
import { Box, Text } from "ink";
import { TaskMonitor } from "../../ui";
import type { TaskData } from "../../ui";
import type { TaskMetadata } from "@talos/core";

export interface TaskStatusOptions {
  workspace?: string;
  status?: string;
  json?: boolean;
  watch?: boolean;
  interval?: number;
  all?: boolean;
}

/**
 * Find the git repository root directory
 * In worktrees, this returns the main repository root where .talos is located
 * @returns Path to the git root directory, or null if not in a git repo
 */
function findGitRoot(): string | null {
  try {
    // First, try to get the git common directory (works for worktrees)
    const gitCommonDir = execSync("git rev-parse --git-common-dir", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    // The .talos directory should be in the parent of .git
    const potentialRoot = gitCommonDir.replace(/\.git$/, "");

    // Check if .talos exists in the potential root
    if (existsSync(`${potentialRoot}/.talos`)) {
      return potentialRoot;
    }

    // Fallback to show-toplevel (current worktree root)
    const worktreeRoot = execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    if (existsSync(`${worktreeRoot}/.talos`)) {
      return worktreeRoot;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Convert Task entity to TaskMetadata DTO
 */
function taskToTaskMetadata(task: any): TaskMetadata {
  const processId = task.processId as string | undefined;
  // Require worktree to be set - no fallback
  if (!task.worktree) {
    throw new Error(`Task ${task.id} has no worktree set`);
  }

  const workingDir = task.worktree.path;
  // Use getPrdId() method to get PRD ID
  const prdId = task.prd.id;

  return {
    id: task.id,
    command: task.command,
    status: task.status,
    tool: task.tool,
    workspace: task.workspace,
    prd: prdId,
    branch: task.branch,
    // Extract worktree name from worktree.path for storage (backward compatibility)
    worktree: extractWorktreeName(workingDir),
    workingDir,
    pid: task.pid,
    processId: task.id,
    createdAt: task.timestamp,
    startedAt: task.startedAt,
    exitCode: task.completedAt !== undefined ? 0 : undefined,
    progress: task.progress,
    metadata: {
      title: task.title,
      description: task.description,
      prdId,
      storyId: task.storyId,
      role: task.role,
      error: task.error,
      conversation: task.conversation,
    },
  };
}

/**
 * Extract worktree name from path
 */
function extractWorktreeName(worktreePath: string): string {
  const match = worktreePath.match(/\/worktrees\/([^/]+)$/);
  if (!match) {
    throw new Error(`Invalid worktree path: ${worktreePath}. Expected path ending with /worktrees/<name>`);
  }
  return match[1];
}

/**
 * TaskMonitorApp - Wrapper component for TaskMonitor with state management
 */
interface TaskMonitorAppProps {
  taskRepository?: TaskRepository;
  repoRoot: string;
  workspace?: string;
  status?: string;
  watch: boolean;
  interval: number;
  allWorkspaces?: boolean;
}

const TaskMonitorApp: React.FC<TaskMonitorAppProps> = ({
  taskRepository,
  repoRoot,
  workspace,
  status,
  watch,
  interval,
  allWorkspaces,
}) => {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Function to fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      setError(null);
      // Don't show loading state on subsequent fetches
      if (tasks.length === 0) {
        setIsLoading(true);
      }

      let taskList: TaskMetadata[];
      if (allWorkspaces) {
        // Fetch tasks from all workspaces
        taskList = await fetchTasksFromAllWorkspaces();
      } else {
        // Fetch from current workspace
        if (!taskRepository) {
          throw new Error('taskRepository is required when not in allWorkspaces mode');
        }

        const filter: any = {};
        if (status) filter.status = status;

        let tasks = await taskRepository.findAll(filter);

        // If workspace filter is provided, filter in results
        if (workspace) {
          tasks = tasks.filter(t => t.workspace === workspace);
        }

        // Convert to TaskMetadata format
        taskList = tasks.map(t => taskToTaskMetadata(t));
      }

      // Transform tasks to TaskData format with progress information
      const taskData: TaskData[] = await Promise.all(
        taskList.map(async (task) => {
          // Get task progress using TaskManager
          // If task already has progress metadata, use it; otherwise fetch from PRD
          const progress = task.progress; // TODO: Fetch task progress via TalosClient

          return {
            status: task.status,
            id: task.id,
            workspace: task.workspace,
            tool: task.tool || 'claude',
            progress,
            createdAt: task.createdAt,
          };
        })
      );

      setTasks(taskData);
      // Only update lastUpdate if the time has changed (compare by second)
      const now = new Date();
      setLastUpdate(prev => {
        if (prev.getSeconds() === now.getSeconds() &&
            prev.getMinutes() === now.getMinutes() &&
            prev.getHours() === now.getHours()) {
          return prev;
        }
        return now;
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('Error fetching tasks:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [taskRepository, repoRoot, workspace, status, allWorkspaces]);


  // Initial fetch - runs once on mount
  useEffect(() => {
    fetchTasks();
  }, []); // Empty deps - only run on mount

  // Setup auto-refresh interval
  useEffect(() => {
    if (!watch) return;

    const timer = setInterval(() => {
      fetchTasks();
    }, interval);

    return () => clearInterval(timer);
  }, [watch, interval, fetchTasks]);

  // Show error state if error occurred
  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="red">
          ❌ Error loading tasks
        </Text>
        <Text color="gray">
          {error}
        </Text>
        <Text color="gray" dimColor>
          Check the logs for details
        </Text>
      </Box>
    );
  }

  // Show loading state if still loading
  if (isLoading && tasks.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="gray">Loading tasks...</Text>
      </Box>
    );
  }

  return (
    <ErrorBoundary>
      <TaskMonitor key="task-monitor"
        tasks={tasks}
        watch={watch}
        lastUpdate={lastUpdate}
        repoRoot={repoRoot}
      />
    </ErrorBoundary>
  );
};

/**
 * Fetch tasks from all workspaces
 */
async function fetchTasksFromAllWorkspaces(): Promise<TaskMetadata[]> {
  try {
    const repo = new WorkspaceRepository();
    const workspaces = await repo.findAll();
    const allTasks: TaskMetadata[] = [];

    for (const workspace of workspaces) {
      const taskRepository = new TaskRepository(workspace.path);
      const tasks = await taskRepository.findAll();
      allTasks.push(...tasks.map(t => taskToTaskMetadata(t)));
    }

    return allTasks;
  } catch (error) {
    console.error('Error fetching tasks from all workspaces:', error);
    return [];
  }
}

export async function taskStatusCommand(options: TaskStatusOptions = {}): Promise<void> {
  // Get parameters from options, note the watch default value handling
  const watch = options.watch !== undefined ? options.watch : true;
  const interval = (options.interval ?? 2) * 1000; // Convert to milliseconds

  // If json mode, disable watch and output directly
  if (options.json) {
    // TODO: JSON mode is temporarily disabled due to architecture refactoring
    // The old implementation used TaskManager directly, which is not accessible from CLI
    // This should be reimplemented using TalosClient API
    console.error("JSON mode is temporarily disabled. Please use the default output mode.");
    process.exit(1);
  }

  let taskRepository: TaskRepository | undefined;
  let cwdPath: string;

  if (options.all) {
    // In --all mode, find a workspace with .talos for log reading
    const repo = new WorkspaceRepository();
    const workspaces = await repo.findAll();

    // Find the first workspace that has .talos directory
    const talosWorkspace = workspaces.find(ws => existsSync(`${ws.path}/.talos`));

    if (!talosWorkspace) {
      console.error(`Error: No workspace with .talos found`);
      console.error(`Please add a workspace with .talos first`);
      process.exit(1);
    }

    cwdPath = talosWorkspace.path;
  } else {
    // In normal mode, check current directory
    const gitRoot = findGitRoot();

    if (!gitRoot || !existsSync(`${gitRoot}/.talos`)) {
      console.error(`Error: .talos directory not found`);
      console.error(`Please switch to a talos project directory, or use --all to view all tasks`);
      process.exit(1);
    }

    cwdPath = gitRoot;
    taskRepository = new TaskRepository(cwdPath);
  }

  // Setup Ctrl+C handler
  const handleExit = () => {
    console.log("\n⏸️  Monitoring stopped\n");
    process.exit(0);
  };

  process.on("SIGINT", handleExit);
  process.on("SIGTERM", handleExit);

  // Render the ink component
  const renderer = renderInk(
    <TaskMonitorApp
      taskRepository={taskRepository}
      repoRoot={cwdPath}
      workspace={options.workspace}
      status={options.status}
      watch={watch}
      interval={interval}
      allWorkspaces={options.all}
    />
  );

  // If not in watch mode, render once and exit
  if (!watch) {
    // Wait a bit for the component to render, then unmount and exit
    await new Promise(resolve => setTimeout(resolve, 100));
    renderer.unmount();
    return;
  }

  // Wait for the app to exit (watch mode)
  await renderer.waitUntilExit();
}
