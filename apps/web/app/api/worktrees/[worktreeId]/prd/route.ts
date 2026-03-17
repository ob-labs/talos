import { NextRequest, NextResponse } from "next/server";
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import type { PRD, UserStory } from "@talos/types";

const execAsync = promisify(exec);

/**
 * 读取 PRD 状态
 * 通过 CLI 获取任务信息，然后读取 PRD
 */
async function readPRDStatus(worktreeId: string): Promise<{
  project: string;
  userStories: UserStory[];
  isComplete: boolean;
  completedCount: number;
  progress: number;
  workingDir: string;
} | null> {
  try {
    // 1. 通过 CLI 获取任务列表
    const { stdout } = await execAsync('talos task list --json', {
      env: { ...process.env, NODE_ENV: 'production' }
    });

    const tasks = JSON.parse(stdout);

    // 2. 找到匹配 worktreeId 的任务
    const task = tasks.find((t: any) => t.worktree === worktreeId);
    if (!task) {
      return null;
    }

    // 3. 创建 PRDManager
    const { PRDManager } = await import('@talos/core');
    const prdManager = new PRDManager(task.workingDir, task.prd);
    const prd = await prdManager.getPRD();

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
      workingDir: task.workingDir,
    };
  } catch (error) {
    console.error(`Error reading PRD status for worktree ${worktreeId}:`, error);
    return null;
  }
}

/**
 * GET /api/worktrees/[worktreeId]/prd
 * Get PRD info for a worktree
 *
 * Returns the PRD information including project name, stories, and progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ worktreeId: string }> }
) {
  try {
    const { worktreeId } = await params;

    // Read PRD status
    const prdStatus = await readPRDStatus(worktreeId);

    if (!prdStatus) {
      return NextResponse.json(
        { error: "Not found", message: `Worktree "${worktreeId}" not found or no PRD` },
        { status: 404 }
      );
    }

    // Generate PRD ID from project name
    const prdId = prdStatus.project.toLowerCase().replace(/\s+/g, '-');

    return NextResponse.json({
      prdId,
      project: prdStatus.project,
      worktreeId,
      workingDir: prdStatus.workingDir,
      userStories: prdStatus.userStories,
      isComplete: prdStatus.isComplete,
      completedCount: prdStatus.completedCount,
      progress: prdStatus.progress,
    });
  } catch (error) {
    console.error("Error getting PRD for worktree:", error);
    return NextResponse.json(
      {
        error: "Failed to get PRD",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
