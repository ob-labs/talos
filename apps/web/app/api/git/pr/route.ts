import { NextRequest, NextResponse } from "next/server";
import { GitRemote } from "@talos/git";
import { WorkspaceStorage, WorktreeStorage } from "@talos/core";

// Create instances
const workspaceStorage = new WorkspaceStorage();
const worktreeStorage = new WorktreeStorage();

/**
 * POST /api/git/pr
 * Create a pull request for a worktree
 *
 * Request body:
 * - workspaceId: string
 * - worktreeId: string
 * - title?: string - PR title (default: worktree title)
 * - body?: string - PR body
 * - base?: string - Base branch (default: main)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, worktreeId, title, body: prBody, base = "main" } = body;

    // Validation
    if (!workspaceId || typeof workspaceId !== "string") {
      return NextResponse.json(
        { error: "Invalid input", message: "workspaceId is required" },
        { status: 400 }
      );
    }

    if (!worktreeId || typeof worktreeId !== "string") {
      return NextResponse.json(
        { error: "Invalid input", message: "worktreeId is required" },
        { status: 400 }
      );
    }

    // Get workspace
    const workspace = await workspaceStorage.getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json(
        { error: "Not found", message: `Workspace '${workspaceId}' not found` },
        { status: 404 }
      );
    }

    // Get worktree
    const worktree = await worktreeStorage.getWorktree(worktreeId);
    if (!worktree) {
      return NextResponse.json(
        { error: "Not found", message: `Worktree '${worktreeId}' not found` },
        { status: 404 }
      );
    }

    // Create PR using GitHub CLI
    const git = new GitRemote(workspace.path);
    const prTitle = title || worktree.title;
    const prDescription = prBody || worktree.name;

    const result = await git.createPR({
      title: prTitle,
      body: prDescription,
      base,
      head: worktree.branchName,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to create PR", message: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      workspaceId,
      worktreeId,
      pr: result.data,
    });
  } catch (error) {
    console.error("Error creating PR:", error);
    return NextResponse.json(
      { error: "Failed to create PR", message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/git/pr?workspaceId={id}&worktreeId={id}
 * List pull requests or get PR URL
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

    // Get workspace
    const workspace = await workspaceStorage.getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json(
        { error: "Not found", message: `Workspace '${workspaceId}' not found` },
        { status: 404 }
      );
    }

    // List PRs
    const git = new GitRemote(workspace.path);
    const result = await git.listPRs({
      state: "open",
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to list PRs", message: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      workspaceId,
      worktreeId: worktreeId || null,
      prs: result.data || [],
    });
  } catch (error) {
    console.error("Error listing PRs:", error);
    return NextResponse.json(
      { error: "Failed to list PRs", message: (error as Error).message },
      { status: 500 }
    );
  }
}
