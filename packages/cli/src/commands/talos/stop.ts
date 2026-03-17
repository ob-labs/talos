#!/usr/bin/env node
/**
 * talos stop command
 * Stop Talos main process
 */

import path from "path";
import fs from "fs/promises";
import os from "os";
import { ProcessManager, SocketClient } from "@talos/core";

// Talos directory name
const TALOS_DIR = ".talos";

/**
 * Talos PID file path
 */
const TALOS_PID_PATH = path.join(os.homedir(), TALOS_DIR, "talos.pid");

/**
 * Stop Talos command
 */
export async function stopTalosCommand(): Promise<void> {
  try {
    const processManager = new ProcessManager();

    // Read Talos PID
    const pid = await processManager.readPid(TALOS_PID_PATH);

    if (pid === null) {
      console.log("Talos is not running");
      return;
    }

    // Check if process is running
    const isRunning = processManager.isAliveSync(pid);

    if (!isRunning) {
      console.log("Talos is not running (cleaning up stale PID file)");
      try {
        // PID file management using fs is acceptable (part of process management layer)
        await fs.unlink(TALOS_PID_PATH);
      } catch {
        // Ignore errors
      }
      return;
    }

    // First, stop UI via Socket (if running)
    try {
      const socketClient = new SocketClient();
      const isTalosAlive = await socketClient.isTalosRunning();

      if (isTalosAlive) {
        console.log("Stopping Web UI...");
        const uiStatusResponse = await socketClient.getUIStatus();
        const uiStatus = uiStatusResponse.data;

        if (uiStatus?.running) {
          try {
            const stopResult = await socketClient.stopUI();
            if (stopResult.success) {
              console.log(`✓ ${stopResult.data?.message || "UI stopped"}`);
            } else {
              console.warn(`⚠️  Failed to stop UI: ${stopResult.error || "Unknown error"}`);
            }
          } catch (error) {
            console.warn(`⚠️  Failed to stop UI: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    } catch (error) {
      // Socket communication failed, Talos might be shutting down already
      // Continue with stopping Talos process
      if ((error as Error).message?.includes("ECONNREFUSED")) {
        console.log("Talos is shutting down...");
      } else {
        console.warn(`⚠️  Could not communicate with Talos: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Send SIGTERM to Talos
    console.log(`Sent SIGTERM to Talos (PID: ${pid})`);

    // Use ProcessManager to stop the process (with built-in 5s timeout and SIGKILL fallback)
    await processManager.stop(pid, false);

    // Clean up PID file
    try {
      // PID file management using fs is acceptable (part of process management layer)
      await fs.unlink(TALOS_PID_PATH);
    } catch {
      // Ignore errors
    }

    console.log("✓ Talos stopped");
  } catch (error) {
    console.error("Error stopping Talos:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
