import { workspaceSessionStorage, PRDManager } from '@talos/core';
import { scanWorkspaceWorktrees } from '@talos/git';
import type { WorkspaceWorktrees, WorktreeStatus } from "@/types";
import type { PRD, UserStory } from "@talos/types";
import { NextResponse } from "next/server";

/**
 * 读取 PRD 状态
 * 内联实现，替代 @talos/converter 的 readPRDStatus 函数
 */
async function readPRDStatus(worktreePath: string): Promise<{
  project: string;
  userStories: UserStory[];
  totalCount: number;
  completedCount: number;
  progress: number;
  isComplete: boolean;
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
      totalCount: total,
      completedCount,
      progress,
      isComplete,
    };
  } catch (error) {
    console.error(`Error reading PRD status from ${worktreePath}:`, error);
    return null;
  }
}

/**
 * GET /api/workspaces/worktrees
 * Get all workspaces with their worktrees and PRD status
 *
 * This endpoint scans all workspaces for Git worktrees and reads their PRD status
 * in real-time (no caching). Returns a list of workspaces with their worktrees.
 *
 * Response:
 * {
 *   "workspaces": [
 *     {
 *       "id": string,
 *       "name": string,
 *       "path": string,
 *       "currentBranch": string,
 *       "worktrees": [
 *         {
 *           "path": string,
 *           "branch": string,
 *           "commit": string,
 *           "isDetached": boolean,
 *           "project": string,
 *           "userStories": [...],
 *           "completedCount": number,
 *           "totalCount": number,
 *           "progress": number,
 *           "isComplete": boolean
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
export async function GET() {
  try {
    // Get all workspaces from storage
    const workspaceConfigs = await workspaceSessionStorage.getWorkspaces();

    // Scan each workspace for worktrees in parallel
    const workspaceResults = await Promise.all(
      workspaceConfigs.map(async (workspaceConfig) => {
        // Scan worktrees for this workspace
        const scanResult = await scanWorkspaceWorktrees(workspaceConfig.path);

        if (!scanResult.success || !scanResult.data) {
          // Return workspace with empty worktree list on scan failure
          return {
            id: workspaceConfig.id,
            name: workspaceConfig.name,
            path: workspaceConfig.path,
            currentBranch: "main", // Default branch
            worktrees: [] as WorktreeStatus[],
          };
        }

        // Read PRD status for each worktree in parallel
        const worktreeStatuses = await Promise.all(
          scanResult.data.map(async (wt) => {
            // Read PRD status from worktree
            const prdStatus = await readPRDStatus(wt.path);

            if (!prdStatus) {
              // Worktree exists but no PRD file - return minimal info
              return {
                path: wt.path,
                branch: wt.branch,
                commit: wt.commit,
                isDetached: wt.isDetached,
                project: "Unknown",
                userStories: [],
                completedCount: 0,
                totalCount: 0,
                progress: 0,
                isComplete: false,
              } satisfies WorktreeStatus;
            }

            // Combine Git metadata with PRD status
            return {
              path: wt.path,
              branch: wt.branch,
              commit: wt.commit,
              isDetached: wt.isDetached,
              project: prdStatus.project,
              userStories: prdStatus.userStories,
              completedCount: prdStatus.completedCount,
              totalCount: prdStatus.totalCount,
              progress: prdStatus.progress,
              isComplete: prdStatus.isComplete,
            } satisfies WorktreeStatus;
          })
        );

        return {
          id: workspaceConfig.id,
          name: workspaceConfig.name,
          path: workspaceConfig.path,
          currentBranch: "main", // Default branch
          worktrees: worktreeStatuses,
        } satisfies WorkspaceWorktrees;
      })
    );

    // Return response with no-cache headers
    return NextResponse.json(
      {
        workspaces: workspaceResults,
      },
      {
        headers: {
          "Cache-Control": "no-cache, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Error getting workspace worktrees:", error);
    return NextResponse.json(
      {
        error: "Failed to get workspace worktrees",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
