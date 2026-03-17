import { GitCommit } from "@talos/git";
import { WorkspaceStorage, WorktreeStorage, StoryStorage } from "@talos/core";
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
const storyStorage = new StoryStorage();

/**
 * POST /api/git/commit
 * Commit changes for a story/worktree
 *
 * Request body:
 * - workspaceId: string
 * - worktreeId: string
 * - storyId?: string - If provided, commit is associated with this story
 * - message: string - Commit message
 * - addAll?: boolean - Whether to add all changes before committing (default: true)
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const body = await request.json();
    const { workspaceId, worktreeId, storyId, message, addAll = true } = body;

    // Validation
    if (!workspaceId || typeof workspaceId !== "string") {
      return handleValidationError("workspaceId is required", { field: "workspaceId" });
    }

    if (!worktreeId || typeof worktreeId !== "string") {
      return handleValidationError("worktreeId is required", { field: "worktreeId" });
    }

    if (!message || typeof message !== "string") {
      return handleValidationError("commit message is required", { field: "message" });
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

    // Perform commit
    const git = new GitCommit(repoPath);

    // Add all changes if requested
    if (addAll) {
      const addResult = await git.addAll();
      if (!addResult.success) {
        return handleAPIError(new Error(addResult.error || "Git add failed"), "POST /api/git/commit");
      }
    }

    // Commit
    const commitResult = await git.commit(message);

    if (!commitResult.success) {
      return handleAPIError(new Error(commitResult.error || "Git commit failed"), "POST /api/git/commit");
    }

    // If storyId provided, update story with commit info
    if (storyId) {
      const commitData = {
        hash: commitResult.data!.commit,
        message,
        timestamp: Date.now(),
      };
      await storyStorage.updateStory(worktreeId, storyId, { commit: commitData });
    }

    return handleSuccess({
      success: true,
      workspaceId,
      worktreeId,
      storyId: storyId || null,
      commit: commitResult.data,
    });
  }, "POST /api/git/commit");
}
