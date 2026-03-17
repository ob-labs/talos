/**
 * Task Remove Command
 *
 * Delete task and its resources (worktree, branch, etc.)
 */

import { createInterface } from "readline";
import { TalosClient } from "@/client/TalosClient";
import { GitRepository, GitWorktree, GitBranch, scanWorkspaceWorktrees } from "@talos/git";
import { WorkspaceRepository } from "@talos/core";
import { normalize, basename } from "path";

export interface TaskRemoveOptions {
  force?: boolean;
}

/**
 * ANSI color codes
 */
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

/**
 * Prompt for user confirmation
 */
async function promptConfirmation(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Log a step with optional status
 */
function logStep(step: string, status: 'success' | 'warning' | 'error' | 'info' = 'info'): void {
  const icons = {
    success: '✓',
    warning: '⚠️',
    error: '✗',
    info: '→',
  };
  const colors_map = {
    success: colors.green,
    warning: colors.yellow,
    error: colors.red,
    info: colors.reset,
  };
  const color = colors_map[status];
  console.log(`${color}${icons[status]} ${step}${colors.reset}`);
}

/**
 * Validate before deletion
 */
async function validateBeforeRemoval(
  taskId: string,
  workingDir: string,
  repoRoot: string,
  branch: string | undefined,
  force: boolean
): Promise<{
  canProceed: boolean;
  hasWorktree: boolean;
  isMainWorktree: boolean;
  reason?: string;
}> {
  const result = {
    canProceed: true,
    hasWorktree: false,
    isMainWorktree: false,
    reason: undefined as string | undefined,
  };

  const gitRepo = new GitRepository(repoRoot);

  // 1. Check if worktree exists and whether it's the main worktree
  const worktrees = await scanWorkspaceWorktrees(repoRoot);
  if (worktrees.success && worktrees.data) {
    const normalizedWorkingDir = normalize(workingDir);
    const taskWorktree = worktrees.data.find(wt =>
      normalize(wt.path) === normalizedWorkingDir
    );

    if (taskWorktree) {
      result.hasWorktree = true;
      result.isMainWorktree = taskWorktree.isDefault || taskWorktree.path === repoRoot;

      // Cannot delete main worktree
      if (result.isMainWorktree) {
        result.canProceed = false;
        result.reason = "Error: Cannot delete main worktree\nMain worktree is the repository root directory, deleting it will corrupt the repository\nThis operation is not allowed under any circumstances";
        return result;
      }
    }
  }

  // 2. Check current branch (if worktree exists)
  if (result.hasWorktree && branch) {
    const currentBranchResult = await gitRepo.getCurrentBranch();
    if (currentBranchResult.success && currentBranchResult.data === branch && !force) {
      result.canProceed = false;
      result.reason = "Error: Currently on task branch, cannot delete\nPlease switch to another branch first\nUse --force parameter to force deletion";
      return result;
    }
  }

  return result;
}

/**
 * Cleanup Git resources (worktree and branch)
 */
async function cleanupGitResources(
  workingDir: string,
  repoRoot: string,
  branch: string | undefined,
  force: boolean
): Promise<void> {
  const gitWorktree = new GitWorktree(repoRoot);
  const gitBranch = new GitBranch(repoRoot);
  const gitRepo = new GitRepository(repoRoot);

  // 1. Delete worktree
  if (workingDir !== repoRoot) {
    const workingDirPath = normalize(workingDir);
    const worktreeName = basename(workingDir);

    // Check if worktree exists
    const worktrees = await scanWorkspaceWorktrees(repoRoot);
    let worktreeExists = false;

    if (worktrees.success && worktrees.data) {
      const existingWorktree = worktrees.data.find(wt =>
        normalize(wt.path) === workingDirPath
      );
      worktreeExists = !!existingWorktree;
    }

    if (worktreeExists) {
      // Try to remove worktree
      const removeResult = await gitWorktree.remove(workingDir, force);
      if (removeResult.success) {
        logStep(`Deleted worktree (${worktreeName})`, 'success');
      } else {
        logStep(`Failed to delete worktree (${worktreeName}): ${removeResult.error}`, 'error');
        throw new Error(`Worktree deletion failed: ${removeResult.error}`);
      }
    }
  }

  // 2. Branch deletion
  if (branch) {
    const mainBranches = ['main', 'master', 'develop', 'dev'];

    if (mainBranches.includes(branch)) {
      // Skip main branch deletion
      logStep(`Skipped main branch deletion (${branch})`, 'warning');
    } else {
      // Check if branch exists
      const branchExistsResult = await gitBranch.exists(branch);

      if (branchExistsResult.success && branchExistsResult.data) {
        if (force) {
          // With --force: delete branch unconditionally
          const deleteResult = await gitBranch.delete(branch, true);
          if (deleteResult.success) {
            logStep(`Deleted branch (${branch})`, 'success');
          } else {
            logStep(`Failed to delete branch (${branch}): ${deleteResult.error}`, 'warning');
          }
        } else {
          // Without --force: skip branch deletion
          logStep(`Skipped branch deletion (not using --force)`, 'warning');
        }
      } else {
        logStep(`Skipped branch deletion (branch does not exist)`, 'warning');
      }
    }
  }
}

/**
 * Remove task command
 */
export async function removeTaskCommand(
  taskId: string,
  options: TaskRemoveOptions = {}
): Promise<void> {
  const cwd = process.cwd();
  const force = options.force || false;

  // Get repoRoot using workspace config
  const gitRepo = new GitRepository(cwd);
  const repoNameResult = await gitRepo.getRepoName();

  let repoRoot: string;
  if (!repoNameResult.success || !repoNameResult.data) {
    const rootResult = await gitRepo.getRootPath();
    if (!rootResult.success || !rootResult.data) {
      console.error(`${colors.red}✗${colors.reset} Error: Cannot get repository root directory`);
      process.exit(1);
    }
    repoRoot = rootResult.data;
  } else {
    const workspaceRepo = new WorkspaceRepository();
    const workspace = await workspaceRepo.findByName(repoNameResult.data);
    if (!workspace) {
      console.error(`${colors.red}✗${colors.reset} Error: Workspace configuration not found`);
      process.exit(1);
    }
    repoRoot = workspace.path;
  }

  const client = new TalosClient();

  try {
    await client.connect();
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Cannot connect to Talos daemon`);
    console.error(`Please run first: talos start`);
    process.exit(1);
  }

  try {
    // 1. Get task info
    const tasks = await client.listTasks();
    const task = tasks.find(t => t.id === taskId || t.processId === taskId);

    if (!task) {
      console.error(`${colors.red}✗${colors.reset} Error: Task not found: ${taskId}`);
      process.exit(1);
    }

    // 2. Check task status
    if (task.status === 'running' && !force) {
      console.error(`${colors.red}✗${colors.reset} Error: Cannot delete running task\n`);
      console.error(`Current task status is running\n`);
      console.error(`Solutions:`);
      console.error(`  1. Stop task: talos task stop ${taskId}`);
      console.error(`  2. Force deletion: talos task remove ${taskId} --force`);
      process.exit(1);
    }

    // 3. Confirmation prompt
    if (!force) {
      const statusText = task.status ? ` (status: ${task.status})` : '';
      const confirmed = await promptConfirmation(`Confirm delete task ${taskId}${statusText}?`);
      if (!confirmed) {
        console.log("Cancelled");
        await client.disconnect();
        return;
      }
    }

    // 4. Stop task if running (when using --force)
    // Only attempt to stop if task has a PID (process is actually alive)
    if (task.status === 'running' && force && task.pid) {
      logStep(`Stopping task process (taskId: ${taskId})`);
      try {
        await client.stopTask({ taskId });
        logStep('Task process stopped', 'success');
      } catch (error) {
        logStep(`Failed to stop task: ${error instanceof Error ? error.message : String(error)}`, 'warning');
      }
    } else if (task.status === 'running' && force && !task.pid) {
      // Task shows as running but has no PID - already dead, skip stop
      logStep('Task already stopped (no PID)', 'info');
    }

    // 5. Get task details for cleanup (use worktree.path instead of workingDir)
    const workingDir = task.worktree?.path || repoRoot;
    const branch = task.branch;

    // 6. Pre-deletion validation
    const validationResult = await validateBeforeRemoval(taskId, workingDir, repoRoot, branch, force);

    if (!validationResult.canProceed) {
      console.error(`${colors.red}✗${colors.reset} ${validationResult.reason}`);
      process.exit(1);
    }

    // 7. Git resource cleanup
    await cleanupGitResources(workingDir, repoRoot, branch, force);

    // 8. Delete task via daemon
    logStep(`Deleting task configuration (${taskId})`);
    await client.removeTask(taskId);
    logStep('Task configuration deleted', 'success');

    // 9. Output final result
    console.log(``);
    console.log(`${colors.green}✓${colors.reset} Task (${taskId}) deleted successfully`);
    console.log(``);

  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Remove failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error(``);
    console.error(`Possible reasons:`);
    console.error(`  • Task does not exist`);
    console.error(`  • Task is running (stop first or use --force)`);
    console.error(``);
    console.error(`Solutions:`);
    console.error(`  • Run 'talos task stop ${taskId}' to stop task`);
    console.error(`  • Use --force to force removal`);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}
