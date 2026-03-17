/**
 * Task List Command
 *
 * List all tasks using TalosClient
 */

import path from "path";
import { TalosClient } from "@/client/TalosClient";
import { GitRepository } from "@talos/git";
import { WorkspaceRepository } from "@talos/core";

export interface TaskListOptions {
  json?: boolean;
  all?: boolean;
}

/**
 * Get workspace name from path
 */
function workspaceNameFromPath(repoPath: string): string {
  return path.basename(repoPath);
}

export async function listTaskCommand(options: TaskListOptions = {}): Promise<void> {
  let repoRoot: string | undefined;
  let workspaceName: string | undefined;

  if (!options.all) {
    // Normal mode: auto-detect current workspace from current directory
    const git = new GitRepository();
    const rootResult = await git.getRootPath();

    if (!rootResult.success || !rootResult.data) {
      console.error("Error: Current directory is not in a Git repository");
      console.error("");
      console.error("Please ensure you are in a Talos project directory");
      console.error("Or use --all to view tasks from all workspaces");
      console.error("");
      console.error("Examples:");
      console.error("  talos task list        # Run inside a project directory");
      console.error("  talos task list --all  # View all tasks");
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
      console.error(`Error: Current directory (${currentPath}) is not in any configured workspace`);
      console.error("");
      console.error("Please add the workspace first:");
      console.error(`  talos workspace add ${currentPath}`);
      console.error("");
      console.error("Or use --all to view tasks from all workspaces");
      process.exit(1);
    }

    repoRoot = workspace.path;
    workspaceName = workspace.name;
  }

  const client = new TalosClient();

  try {
    await client.connect();

    const tasks = await client.listTasks();

    // Filter tasks by workspace if not --all
    const filteredTasks = repoRoot
      ? tasks.filter((task) => {
          // Match by workspace name or by repoRoot or worktree path
          return task.workspace === workspaceName ||
                 task.repoRoot === repoRoot ||
                 (task.worktree?.path && task.worktree.path.startsWith(repoRoot));
        })
      : tasks;

    if (options.json) {
      console.log(JSON.stringify(filteredTasks, null, 2));
      return;
    }

    if (filteredTasks.length === 0) {
      if (repoRoot) {
        console.log(`No tasks found in current workspace (${workspaceName})`);
      } else {
        console.log("No tasks found");
      }
      return;
    }

    console.log("\nTask List\n");
    console.log(
      "TASK ID".padEnd(30) +
      "STATUS".padEnd(12) +
      "PRD".padEnd(20) +
      "CREATED"
    );
    console.log("-".repeat(90));

    for (const task of filteredTasks) {
      const taskId = task.id.padEnd(30);
      const status = task.status.padEnd(12);
      const prd = task.prd.id.padEnd(20);
      const created = new Date(task.timestamp).toLocaleString();

      console.log(taskId + status + prd + created);
    }

    const scope = repoRoot ? `workspace (${workspaceName}) / ` : "";
    console.log(`\nTotal: ${filteredTasks.length} task(s) (${scope}all workspaces)\n`);
  } catch (error) {
    console.error(`✗ Failed to list tasks: ${error instanceof Error ? error.message : String(error)}`);
    console.error(``);
    console.error(`Please ensure Talos main process is running`);
    console.error(`Run 'talos start' to start Talos`);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}
