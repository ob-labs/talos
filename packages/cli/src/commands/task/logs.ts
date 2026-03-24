/**
 * Task Logs Command
 *
 * View task log file with optional follow mode.
 * Searches across all workspaces to find the task log.
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import { WorkspaceRepository } from "@talos/core";

export interface TaskLogsOptions {
  follow?: boolean;
  lines?: string;
}

/**
 * Find task log file across all workspaces
 *
 * @param taskId - Task ID to find
 * @returns Log file path or null if not found
 */
async function findTaskLogFile(taskId: string): Promise<string | null> {
  const workspaceRepo = new WorkspaceRepository();
  const workspaces = await workspaceRepo.findAll();

  for (const workspace of workspaces) {
    const logPath = path.join(workspace.path, ".talos", "logs", `${taskId}.log`);
    try {
      await fs.access(logPath);
      return logPath;
    } catch {
      // Log file doesn't exist in this workspace, try next
      continue;
    }
  }

  return null;
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
  // 1. Find log file across all workspaces
  const logPath = await findTaskLogFile(taskId);

  if (!logPath) {
    console.log("Log file not found");
    console.log(`Task ID: ${taskId}`);
    console.log("\nTask may not have been started yet, or logs may have been cleared.");
    console.log("Use 'talos task list --all' to see all tasks.");
    return;
  }

  // 2. Use tail to show logs
  const tailLines = parseInt(options.lines || "50", 10);
  const args = ["-n", tailLines.toString()];
  if (options.follow) {
    args.push("-f");
  }
  args.push(logPath);

  const tail = spawn("tail", args, { stdio: "inherit" });

  tail.on("error", (error) => {
    console.error("Failed to show logs:", error.message);
    process.exit(1);
  });

  // 3. Handle Ctrl+C
  process.on("SIGINT", () => {
    tail.kill();
    process.exit(0);
  });
}
