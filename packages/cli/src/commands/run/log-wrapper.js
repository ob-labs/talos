#!/usr/bin/env node
/**
 * Log Wrapper Script
 *
 * This script wraps a subprocess and forwards its stdout/stderr to the log daemon.
 * Usage: node log-wrapper.js <taskId> -- <command> [args...]
 *
 * Example:
 *   node log-wrapper.js task-123 -- npm run dev
 */

import { spawn } from "child_process";
import { LoggerClient } from "@talos/logger";
import { openSync } from "fs";

/**
 * Parse command line arguments
 * Format: <taskId> -- <command> [args...]
 */
function parseArgs(args) {
  const separatorIndex = args.indexOf("--");
  if (separatorIndex === -1) {
    console.error("Usage: node log-wrapper.js <taskId> -- <command> [args...]");
    process.exit(1);
  }

  const taskId = args.slice(0, separatorIndex)[0];
  const commandArgs = args.slice(separatorIndex + 1);

  if (!taskId) {
    console.error("Error: taskId is required");
    process.exit(1);
  }

  if (commandArgs.length === 0) {
    console.error("Error: command is required after --");
    process.exit(1);
  }

  return { taskId, command: commandArgs[0], args: commandArgs.slice(1) };
}

/**
 * Stream data from a child process to the log daemon
 * @param {import('stream').Readable} stream - The stream to read from
 * @param {string} taskId - The task ID for logging
 * @param {string} streamName - Name of the stream (stdout/stderr)
 */
async function streamToLog(stream, taskId, streamName) {
  // Get socket path from environment variable (for testing)
  const socketPath = process.env.TEST_SOCKET_PATH || undefined;

  const client = new LoggerClient(socketPath ? { socketPath } : {});
  let buffer = "";

  for await (const chunk of stream) {
    buffer += chunk.toString();

    // Process complete lines
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.length === 0) continue;

      try {
        await client.send(taskId, line);
      } catch (error) {
        // Log errors to stderr if LoggerClient fails
        console.error(`[log-wrapper] Failed to send ${streamName} to log daemon:`, error.message);
        // Fallback: print to console
        console.log(line);
      }
    }
  }

  // Process any remaining data in buffer
  if (buffer.length > 0) {
    try {
      await client.send(taskId, buffer);
    } catch (error) {
      console.error(`[log-wrapper] Failed to send ${streamName} to log daemon:`, error.message);
      console.log(buffer);
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  // Parse arguments
  const { taskId, command, args } = parseArgs(process.argv.slice(2));

  // Spawn the subprocess
  // Open /dev/null to provide a valid stdin that doesn't block
  const devnull = openSync('/dev/null', 'r');

  const child = spawn(command, args, {
    stdio: [devnull, "pipe", "pipe"], // Use /dev/null for stdin, pipe stdout and stderr
    detached: false,
  });

  let exitCode = 0;
  let exitSignal = null;

  // Set up exit handlers
  child.on("exit", (code, signal) => {
    exitCode = code ?? 0;
    exitSignal = signal;
  });

  child.on("error", (error) => {
    console.error(`[log-wrapper] Failed to spawn process:`, error.message);
    process.exit(1);
  });

  // Stream stdout to log daemon
  const stdoutPromise = streamToLog(child.stdout, taskId, "stdout").catch((error) => {
    console.error(`[log-wrapper] Error streaming stdout:`, error.message);
  });

  // Stream stderr to log daemon
  const stderrPromise = streamToLog(child.stderr, taskId, "stderr").catch((error) => {
    console.error(`[log-wrapper] Error streaming stderr:`, error.message);
  });

  // Wait for both streams to complete
  await Promise.all([stdoutPromise, stderrPromise]);

  // Wait for child process to exit
  await new Promise((resolve) => {
    child.on("exit", resolve);
    child.on("error", resolve);
  });

  // Exit with the same code as the subprocess
  if (exitSignal) {
    // Killed by signal, convert signal to exit code
    process.exit(128 + (exitSignal === "SIGINT" ? 2 : exitSignal === "SIGTERM" ? 15 : 1));
  } else {
    process.exit(exitCode);
  }
}

// Run main function
main().catch((error) => {
  console.error("[log-wrapper] Unexpected error:", error);
  process.exit(1);
});
