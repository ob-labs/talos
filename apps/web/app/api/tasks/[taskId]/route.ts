import { NextRequest } from "next/server";
import { withErrorHandler, handleSuccess, handleNotFoundError, handleAPIError } from "@/lib/api/error-handler";
import { getTalosClient } from "@/lib/talos-client";

/**
 * GET /api/tasks/[taskId]
 * 获取特定任务详情（通过 Socket 客户端与 Talos 守护进程通信）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  return withErrorHandler(async () => {
    const { taskId } = await params;

    if (!taskId) {
      return handleAPIError(new Error("Task ID is required"), 400);
    }

    const client = getTalosClient();
    const task = await client.getTaskStatus(taskId);

    return handleSuccess(task);
  }, "GET /api/tasks/[taskId]");
}

/**
 * DELETE /api/tasks/[taskId]
 * 停止任务
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  return withErrorHandler(async () => {
    const { taskId } = await params;

    if (!taskId) {
      return handleAPIError(new Error("Task ID is required"), 400);
    }

    const client = getTalosClient();
    await client.stopTask({ taskId, reason: 'Stopped via Web API' });

    return handleSuccess({ message: "Task stopped successfully" });
  }, "DELETE /api/tasks/[taskId]");
}
