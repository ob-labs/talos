import { NextRequest, NextResponse } from "next/server";
import { GitRepository } from "@talos/git";
import { WorkspaceStorage, WorktreeStorage } from "@talos/core";
import { scanWorkspaceWorktrees } from "@talos/git";

// Create instances
const workspaceStorage = new WorkspaceStorage();
const worktreeStorage = new WorktreeStorage();

/**
 * GET /api/git/status?workspaceId={id}&worktreeId={id}
 * Get git status for a workspace/worktree
 *
 * worktreeId 支持：持久化 worktree id、branch name、或 worktree 完整路径
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const worktreeId = searchParams.get("worktreeId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Missing parameter", message: "workspaceId is required" },
        { status: 400 }
      );
    }

    // Get workspace to find the repo path
    const workspace = await workspaceStorage.getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json(
        { error: "Not found", message: `Workspace '${workspaceId}' not found` },
        { status: 404 }
      );
    }

    // If worktreeId provided, use worktree's path
    let repoPath = workspace.path;
    if (worktreeId) {
      const worktreeFromStorage = await worktreeStorage.getWorktree(worktreeId);
      if (worktreeFromStorage && !worktreeFromStorage.isDefault) {
        repoPath = `${workspace.path}/../${worktreeFromStorage.branchName}`;
      } else if (!worktreeFromStorage) {
        const scanResult = await scanWorkspaceWorktrees(workspace.path);
        if (scanResult.success && scanResult.data) {
          const matched = scanResult.data.find(
            (wt) => wt.path === worktreeId || wt.branch === worktreeId
          );
          if (matched) {
            repoPath = matched.path;
          }
        }
      }
    }

    // Get git status
    const git = new GitRepository(repoPath);
    const statusResult = await git.status();

    if (!statusResult.success) {
      return NextResponse.json(
        { error: "Git error", message: statusResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      workspaceId,
      worktreeId: worktreeId || null,
      status: statusResult.data,
    });
  } catch (error) {
    console.error("Error getting git status:", error);
    return NextResponse.json(
      { error: "Failed to get git status", message: (error as Error).message },
      { status: 500 }
    );
  }
}
