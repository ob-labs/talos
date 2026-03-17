import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, handleSuccess, handleAPIError } from "@/lib/api/error-handler";
import { getTalosClient } from "@/lib/talos-client";

/**
 * GET /api/tasks
 * 获取所有任务列表（通过 Socket 客户端与 Talos 守护进程通信）
 */
export async function GET() {
  return withErrorHandler(async () => {
    const client = getTalosClient();

    // Check if daemon is running
    const isRunning = await client.isDaemonRunning();
    if (!isRunning) {
      return handleSuccess([]);
    }

    const tasks = await client.listTasks();
    return handleSuccess(tasks);
  }, "GET /api/tasks");
}

/**
 * POST /api/tasks
 * 启动新任务
 *
 * Request body:
 * - prdId: PRD identifier
 * - workingDir: Working directory path
 * - debug?: Debug mode flag
 * - tool?: Tool to use (claude or cursor)
 * - model?: Model to use for cursor-agent
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const body = await request.json();

    // Validate required fields
    if (!body.prdId) {
      return handleAPIError(new Error("Missing required field: prdId"), 400);
    }
    if (!body.workingDir) {
      return handleAPIError(new Error("Missing required field: workingDir"), 400);
    }

    const client = getTalosClient();
    const task = await client.startTask({
      prdId: body.prdId,
      workingDir: body.workingDir,
      debug: body.debug,
      tool: body.tool,
      model: body.model,
    });

    return handleSuccess(task, 201);
  }, "POST /api/tasks");
}
