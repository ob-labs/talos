import { NextRequest } from "next/server";
import { GitWorktree } from "@talos/git";
import { workspaceStorage } from '@talos/core';
import { withErrorHandler, handleSuccess, handleValidationError, handleNotFoundError, handleAPIError } from "@/lib/api/error-handler";

/**
 * POST /api/git/worktree
 * Create a new worktree
 *
 * Request body:
 * - workspaceId: string
 * - branchName: string - Name of the branch to create
 * - basePath?: string - Base path for the worktree (default: workspace.path/../branchName)
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const body = await request.json();
    const { workspaceId, branchName, basePath } = body;

    // Validation
    if (!workspaceId || typeof workspaceId !== "string") {
      return handleValidationError("workspaceId is required", { field: "workspaceId" });
    }

    if (!branchName || typeof branchName !== "string") {
      return handleValidationError("branchName is required", { field: "branchName" });
    }

    // Get workspace
    const workspace = await workspaceStorage.getWorkspace(workspaceId);
    if (!workspace) {
      return handleNotFoundError("Workspace", workspaceId);
    }

    // Determine worktree path
    const worktreePath = basePath || `${workspace.path}/../${branchName}`;

    // Create worktree
    const git = new GitWorktree(workspace.path);
    const result = await git.createFromBranch(worktreePath, branchName);

    if (!result.success) {
      return handleAPIError(new Error(result.error || "Git worktree creation failed"));
    }

    return handleSuccess({
      success: true,
      workspaceId,
      branchName,
      worktreePath,
    });
  }, "POST /api/git/worktree");
}

/**
 * DELETE /api/git/worktree?workspaceId={id}&branchName={name}
 * Remove a worktree
 */
export async function DELETE(request: NextRequest) {
  return withErrorHandler(async () => {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const branchName = searchParams.get("branchName");

    if (!workspaceId) {
      return handleValidationError("workspaceId is required", { field: "workspaceId" });
    }

    if (!branchName) {
      return handleValidationError("branchName is required", { field: "branchName" });
    }

    // Get workspace
    const workspace = await workspaceStorage.getWorkspace(workspaceId);
    if (!workspace) {
      return handleNotFoundError("Workspace", workspaceId);
    }

    // Determine worktree path
    const worktreePath = `${workspace.path}/../${branchName}`;

    // Remove worktree
    const git = new GitWorktree(workspace.path);
    const result = await git.remove(worktreePath, true);

    if (!result.success) {
      return handleAPIError(new Error(result.error || "Git worktree removal failed"));
    }

    return handleSuccess({
      success: true,
      workspaceId,
      branchName,
      worktreePath,
    });
  }, "DELETE /api/git/worktree");
}
