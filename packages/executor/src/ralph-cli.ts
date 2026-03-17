#!/usr/bin/env node
/**
 * Ralph Executor CLI - Child Process Entry Point
 *
 * This file is the entry point for Ralph executor as an independent process.
 * It reads configuration from command-line arguments and runs the executor.
 *
 * Moved to @talos/executor to avoid circular dependencies with @talos/core.
 * Uses @talos/logger for logging functionality.
 */

import { RalphExecutor } from "./RalphExecutor";
import type { RalphExecutorOptions } from "./RalphExecutor";
import { Logger } from "@talos/logger";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// ESM __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Parse config from command line argument
  const configJson = process.argv[2];
  if (!configJson) {
    console.error("Usage: ralph-cli <json-config>");
    process.exit(1);
  }

  const config = JSON.parse(configJson);

  // Create logger from @talos/logger package
  const logger = new Logger({ logPath: config.logFile });

  try {
    // Log startup info
    const timestamp = new Date().toISOString();
    await logger.info(`[ralph-cli] Starting with config: ${JSON.stringify({...config, logFile: '...'})}`);
    await logger.info(`[ralph-cli] __dirname: ${__dirname}`);
    await logger.info(`[ralph-cli] __filename: ${__filename}`);
    await logger.info(`[ralph-cli] process.cwd(): ${process.cwd()}`);

    // Check for MOCK_MODE environment variable
    const mockMode = process.env.MOCK_MODE === 'true' || process.env.MOCK_MODE === '1';
    if (mockMode) {
      await logger.info("[ralph-cli] MOCK MODE ENABLED");
    }

    // Create and start executor with logger
    const executor = new RalphExecutor({
      ...config,
      logger,
      mock: mockMode,
      mockIterations: 3,
    });

    // Set up signal handlers for graceful shutdown
    const shutdown = async (signal: NodeJS.Signals) => {
      await logger.info(`[ralph-cli] Received ${signal}, shutting down gracefully...`);
      await executor.stop();
      process.exit(0);
    };

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));

    // Set up parent process liveness check
    // This detects if the parent process (TaskManager) dies unexpectedly
    const PARENT_CHECK_INTERVAL = 5000; // 5 seconds
    const initialPpid = process.ppid;

    await logger.info(`[ralph-cli] Parent process liveness check started (PPID: ${initialPpid})`);

    const parentCheckInterval = setInterval(() => {
      const currentPpid = process.ppid;

      // If PPID changed to 1 (init), parent process has died
      if (currentPpid === 1 && initialPpid !== 1) {
        logger.error(`[ralph-cli] Parent process died (PPID: ${initialPpid} -> 1), exiting...`);
        clearInterval(parentCheckInterval);
        process.exit(1); // Exit with error code
      }

      // Also check if PPID changed significantly (potential reparenting)
      if (currentPpid !== initialPpid && currentPpid !== 1) {
        logger.warn(`[ralph-cli] PPID changed from ${initialPpid} to ${currentPpid}`);
      }
    }, PARENT_CHECK_INTERVAL);

    // Clear interval on signal handlers
    const originalShutdown = shutdown;
    const shutdownWithCleanup = async (signal: NodeJS.Signals) => {
      clearInterval(parentCheckInterval);
      await originalShutdown(signal);
    };

    // Replace signal handlers with cleanup versions
    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGINT");
    process.once("SIGTERM", () => shutdownWithCleanup("SIGTERM"));
    process.once("SIGINT", () => shutdownWithCleanup("SIGINT"));

    // Start execution (this will block until completion or error)
    const result = await executor.start();

    // Exit with appropriate code
    if (result.success) {
      await logger.info("[ralph-cli] Ralph execution completed successfully");
      process.exit(0);
    } else {
      await logger.error(`[ralph-cli] Ralph execution failed: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    // Error logging
    const errorMsg = `[ralph-cli] Fatal error: ${(error as Error).message}`;
    const stackMsg = `[ralph-cli] Error stack: ${(error as Error).stack}`;

    console.error(errorMsg);
    console.error(stackMsg);

    // Write to log file
    try {
      await logger.error(errorMsg);
      await logger.error(stackMsg);
    } catch {
      // Ignore logging errors
    }

    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  console.error(`[${new Date().toISOString()}] Unhandled error:`, error);
  process.exit(1);
});
