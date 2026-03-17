import { NextRequest, NextResponse } from "next/server";
import { workspaceSessionStorage } from '@talos/core';
import { scanWorkspaceWorktrees } from '@talos/git';
import { ProgressLogger } from "@/lib/memory/progress-log";
import { handleNotFoundError } from "@/lib/api";
import { LocalStorageEngine } from "@talos/core";
import type { PRD, UserStory } from "@talos/types";

/**
 * GET /api/worktrees/[worktreeId]/stories/[storyId]
 * Returns story details as JSON
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ worktreeId: string; storyId: string }> }
) {
  try {
    const { worktreeId, storyId } = await params;

    // Parse worktreeId - format: {repoName}-{worktreeName}
    let targetBranchName = worktreeId;
    let targetRepoName: string | undefined;

    // Find the worktree's actual path by scanning all workspaces
    const workspaceConfigs = await workspaceSessionStorage.getWorkspaces();

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

      if (!scanResult.success || !scanResult.data) {
        continue;
      }

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

    // Read PRD from worktree path
    // Try to find PRD in ralph/ directory (same logic as readPRDStatus)
    const storageService = new LocalStorageEngine(foundWorktreePath);
    const { readdirSync } = await import('fs');
    const pathModule = await import('path');

    let prd: PRD | null = null;
    const ralphDir = pathModule.join(foundWorktreePath, 'ralph');

    try {
      const dirs = readdirSync(ralphDir, { withFileTypes: true });
      const prdDirs = dirs.filter(d => d.isDirectory()).map(d => d.name);

      if (prdDirs.length > 0) {
        // Use the first found PRD directory
        const prdName = prdDirs[0];
        const prdRelativePath = pathModule.join('ralph', prdName, 'prd.json');
        prd = await storageService.readJSON<PRD>(prdRelativePath);
      }
    } catch {
      // ralph directory doesn't exist or can't be read
      // Fall back to legacy paths
      const legacyPaths = [
        'prd.json',
        'scripts/ralph/prd.json',
      ];

      for (const prdPath of legacyPaths) {
        prd = await storageService.readJSON<PRD>(prdPath);
        if (prd) {
          break;
        }
      }
    }

    if (!prd) {
      return NextResponse.json(
        { error: "Not found", message: `PRD not found in worktree: ${worktreeId}` },
        { status: 404 }
      );
    }

    // Find the story in the PRD
    const story = prd.userStories.find((s) => s.id === storyId);
    if (!story) {
      return handleNotFoundError("Story", storyId);
    }

    // Fetch execution history for completed stories
    let progressEntry = null;
    let executionHistoryNote = null;

    if (story.passes) {
      try {
        // Create a ProgressLogger instance with the worktree path
        // Use the same path as PRD: ralph/{prdName}/progress.txt
        const pathModule = await import('path');
        const { readdirSync } = await import('fs');

        const ralphDir = pathModule.join(foundWorktreePath, 'ralph');
        const dirs = readdirSync(ralphDir, { withFileTypes: true });
        const prdDirs = dirs.filter(d => d.isDirectory()).map(d => d.name);

        if (prdDirs.length === 0) {
          // No PRD directory found, skip progress entry
          executionHistoryNote = '未找到 ralph 目录，无法加载执行历史';
        } else {
          const prdName = prdDirs[0];
          const progressFilePath = pathModule.join('ralph', prdName, 'progress.txt');

          const worktreeProgressLogger = new ProgressLogger(
            progressFilePath,
            storageService
          );
          progressEntry = await worktreeProgressLogger.getStoryProgressEntry(worktreeId, storyId);
        }

        // If no progress entry found in current worktree, try to find in other related worktrees
        if (!progressEntry) {
          console.log(`[StoryDetails] No progress entry found for ${storyId} in ${worktreeId}, searching in other worktrees...`);

          // Search in all workspaces for this story's progress
          for (const wsConfig of workspaceConfigs) {
            try {
              const scanResult = await scanWorkspaceWorktrees(wsConfig.path);
              if (!scanResult.success || !scanResult.data) continue;

              for (const wt of scanResult.data) {
                // Check each worktree's progress.txt
                const wtStorageService = new LocalStorageEngine(wt.path);
                // Try to find progress.txt in ralph directory
                const pathModule = await import('path');
                const { readdirSync } = await import('fs');
                const ralphDir = pathModule.join(wt.path, 'ralph');
                const dirs = readdirSync(ralphDir, { withFileTypes: true });
                const prdDirs = dirs.filter(d => d.isDirectory()).map(d => d.name);

                if (prdDirs.length === 0) {
                  continue; // No PRD directory in this worktree, skip
                }

                const prdName = prdDirs[0];
                const wtProgressPath = pathModule.join('ralph', prdName, 'progress.txt');

                const wtProgressLogger = new ProgressLogger(
                  wtProgressPath,
                  wtStorageService
                );

                const entry = await wtProgressLogger.getStoryProgressEntry(wt.path, storyId);
                if (entry) {
                  console.log(`[StoryDetails] Found progress entry for ${storyId} in ${wt.path}`);
                  progressEntry = entry;
                  executionHistoryNote = `注：此执行历史来自相关 worktree: ${wt.branch}`;
                  break;
                }
              }

              if (progressEntry) break;
            } catch (error) {
              console.warn(`[StoryDetails] Failed to search ${wsConfig.path}:`, error);
              continue;
            }
          }

          if (!progressEntry) {
            executionHistoryNote = `注：此任务已完成，但未找到执行历史记录。该任务可能是在其他 worktree 中完成的，或者执行历史未被正确记录。`;
          }
        }
      } catch (error) {
        console.warn("Failed to fetch progress entry:", error);
        executionHistoryNote = `注：无法加载执行历史: ${(error as Error).message}`;
      }
    }

    // Build story details response (JSON format)
    const storyDetails = {
      id: story.id,
      title: story.title,
      description: story.description,
      acceptanceCriteria: story.acceptanceCriteria,
      priority: story.priority,
      dependsOn: story.dependsOn,
      passes: story.passes,
      notes: story.notes,
      progressEntry,
      executionHistoryNote,
      projectName: prd.project,
      worktreeId,
    };

    return NextResponse.json(storyDetails);
  } catch (error) {
    console.error("Error getting story details:", error);
    return NextResponse.json(
      {
        error: "Failed to get story details",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
