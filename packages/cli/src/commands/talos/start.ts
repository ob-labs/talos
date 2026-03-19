#!/usr/bin/env node
/**
 * talos start command
 * Start Talos main process
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import childProcess from "child_process";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { ProcessManager } from "@talos/core";
import { LocalStorageEngine } from "@talos/core/storage";

// ESM __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Talos directory name
const TALOS_DIR = ".talos";

/**
 * Talos PID file path
 */
const TALOS_PID_PATH = path.join(os.homedir(), TALOS_DIR, "talos.pid");

/**
 * Talos log file path
 */
const TALOS_LOG_PATH = path.join(os.homedir(), TALOS_DIR, "talos.log");

/**
 * Start Talos command
 */
export async function startTalosCommand(silent: boolean = false): Promise<void> {
  try {
    const processManager = new ProcessManager();

    // Check if Talos PID file exists
    const existingPid = await processManager.readPid(TALOS_PID_PATH);

    if (existingPid !== null) {
      // Check if the process is actually running
      const isRunning = processManager.isAliveSync(existingPid);

      if (isRunning) {
        if (!silent) {
          console.log(`Talos is already running with PID: ${existingPid}`);
        }
        return;
      } else {
        // Clean up stale PID file
        if (!silent) {
          console.log("Found stale PID file, cleaning up...");
        }
        try {
          // PID file management using fs is acceptable (part of process management layer)
          await fs.unlink(TALOS_PID_PATH);
        } catch {
          // Ignore error if file doesn't exist
        }
      }
    }

    // Use LocalStorageEngine to ensure directory exists
    // (LocalStorageEngine will automatically create directory)
    const storageBasePath = path.join(os.homedir(), TALOS_DIR);
    const storage = new LocalStorageEngine(storageBasePath);
    // LocalStorageEngine will automatically create directory

    // daemon-entry.js is copied to dist/ during build
    // In bundled mode, __dirname is dist/, same as daemon-entry.js
    const talosEntryPath = path.join(__dirname, 'daemon-entry.js');

    // Redirect stdout and stderr to log file
    const logStream = await fs.open(TALOS_LOG_PATH, "a");

    // Spawn Talos process in detached mode
    const talosProcess = childProcess.spawn(
      process.execPath,
      [talosEntryPath],
      {
        detached: true,
        stdio: ["ignore", logStream.fd, logStream.fd],
        cwd: process.cwd(),
      }
    );

    // Unref to allow parent to exit
    talosProcess.unref();

    // Wait a moment to ensure Talos started successfully
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check if the Talos process is still running
    const isRunning = processManager.isAliveSync(talosProcess.pid!);

    if (!isRunning) {
      console.error("Failed to start Talos process");
      console.error(`Check log file: ${TALOS_LOG_PATH}`);
      process.exit(1);
    }

    // Write the Talos PID to file
    await processManager.writePid(TALOS_PID_PATH, talosProcess.pid!);

    if (!silent) {
      console.log(`✓ Talos started with PID: ${talosProcess.pid}`);
      console.log(`  Log file: ${TALOS_LOG_PATH}`);
      console.log(`  Socket: ${path.join(os.homedir(), TALOS_DIR, "talos.sock")}`);
    }
  } catch (error) {
    console.error("Error starting Talos:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
