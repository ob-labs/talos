import { WorkspaceRepository } from '@talos/core';
import { scanWorkspaceWorktrees } from '@talos/git';
import type { Workspace, Worktree, Story } from "@/types";
import type { WorkspaceConfig, PRD, UserStory } from "@talos/types";
import {
  handleSuccess,
  withErrorHandler,
} from "@/lib/api/error-handler";

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
    const { PRDManager } = await import('@talos/core');
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
 * GET /api/workspaces
 * List all workspaces with their worktrees
 *
 * This endpoint scans Git worktrees in real-time (no caching).
 * For each workspace, it scans for Git worktrees and reads their PRD status.
 */
export async function GET() {
  return withErrorHandler(async () => {
    const repo = new WorkspaceRepository();
    const workspaceConfigs = await repo.findAll();
    const workspaces: Workspace[] = [];
    const allWorktrees: Worktree[] = [];

    for (const wsConfig of workspaceConfigs) {
      // Convert WorkspaceConfig to Workspace
      const workspace: Workspace = {
        id: wsConfig.id,
        name: wsConfig.name,
        branch: "main", // Default branch
        path: wsConfig.path,
        worktrees: [],
        terminals: [],
        expanded: true,
      };
      workspaces.push(workspace);

      // Scan worktrees for this workspace
      const scanResult = await scanWorkspaceWorktrees(wsConfig.path);

      if (scanResult.success && scanResult.data) {
        // Process each worktree and convert to Feat format
        for (const wt of scanResult.data) {
          // Read PRD status from worktree
          const prdStatus = await readPRDStatus(wt.path);

          if (prdStatus) {
            // Convert PRD user stories to WorkspaceTask format
            const stories: Story[] = prdStatus.userStories.map((story) => ({
              id: story.id,
              title: story.title,
              description: story.description,
              acceptanceCriteria: story.acceptanceCriteria || [],
              priority: story.priority || 0,
              passes: story.passes,
              terminal: [], // Empty terminal logs
            }));

            // Determine worktree status based on PRD progress
            let status: Worktree["status"] = "pending";
            if (prdStatus.isComplete) {
              status = "completed";
            } else if (prdStatus.completedCount > 0) {
              status = "running";
            }

            // Create Worktree object from worktree
            const worktree: Worktree = {
              id: wt.path, // Use worktree path as unique ID
              name: wt.branch, // Use branch name as worktree name
              title: prdStatus.project, // Use PRD project name as title
              branchName: wt.branch,
              status,
              progress: prdStatus.progress,
              isDefault: wt.isDefault ?? false, // Use isDefault from scanner
              terminal: [], // Empty terminal logs

              stories, // Stories from PRD
              workspaceId: wsConfig.id,
              path: wt.path, // Include worktree path for terminal sessions
            };

            allWorktrees.push(worktree);
          } else {
            // Worktree exists but has no PRD - create minimal Worktree
            const worktree: Worktree = {
              id: wt.path,
              name: wt.branch,
              title: `${wt.branch} (无 PRD)`,
              branchName: wt.branch,
              status: "pending",
              progress: 0,
              isDefault: wt.isDefault ?? false, // Use isDefault from scanner
              terminal: [],
              stories: [], // Use stories as the primary field
              workspaceId: wsConfig.id,
              path: wt.path, // Include worktree path for terminal sessions
            };

            allWorktrees.push(worktree);
          }
        }
      }
    }

    return handleSuccess({
      workspaces,
      worktrees: allWorktrees,
    });
  }, "GET /api/workspaces");
}
