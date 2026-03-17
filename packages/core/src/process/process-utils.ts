/**
 * Process utility functions
 *
 * Utility functions for process-related file operations.
 */

import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";

/**
 * Get the PID file path for a session
 * @param sessionId - Session ID
 * @param basePath - Optional base path for testing (defaults to ~/.talos)
 * @returns Path to the PID file
 */
export function getPidPath(sessionId: string, basePath?: string): string {
  const talosDir = basePath || path.join(os.homedir(), ".talos");
  return path.join(talosDir, "sessions", `${sessionId}.pid`);
}

/**
 * Get the socket file path for a session
 * @param sessionId - Session ID
 * @param basePath - Optional base path for testing (defaults to ~/.talos)
 * @returns Path to the socket file
 */
export function getSocketPath(sessionId: string, basePath?: string): string {
  const talosDir = basePath || path.join(os.homedir(), ".talos");
  return path.join(talosDir, "sessions", `${sessionId}.sock`);
}

/**
 * Clean up session files (.sock and .pid), keeping .json
 * @param sessionId - Session ID to clean up
 * @param basePath - Optional base path for testing (defaults to ~/.talos)
 */
export async function cleanupSessionFiles(sessionId: string, basePath?: string): Promise<void> {
  const talosDir = basePath || path.join(os.homedir(), ".talos");
  const sessionsDir = path.join(talosDir, "sessions");

  // File extensions to clean up
  const extensions = [".sock", ".pid"];

  for (const ext of extensions) {
    const filePath = path.join(sessionsDir, `${sessionId}${ext}`);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        // Log but don't throw for cleanup errors
        console.warn(`Failed to delete ${filePath}:`, error);
      }
    }
  }
}
