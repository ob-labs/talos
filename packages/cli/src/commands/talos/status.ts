#!/usr/bin/env node
/**
 * talos status command
 * Check Talos status
 */

import path from "path";
import fs from "fs/promises";
import os from "os";
import { ProcessManager, WorkspaceRepository } from "@talos/core";

// Talos directory name
const TALOS_DIR = ".talos";

/**
 * Talos PID file path
 */
const TALOS_PID_PATH = path.join(os.homedir(), TALOS_DIR, "talos.pid");

/**
 * Talos socket path
 */
const TALOS_SOCKET_PATH = path.join(os.homedir(), TALOS_DIR, "talos.sock");

/**
 * Talos status command
 */
export async function statusTalosCommand(): Promise<void> {
  try {
    const processManager = new ProcessManager();

    // Read Talos PID
    const pid = await processManager.readPid(TALOS_PID_PATH);

    if (pid === null) {
      console.log("Talos is not running");
      console.log("\nStart Talos with: talos start");
      return;
    }

    // Check if process is running
    const isRunning = processManager.isAliveSync(pid);

    console.log(`Talos PID: ${pid}`);
    console.log(`Status: ${isRunning ? "Running ✓" : "Not running ✗"}`);

    if (isRunning) {
      console.log(`Log file: ${path.join(os.homedir(), TALOS_DIR, "talos.log")}`);
      console.log(`Socket: ${TALOS_SOCKET_PATH}`);

      // Try to connect to socket
      try {
        await fs.access(TALOS_SOCKET_PATH);
        console.log("Socket: Connected ✓");
      } catch {
        console.log("Socket: Not connected ✗");
      }

      // Show managed tasks from all workspaces
      try {
        const repo = new WorkspaceRepository();
        const workspaces = await repo.findAll();
        const allTasks = [];

        for (const workspace of workspaces) {
          try {
            const configPath = path.join(workspace.path, ".talos", "config.json");
            const content = await fs.readFile(configPath, "utf-8");
            const config = JSON.parse(content);

            if (config.tasks && Array.isArray(config.tasks)) {
              for (const task of config.tasks) {
                allTasks.push({
                  ...task,
                  workspaceName: workspace.name || workspace.path,
                });
              }
            }
          } catch {
            // Skip workspaces with invalid config
          }
        }

        if (allTasks.length > 0) {
          console.log(`\nManaged tasks (${allTasks.length}):`);

          for (const task of allTasks) {
            console.log(`  - ${task.id}: ${task.status}`);
            if (task.metadata?.prdId) {
              console.log(`    PRD: ${task.metadata.prdId}`);
            }
            console.log(`    Workspace: ${task.workspaceName}`);
          }
        } else {
          console.log("\nNo managed tasks");
        }
      } catch (error) {
        console.log("\nNo managed tasks");
      }
    } else {
      console.log("\nClean up stale PID file with: talos stop");
    }
  } catch (error) {
    console.error("Error checking Talos status:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
