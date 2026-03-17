#!/usr/bin/env node
/**
 * talos restart command
 * Restart Talos main process (stop then start)
 */

import { stopTalosCommand } from './stop';
import { startTalosCommand } from './start';

export async function restartTalosCommand(): Promise<void> {
  try {
    console.log("Restarting Talos...");

    // Step 1: Stop Talos
    await stopTalosCommand();

    // Step 2: Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Start Talos
    await startTalosCommand();

    console.log("✓ Talos restarted successfully");
  } catch (error) {
    console.error("Error restarting Talos:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
