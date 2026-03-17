import { NextRequest, NextResponse } from "next/server";
import { GitCommit } from "@talos/git";
import { workspaceSessionStorage } from "@talos/core";
import { scanWorkspaceWorktrees } from "@talos/git";

/**
 * GET /api/git/diff?workspaceId={id}&worktreeId={id}&cached={boolean}
 * Get git diff for a workspace/worktree
 *
 * worktreeId/worktreeId 支持多种格式：
 * - 完整分支名: "ralph/sub-agent2" 或 "sub-agent2"
 * - Worktree key: "talos-sub-agent2" (格式: {repoName}-{branchName})
 * - 完整路径: "/path/to/worktree"
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const worktreeId = searchParams.get("worktreeId") || searchParams.get("worktreeId");
    const cached = searchParams.get("cached") === "true";

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Missing parameter", message: "workspaceId is required" },
        { status: 400 }
      );
    }

    // Get workspace to find the repo path
    const workspaces = await workspaceSessionStorage.getWorkspaces();
    const workspace = workspaces.find((ws) => ws.id === workspaceId);

    if (!workspace) {
      console.error(`[API] Workspace not found: ${workspaceId}. Available workspaces:`, workspaces.map(w => w.id));
      return NextResponse.json(
        { error: "Not found", message: `Workspace '${workspaceId}' not found. Available: ${workspaces.map(w => w.id).join(", ")}` },
        { status: 404 }
      );
    }

    // Determine repo path - 使用 workspace 路径作为基础
    let repoPath = workspace.path;
    let foundWorktree = false;

    if (worktreeId) {
      // Scan worktrees to find the matching one
      const scanResult = await scanWorkspaceWorktrees(workspace.path);
      if (scanResult.success && scanResult.data) {
        console.log(`[API] Looking for worktree: ${worktreeId}`);
        console.log(`[API] Available worktrees:`, scanResult.data.map(w => ({ branch: w.branch, path: w.path })));

        // Extract repo name from workspace path for worktree key matching
        const repoName = workspace.path.split(/[/\\]/).pop() || '';
        console.log(`[API] Repo name: ${repoName}`);

        // Try multiple matching strategies
        const matched = scanResult.data.find((wt) => {
          // 1. Exact branch match: "sub-agent2"
          if (wt.branch === worktreeId) {
            console.log(`[API] Matched by exact branch: ${wt.branch}`);
            return true;
          }

          // 2. Branch with ralph/ prefix: "ralph/sub-agent2"
          if (wt.branch === `ralph/${worktreeId}`) {
            console.log(`[API] Matched by ralph/ prefix: ${wt.branch}`);
            return true;
          }

          // 3. Worktree key format: "talos-sub-agent2" -> extract "sub-agent2"
          if (worktreeId.startsWith(`${repoName}-`)) {
            const branchName = worktreeId.slice(repoName.length + 1);
            if (wt.branch === branchName) {
              console.log(`[API] Matched by worktree key: ${worktreeId} -> ${wt.branch}`);
              return true;
            }
          }

          // 4. Full path match
          if (wt.path === worktreeId) {
            console.log(`[API] Matched by full path: ${wt.path}`);
            return true;
          }

          // 5. Path suffix match
          if (wt.path.endsWith(`/${worktreeId}`)) {
            console.log(`[API] Matched by path suffix: ${wt.path}`);
            return true;
          }

          return false;
        });

        if (matched) {
          console.log(`[API] Found worktree: ${matched.path}`);
          repoPath = matched.path;
          foundWorktree = true;
        } else {
          console.warn(`[API] No worktree found for: ${worktreeId}`);
        }
      }
    }

    // Get git diff
    const git = new GitCommit(repoPath);
    const diffOptions = worktreeId && foundWorktree
      ? { baseRef: "main" }
      : { cached };
    const diffResult = await git.getDetailedDiff(diffOptions);

    if (!diffResult.success) {
      return NextResponse.json(
        { error: "Git error", message: diffResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      workspaceId,
      worktreeId: worktreeId || null,
      cached,
      diff: diffResult.data || [],
      repoPath, // For debugging
    });
  } catch (error) {
    console.error("[API] Error getting git diff:", error);
    return NextResponse.json(
      { error: "Failed to get git diff", message: (error as Error).message },
      { status: 500 }
    );
  }
}
