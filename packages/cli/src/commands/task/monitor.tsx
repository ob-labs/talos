import React from 'react';
import path from 'path';
import { TalosClient } from '@/client/TalosClient';
import { renderInk } from '@/ui/render';
import { TaskMonitor } from '@/ui/task-monitor';
import type { TaskData } from '@/ui/task-list-table';
import { GitRepository } from '@talos/git';
import { WorkspaceRepository } from '@talos/core';
import { PRDManager } from '@talos/core';

/**
 * Monitor command options
 */
export interface TaskMonitorOptions {
  workspace?: string;
  once?: boolean;
  all?: boolean;
}

/**
 * Derive repoRoot from worktree path
 * @param worktreePath - Worktree path (e.g., /path/to/repo/worktrees/branch-name)
 * @returns Derived repoRoot
 */
function deriveRepoRootFromWorktree(worktreePath?: string): string {
  if (!worktreePath) return '';
  // worktree path format: /path/to/repo/worktrees/branch-name
  const match = worktreePath.match(/^(.*)\/worktrees\/[^/]+$/);
  return match ? match[1] : worktreePath;
}

/**
 * Calculate task progress from PRD file
 * @param prdId - PRD identifier
 * @param worktreeDir - Worktree directory (where task executes)
 * @param fallbackRoot - Main repo root (fallback if worktree PRD doesn't exist)
 * @returns Progress object or null
 */
async function getTaskProgress(prdId: string, worktreeDir: string, fallbackRoot?: string): Promise<{ total: number; passing: number; incomplete: number } | null> {
  try {
    // First try worktree directory (where task executes, PRD gets updated)
    let prdManager = new PRDManager(worktreeDir, prdId);
    let prd = await prdManager.getPRD();

    // Fallback to main repo root if worktree PRD doesn't exist
    if (!prd && fallbackRoot) {
      prdManager = new PRDManager(fallbackRoot, prdId);
      prd = await prdManager.getPRD();
    }

    if (!prd) {
      return null;
    }
    const total = prd.userStories.length;
    const passing = prd.userStories.filter(s => s.passes).length;
    return { total, passing, incomplete: total - passing };
  } catch {
    return null;
  }
}

/**
 * Filter tasks by repoRoot/workspace
 */
function filterTasksByWorkspace(tasks: any[], repoRoot: string, workspaceName: string): any[] {
  return tasks.filter((task) => {
    // Match by workspace name or by repoRoot or worktree path
    return task.workspace === workspaceName ||
           task.repoRoot === repoRoot ||
           (task.worktree?.path && task.worktree.path.startsWith(repoRoot));
  });
}

const mapTasksToData = async (tasks: any[], repoRoot?: string): Promise<TaskData[]> => {
  const result: TaskData[] = [];
  for (const task of tasks) {
    const prdId = task.prd.id;
    // Get task's repoRoot (priority: task.repoRoot, then derive from worktree)
    const taskRepoRoot = task.repoRoot || deriveRepoRootFromWorktree(task.worktree?.path);
    const taskWorktree = task.worktree?.path || `${taskRepoRoot}/worktrees/${task.id}`;
    const progress = await getTaskProgress(prdId, taskWorktree, taskRepoRoot);
    result.push({
      id: task.id,
      status: task.status,
      workspace: task.workspace,
      tool: task.tool,
      progress,
      createdAt: task.timestamp,  // ITask uses 'timestamp' not 'createdAt'
      repoRoot: taskRepoRoot,  // Each task carries its own repoRoot
    });
  }
  return result;
};

const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds

export async function monitorTaskCommand(options: TaskMonitorOptions = {}): Promise<void> {
  let repoRoot: string | undefined;
  let workspaceName: string | undefined;

  if (!options.all) {
    // Normal mode: auto-detect current workspace from current directory
    const git = new GitRepository();
    const rootResult = await git.getRootPath();

    if (!rootResult.success || !rootResult.data) {
      console.error('错误：当前目录不在 Git 仓库中 / Error: Current directory is not in a Git repository');
      console.error('');
      console.error('请确保在 Talos 项目目录下运行此命令 / Please ensure you are in a Talos project directory');
      console.error('或者使用 --all 参数查看所有 workspace 的任务 / Or use --all to view tasks from all workspaces');
      console.error('');
      console.error('示例 / Examples:');
      console.error('  talos task monitor        # 在项目目录下运行 / Run inside a project directory');
      console.error('  talos task monitor --all  # 查看所有任务 / View all tasks');
      process.exit(1);
    }

    const currentPath = rootResult.data;
    const workspaceRepo = new WorkspaceRepository();

    // First try to find by exact path match, then by containsPath (for worktrees)
    let workspace = await workspaceRepo.findByPath(currentPath);
    if (!workspace) {
      workspace = await workspaceRepo.findByPathContains(currentPath);
    }

    if (!workspace) {
      console.error(`错误：当前目录 (${currentPath}) 不在任何已配置的 workspace 中`);
      console.error('Error: Current directory is not in any configured workspace');
      console.error('');
      console.error('请先添加 workspace / Please add the workspace first:');
      console.error(`  talos workspace add ${currentPath}`);
      console.error('');
      console.error('或者使用 --all 参数查看所有 workspace 的任务 / Or use --all to view tasks from all workspaces');
      process.exit(1);
    }

    repoRoot = workspace.path;
    workspaceName = workspace.name;
  }
  // --all mode: repoRoot remains undefined, each task uses its own repoRoot

  const client = new TalosClient();

  try {
    await client.connect();
  } catch (error) {
    console.error(`错误：无法连接到 Talos 守护进程 / Error: Cannot connect to Talos daemon: ${error instanceof Error ? error.message : String(error)}`);
    console.error('请确保 Talos 正在运行 (talos start) / Please ensure Talos is running (talos start)');
    process.exit(1);
  }

  const allTasks = await client.listTasks();

  // Filter tasks by workspace if not --all
  const tasks = repoRoot && workspaceName
    ? filterTasksByWorkspace(allTasks, repoRoot, workspaceName)
    : allTasks;

  const taskData = await mapTasksToData(tasks, repoRoot);

  if (options.once) {
    const { waitUntilExit, unmount } = renderInk(
      <TaskMonitor tasks={taskData} watch={false} repoRoot={repoRoot} />
    );
    // Wait a bit for the component to render, then unmount and exit
    await new Promise(resolve => setTimeout(resolve, 100));
    await client.disconnect();
    unmount();
    return;
  }

  const { rerender, unmount, waitUntilExit } = renderInk(
    <TaskMonitor tasks={taskData} watch={true} lastUpdate={new Date()} repoRoot={repoRoot} />
  );

  // Use polling instead of subscription (SocketServer doesn't support subscriptions)
  const pollInterval = setInterval(async () => {
    try {
      const updatedTasks = await client.listTasks();
      // Filter tasks by workspace if not --all
      const filteredTasks = repoRoot && workspaceName
        ? filterTasksByWorkspace(updatedTasks, repoRoot, workspaceName)
        : updatedTasks;
      const updatedTaskData = await mapTasksToData(filteredTasks, repoRoot);
      rerender(
        <TaskMonitor tasks={updatedTaskData} watch={true} lastUpdate={new Date()} repoRoot={repoRoot} />
      );
    } catch (error) {
      // Ignore polling errors, continue trying
    }
  }, POLL_INTERVAL_MS);

  // Setup Ctrl+C handler
  const handleExit = () => {
    clearInterval(pollInterval);
    void client.disconnect();
    unmount();
    process.exit(0);
  };

  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);

  // Wait for the app to exit (watch mode)
  await waitUntilExit();
}
