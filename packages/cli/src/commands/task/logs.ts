/**
 * Task Logs Command
 *
 * View task log file with optional follow mode
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import { GitRepository } from "@talos/git";
import { WorkspaceRepository } from "@talos/core";

export interface TaskLogsOptions {
  follow?: boolean;
  lines?: string;
}

/**
 * View task logs
 *
 * @param taskId - Task ID
 * @param options - Command options
 */
export async function logsTaskCommand(
  taskId: string,
  options: TaskLogsOptions = {}
): Promise<void> {
  // 1. Detect current workspace
  const git = new GitRepository();
  const rootResult = await git.getRootPath();

  if (!rootResult.success || !rootResult.data) {
    console.error("Error: Current directory is not in a Git repository");
    process.exit(1);
  }

  const currentPath = rootResult.data;
  const workspaceRepo = new WorkspaceRepository();

  let workspace = await workspaceRepo.findByPath(currentPath);
  if (!workspace) {
    workspace = await workspaceRepo.findByPathContains(currentPath);
  }

  if (!workspace) {
    console.error(`Error: Current directory is not in any configured workspace`);
    process.exit(1);
  }

  const repoRoot = workspace.path;
  const logPath = path.join(repoRoot, ".talos", "logs", `${taskId}.log`);

  // 2. Check if log file exists
  try {
    await fs.access(logPath);
  } catch {
    console.log("Log file not found");
    console.log(`Task ID: ${taskId}`);
    console.log(`Log path: ${logPath}`);
    console.log("\nTask may not have been started yet, or logs may have been cleared.");
    return;
  }

  // 3. Use tail to show logs
  const tailLines = parseInt(options.lines || "50", 10);
  const args = ["-n", tailLines.toString()];
  if (options.follow) {
    args.push("-f");
  }
  args.push(logPath);

  const tail = spawn("tail", args, { stdio: "inherit" });

  tail.on("error", (error) => {
    console.error("Failed to show logs:", error.message);
    console.log(`Log path: ${logPath}`);
    process.exit(1);
  });

  // 4. Handle Ctrl+C
  process.on("SIGINT", () => {
    tail.kill();
    process.exit(0);
  });
}
