#!/usr/bin/env node
/**
 * talos workspace add command
 * Add workspace to global configuration
 */

import path from "path";
import fs from "fs/promises";
import { Workspace, WorkspaceRepository, isGitRepo, getRepoRootPath, initializeTalosProject } from "@talos/core";
import { GitRepository } from "@talos/git";

/**
 * Workspace add options
 */
export interface WorkspaceAddOptions {
  path?: string;
  name?: string;
}

/**
 * Remove a workspace from repository (for rollback)
 */
async function removeWorkspaceFromConfig(workspaceName: string): Promise<void> {
  const repo = new WorkspaceRepository();
  const workspace = await repo.findByName(workspaceName);
  if (workspace) {
    await repo.delete(workspace.id);
  }
}

/**
 * Add a workspace command
 * @param options - Workspace add options (path is optional, defaults to current directory)
 */
export async function addWorkspaceCommand(
  options: WorkspaceAddOptions = {}
): Promise<void> {
  try {
    const { path: workspacePath, name } = options;

    // Resolve the workspace path to absolute path
    // If no path is specified, use the current working directory
    const inputPath = workspacePath || process.cwd();
    const resolvedPath = path.resolve(inputPath);

    // Verify path exists
    try {
      await fs.access(resolvedPath);
    } catch {
      console.error(`Error: Path does not exist: ${inputPath}`);
      process.exit(1);
    }

    // Validate that the path is a Git repository
    const isRepo = await isGitRepo(resolvedPath);
    if (!isRepo) {
      // Show different error messages depending on whether path was specified
      if (workspacePath) {
        console.error(`Error: Path is not a valid Git repository: ${inputPath}, please run git init first`);
      } else {
        console.error(`Error: Current directory is not a Git repository, please run git init first`);
      }
      process.exit(1);
    }

    // Get the repository root path (in case we're in a subdirectory)
    const repoRootPath = await getRepoRootPath(resolvedPath);
    if (!repoRootPath) {
      console.error(`Error: Cannot get Git repository root directory`);
      process.exit(1);
    }

    // Use the repository root path as the workspace path
    const finalPath = repoRootPath;

    // Determine workspace name
    let workspaceName: string;
    if (name) {
      workspaceName = name;
    } else {
      // Use directory name as workspace name
      workspaceName = path.basename(finalPath);
    }

    // Check if workspace already exists
    const repo = new WorkspaceRepository();
    const existingWorkspace = await repo.findByName(workspaceName);

    if (existingWorkspace) {
      console.log(`Workspace already exists: ${workspaceName}`);
      process.exit(0);
    }

    // Get the default branch name dynamically
    const gitRepo = new GitRepository(finalPath);
    const branchResult = await gitRepo.getDefaultBranch();
    const defaultBranch = branchResult.success && branchResult.data ? branchResult.data : "main";

    // Create and save workspace using Workspace entity
    const workspace = Workspace.create({
      id: `ws-${Date.now()}`,
      name: workspaceName,
      path: finalPath,
      branch: defaultBranch,
    });

    await repo.save(workspace);

    // Initialize .talos directory
    try {
      await initializeTalosProject(finalPath);
      console.log(`✓ Workspace added, .talos directory initialized`);
    } catch (initError) {
      // Rollback workspace addition on initialization failure
      await removeWorkspaceFromConfig(workspaceName);
      console.error(
        `Error: .talos directory initialization failed: ${initError instanceof Error ? initError.message : String(initError)}`
      );
      console.error(`Workspace addition has been rolled back`);
      process.exit(1);
    }
  } catch (error) {
    console.error(
      "Error adding workspace:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
