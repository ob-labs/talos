#!/usr/bin/env node
/**
 * talos workspace list 命令
 * 列出所有 workspace
 */

import fs from "fs/promises";
import { WorkspaceRepository } from "@talos/core";

/**
 * Workspace list options
 */
export interface WorkspaceListOptions {
  json?: boolean;
}

/**
 * List workspaces command
 * @param options - Workspace list options
 */
export async function listWorkspaceCommand(options: WorkspaceListOptions = {}): Promise<void> {
  try {
    const { json } = options;

    // Get all workspaces from WorkspaceRepository
    const repo = new WorkspaceRepository();
    const workspaces = await repo.findAll();

    // If no workspaces configured
    if (workspaces.length === 0) {
      if (json) {
        console.log(JSON.stringify([], null, 2));
        return;
      }
      console.log('No workspaces configured. Run "talos workspace add <path>" to add one.');
      return;
    }

    // Check if each workspace path exists
    const workspacesWithStatus = await Promise.all(
      workspaces.map(async (ws) => {
        try {
          await fs.access(ws.path);
          return { ...ws, exists: true };
        } catch {
          return { ...ws, exists: false };
        }
      })
    );

    // Output as JSON if requested
    if (json) {
      const jsonData = workspacesWithStatus.map((ws) => ({
        name: ws.name,
        path: ws.exists ? ws.path : "NOT FOUND",
      }));
      console.log(JSON.stringify(jsonData, null, 2));
      return;
    }

    // Display as table
    console.log(); // Empty line for spacing

    // Calculate column widths
    const maxNameWidth = Math.max(
      4, // "Name" length
      ...workspacesWithStatus.map((ws) => ws.name.length)
    );
    const maxPathWidth = Math.max(
      4, // "Path" length
      ...workspacesWithStatus.map((ws) => (ws.exists ? ws.path : "NOT FOUND").length)
    );

    // Print header
    const header = `${"Name".padEnd(maxNameWidth)}  ${"Path".padEnd(maxPathWidth)}`;
    console.log(header);
    console.log("=".repeat(maxNameWidth) + "  " + "=".repeat(maxPathWidth));

    // Print workspaces
    for (const ws of workspacesWithStatus) {
      const pathDisplay = ws.exists ? ws.path : "NOT FOUND";
      console.log(`${ws.name.padEnd(maxNameWidth)}  ${pathDisplay.padEnd(maxPathWidth)}`);
    }

    console.log(); // Empty line for spacing
    console.log(`Total: ${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"}`);
  } catch (error) {
    console.error(
      "Error listing workspaces:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
