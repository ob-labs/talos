import { NextRequest, NextResponse } from "next/server";
import { workspaceSessionStorage, PRDManager } from '@talos/core';
import { scanWorkspaceWorktrees } from '@talos/git';
import type { Worktree, Story } from "@/types";
import type { PRD, UserStory } from "@talos/types";

/**
 * 读取 PRD 状态
 * 内联实现，替代 @talos/converter 的 readPRDStatus 函数
 */
async function readPRDStatus(worktreePath: string): Promise<{
  project: string;
  userStories: UserStory[];
  isComplete: boolean;
  completedCount: number;
  progress: number;
} | null> {
  try {
    const prdManager = new PRDManager(worktreePath, 'prd');
    const prd: PRD | null = await prdManager.getPRD();

    if (!prd) {
      return null;
    }

    const total = prd.userStories.length;
    const completedCount = prd.userStories.filter(s => s.passes).length;
    const isComplete = total === completedCount;
    const progress = total === 0 ? 0 : Math.round((completedCount / total) * 100);

    return {
      project: prd.project,
      userStories: prd.userStories,
      isComplete,
      completedCount,
      progress,
    };
  } catch (error) {
    console.error(`Error reading PRD status from ${worktreePath}:`, error);
    return null;
  }
}

/**
 * GET /api/worktrees/[worktreeId]
 * Get a specific worktree by its name or branch
 *
 * The worktreeId format is: {repoName}-{worktreeName}
 * Example: valtio-ssr-demo-hello-world2
 *
 * Response: Worktree object with stories
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ worktreeId: string }> }
) {
  try {
    const { worktreeId } = await params;

    if (!worktreeId) {
      return NextResponse.json(
        { error: "Invalid request", message: "Worktree ID is required" },
        { status: 400 }
      );
    }

    // Parse worktreeId - format: {repoName}-{worktreeName}
    // Example: valtio-ssr-demo-hello-world2
    // We need to handle cases where repoName contains hyphens (e.g., valtio-ssr-demo)

    let targetBranchName = worktreeId;
    let targetRepoName: string | undefined;

    const workspaceConfigs = await workspaceSessionStorage.getWorkspaces();

    // Try to match worktreeId with a workspace by finding which workspace's repo name
    // is a prefix of the worktreeId
    for (const ws of workspaceConfigs) {
      const repoName = ws.path.split(/[/\\]/).pop() || '';
      // Check if worktreeId starts with "{repoName}-"
      if (worktreeId.startsWith(`${repoName}-`)) {
        targetRepoName = repoName;
        // Extract worktree name by removing the "{repoName}-" prefix
        targetBranchName = worktreeId.slice(repoName.length + 1);
        break;
      }
    }

    // Filter workspaces to search (if targetRepoName is set, only search matching workspace)
    const workspacesToSearch = targetRepoName
      ? workspaceConfigs.filter(ws => ws.path.endsWith(`/${targetRepoName}`))
      : workspaceConfigs;

    // Search for the worktree in workspaces
    let foundWorktree = null;
    let targetWorkspace = null;

    for (const wsConfig of workspacesToSearch) {
      // Scan worktrees for this workspace
      const scanResult = await scanWorkspaceWorktrees(wsConfig.path);

      if (!scanResult.success || !scanResult.data) {
        continue;
      }

      // Find worktree by name or branch
      // Note: targetBranchName might be without the 'ralph/' prefix, so we need to check both
      const worktree = scanResult.data.find(
        (wt) => wt.branch === targetBranchName ||
                 wt.branch === `ralph/${targetBranchName}` ||
                 wt.path.endsWith(`/${targetBranchName}`)
      );

      if (worktree) {
        foundWorktree = worktree;
        targetWorkspace = wsConfig;
        break;
      }
    }

    if (!foundWorktree || !targetWorkspace) {
      return NextResponse.json(
        { error: "Not found", message: `Worktree "${worktreeId}" not found` },
        { status: 404 }
      );
    }

    // Read PRD status from worktree
    const prdStatus = await readPRDStatus(foundWorktree.path);

    // Convert PRD user stories to Story format
    const stories: Story[] = prdStatus
      ? prdStatus.userStories.map((story) => ({
          id: story.id,
          title: story.title,
          description: story.description,
          acceptanceCriteria: story.acceptanceCriteria || [],          priority: story.priority || 0,
          passes: story.passes,
          terminal: [],
        }))
      : [];

    // Determine worktree status based on PRD progress
    let status: Worktree["status"] = "pending";
    if (prdStatus?.isComplete) {
      status = "completed";
    } else if (prdStatus && prdStatus.completedCount > 0) {
      status = "running";
    }

    // Create Worktree object
    const worktree: Worktree = {
      id: foundWorktree.path,
      name: foundWorktree.branch,
      title: prdStatus?.project || foundWorktree.branch,
      branchName: foundWorktree.branch,
      status,
      progress: prdStatus?.progress || 0,
      isDefault: foundWorktree.isDefault ?? false,
      terminal: [],
      stories,
      workspaceId: targetWorkspace.id,
      path: foundWorktree.path,
    };

    return NextResponse.json(worktree);
  } catch (error) {
    console.error("Error getting worktree:", error);
    return NextResponse.json(
      {
        error: "Failed to get worktree",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
