import { workspaceSessionStorage, PRDManager } from '@talos/core';
import { scanWorkspaceWorktrees } from '@talos/git';
import { progressLogger } from "@/lib/memory/progress-log";
import { handleNotFoundError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
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
 * GET /api/prds/[id]/stories/[storyId]/commits
 * Returns commit hashes for a specific story from a PRD
 *
 * Note: The prdId parameter is actually the worktreeId in the format {repoName}-{branchName}
 *
 * Response (200):
 * - commits: string[] - Array of commit hashes
 *
 * Response (404):
 * - error: string - Error type
 * - message: string - Error message
 *
 * Returns empty array if no commits found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; storyId: string }> }
) {
  const { id: worktreeId, storyId } = await params;

  try {
    // Parse worktreeId and find the actual worktree path
    const workspaceConfigs = await workspaceSessionStorage.getWorkspaces();
    let targetBranchName = worktreeId;
    let targetRepoName: string | undefined;

    for (const ws of workspaceConfigs) {
      const repoName = ws.path.split(/[/\\]/).pop() || '';
      if (worktreeId.startsWith(`${repoName}-`)) {
        targetRepoName = repoName;
        targetBranchName = worktreeId.slice(repoName.length + 1);
        break;
      }
    }

    const workspacesToSearch = targetRepoName
      ? workspaceConfigs.filter(ws => ws.path.endsWith(`/${targetRepoName}`))
      : workspaceConfigs;

    let foundWorktreePath: string | null = null;

    for (const wsConfig of workspacesToSearch) {
      const scanResult = await scanWorkspaceWorktrees(wsConfig.path);
      if (!scanResult.success || !scanResult.data) continue;

      const worktree = scanResult.data.find(
        (wt) => wt.branch === targetBranchName ||
                 wt.branch === `ralph/${targetBranchName}` ||
                 wt.path.endsWith(`/${targetBranchName}`) ||
                 wt.branch === worktreeId ||
                 wt.path.endsWith(`/${worktreeId}`)
      );

      if (worktree) {
        foundWorktreePath = worktree.path;
        break;
      }
    }

    if (!foundWorktreePath) {
      return handleNotFoundError("Worktree", worktreeId);
    }

    // Read PRD status to verify story exists
    const prdStatus = await readPRDStatus(foundWorktreePath);
    if (!prdStatus) {
      return NextResponse.json(
        { error: "Not found", message: "No PRD found in worktree" },
        { status: 404 }
      );
    }

    // Check if story exists in PRD
    const story = prdStatus.userStories.find((s) => s.id === storyId);
    if (!story) {
      return handleNotFoundError("Story", storyId);
    }

    // Get commits for the story
    const commitsResult = await progressLogger.getCommitsByStory(storyId);

    // Extract commits from the result (getCommitsByStory returns array of { storyId, commits })
    // Since we filtered by storyId, there should be at most one entry
    const commits = commitsResult.length > 0 ? commitsResult[0].commits : [];

    return NextResponse.json({ commits });
  } catch (error) {
    console.error("Error getting story commits:", error);
    return NextResponse.json(
      {
        error: "Failed to get story commits",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
