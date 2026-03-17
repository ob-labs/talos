/**
 * Task Attach Command
 *
 * Enter the task's working directory (worktree) for direct interaction
 */

import { join } from "path";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { TalosClient } from "@/client/TalosClient";

export interface TaskAttachOptions {
  follow?: boolean;
}

/**
 * Get task working directory from ITask
 */
function getTaskWorkingDir(task: any): string | null {
  // Try worktree.path first (from ITask.worktree)
  if (task.worktree?.path) {
    return task.worktree.path;
  }
  // Fallback to workingDir (from TaskMetadata)
  if (task.workingDir) {
    return task.workingDir;
  }
  // Fallback to construct from workspace + worktree
  if (task.workspace && task.worktree) {
    return join(task.workspace, "worktrees", task.worktree);
  }
  // Last resort: workspace
  if (task.workspace) {
    return task.workspace;
  }
  return null;
}

export async function attachTaskCommand(
  taskId: string,
  options: TaskAttachOptions = {}
): Promise<void> {
  const client = new TalosClient();
  const cwd = process.cwd();

  try {
    await client.connect();

    const task = await client.getTaskStatus(taskId);

    const workingDir = getTaskWorkingDir(task);

    if (!workingDir) {
      console.error(`❌ Error: Cannot determine task working directory: ${taskId}`);
      process.exit(1);
    }

    if (!existsSync(workingDir)) {
      console.error(`❌ Error: Working directory does not exist: ${workingDir}`);
      process.exit(1);
    }

    const shell = process.env.SHELL || "/bin/bash";

    // Print task info
    console.log(`📋 Entering task directory: ${taskId}`);
    console.log(`📁 Working directory: ${workingDir}`);
    console.log(`📊 Task status: ${task.status}`);
    console.log(``);
    console.log(`💡 Tip: Type 'exit' or press Ctrl+D to return to original directory`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Spawn interactive shell in the task's working directory
    const child = spawn(shell, [], {
      cwd: workingDir,
      stdio: "inherit",
      env: { ...process.env, TASK_ID: taskId },
    });

    // Forward signals to child shell
    const handleInterrupt = () => {
      child.kill("SIGTERM");
    };

    process.on("SIGINT", handleInterrupt);
    process.on("SIGTERM", handleInterrupt);

    await new Promise<void>((resolve, reject) => {
      child.on("exit", (code) => {
        console.log(`\n⏸️  Returned to original directory`);
        resolve();
      });
      child.on("error", reject);
    });
  } catch (error) {
    console.error(`✗ Attach failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error(``);
    console.error(`Possible reasons:`);
    console.error(`  • Talos main process is not running`);
    console.error(`  • Task does not exist`);
    console.error(``);
    console.error(`Solutions:`);
    console.error(`  • Run 'talos start' to start Talos`);
    console.error(`  • Run 'talos task list' to check tasks`);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}
