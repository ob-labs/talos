#!/usr/bin/env node
/**
 * talos logs command
 * View Talos logs
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import os from "os";

// Talos directory name
const TALOS_DIR = ".talos";

/**
 * Talos log file path
 */
const TALOS_LOG_PATH = path.join(os.homedir(), TALOS_DIR, "talos.log");

/**
 * Talos logs command
 *
 * @param follow - Follow log output (tail -f)
 * @param lines - Number of lines to show (default: 50)
 */
export async function logsTalosCommand(follow: boolean = false, lines: number = 50): Promise<void> {
  try {
    // Check if log file exists
    try {
      await fs.access(TALOS_LOG_PATH);
    } catch {
      console.log("Log file not found");
      console.log(`Log path: ${TALOS_LOG_PATH}`);
      console.log("\nStart Talos with: talos start");
      return;
    }

    // Use tail to show logs
    const args = ["-n", lines.toString()];
    if (follow) {
      args.push("-f");
    }
    args.push(TALOS_LOG_PATH);

    const tail = spawn("tail", args, { stdio: "inherit" });

    tail.on("error", (error) => {
      console.error("Failed to show logs:", error.message);
      console.log(`Log path: ${TALOS_LOG_PATH}`);
      process.exit(1);
    });

    // Handle Ctrl+C
    process.on("SIGINT", () => {
      tail.kill();
      process.exit(0);
    });
  } catch (error) {
    console.error("Error showing logs:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
