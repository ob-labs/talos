import { GitCommit } from "@talos/git";
import { WorkspaceStorage, WorktreeStorage } from "@talos/core";
import {
  handleAPIError,
  handleValidationError,
  handleNotFoundError,
  handleSuccess,
  withErrorHandler,
} from "@/lib/api/error-handler";
import { NextRequest } from "next/server";

// Create instances
const workspaceStorage = new WorkspaceStorage();
const worktreeStorage = new WorktreeStorage();

/**
 * POST /api/git/discard
 * Discard working directory changes
 *
 * Request body:
 * - workspaceId: string
 * - worktreeId: string
 * - files?: string[] - Specific files to discard (default: all modified files)
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const body = await request.json();
    const { workspaceId, worktreeId, files } = body;

    // Validation
    if (!workspaceId || typeof workspaceId !== "string") {
      return handleValidationError("workspaceId is required", { field: "workspaceId" });
    }

    if (!worktreeId || typeof worktreeId !== "string") {
      return handleValidationError("worktreeId is required", { field: "worktreeId" });
    }

    // Get workspace
    const workspace = await workspaceStorage.getWorkspace(workspaceId);
    if (!workspace) {
      return handleNotFoundError("Workspace", workspaceId);
    }

    // Get worktree
    const worktree = await worktreeStorage.getWorktree(worktreeId);
    if (!worktree) {
      return handleNotFoundError("Worktree", worktreeId);
    }

    // Determine repo path
    let repoPath = workspace.path;
    if (!worktree.isDefault) {
      repoPath = `${workspace.path}/../${worktree.branchName}`;
    }

    // Perform discard
    const git = new GitCommit(repoPath);

    // If specific files provided, checkout those files
    // Otherwise, checkout all modified files
    let filesToDiscard = files;
    if (!filesToDiscard) {
      // Get status to find modified files
      const { GitRepository } = await import("@talos/git");
      const repo = new GitRepository(repoPath);
      const statusResult = await repo.status();

      if (statusResult.success && statusResult.data) {
        const status = statusResult.data;
        filesToDiscard = [
          ...status.modified,
          ...status.notStaged,
        ];
      }
    }

    if (!filesToDiscard || filesToDiscard.length === 0) {
      return handleSuccess({
        success: true,
        message: "No changes to discard",
        workspaceId,
        worktreeId,
      });
    }

    const checkoutResult = await git.checkout(filesToDiscard);

    if (!checkoutResult.success) {
      return handleAPIError(new Error(checkoutResult.error || "Git checkout failed"), "POST /api/git/discard");
    }

    return handleSuccess({
      success: true,
      workspaceId,
      worktreeId,
      files: filesToDiscard,
    });
  }, "POST /api/git/discard");
}
