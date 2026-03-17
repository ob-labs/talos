/**
 * Claude Environment Check
 *
 * Utilities for checking if Claude CLI is available in the environment.
 */

import { spawn } from "child_process";

/**
 * Result of Claude environment check
 */
export interface ClaudeEnvironmentCheckResult {
  available: boolean;
  error?: string;
}

/**
 * Check if Claude CLI is available in the current environment
 *
 * Executes `claude --version` to verify availability.
 * Returns success if the command can be executed (doesn't validate version).
 *
 * @returns Promise with check result
 */
export async function checkClaudeEnvironment(): Promise<ClaudeEnvironmentCheckResult> {
  return new Promise((resolve) => {
    let childProcess: any;

    try {
      childProcess = spawn("claude", ["--version"], {
        stdio: "pipe",
      });
    } catch (error) {
      // Handle spawn errors (e.g., command not found on Windows)
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        resolve({
          available: false,
          error: "Claude command not found",
        });
        return;
      }

      resolve({
        available: false,
        error: (error as Error).message,
      });
      return;
    }

    let stdout = "";
    let stderr = "";

    childProcess.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    childProcess.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    childProcess.on("close", (code: number | null) => {
      // Exit code 127 typically means command not found
      if (code === 127) {
        resolve({
          available: false,
          error: "Claude command not found",
        });
        return;
      }

      // If exit code is 0 or 1, Claude CLI is available
      // (Exit code 1 might mean not logged in, but command exists)
      if (code === 0 || code === 1) {
        resolve({
          available: true,
        });
        return;
      }

      // Other exit codes
      resolve({
        available: false,
        error: `Claude command exited with code ${code}`,
      });
    });

    childProcess.on("error", (error: Error) => {
      // Handle spawn errors (e.g., command not found on Windows)
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        resolve({
          available: false,
          error: "Claude command not found",
        });
        return;
      }

      resolve({
        available: false,
        error: error.message,
      });
    });

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      if (childProcess && typeof childProcess.kill === "function") {
        childProcess.kill();
      }
      resolve({
        available: false,
        error: "Claude command timed out",
      });
    }, 5000);

    // Clear timeout if process closes before timeout
    childProcess.on("close", () => {
      clearTimeout(timeout);
    });

    childProcess.on("error", () => {
      clearTimeout(timeout);
    });
  });
}
