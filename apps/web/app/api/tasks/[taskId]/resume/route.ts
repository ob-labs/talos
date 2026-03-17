import { NextRequest } from "next/server";
import { withErrorHandler, handleSuccess, handleAPIError } from "@/lib/api/error-handler";
import { getTalosClient } from "@/lib/talos-client";

/**
 * POST /api/tasks/[taskId]/resume
 * 恢复已停止的任务
 *
 * Request body:
 * - debug?: Debug mode flag
 * - tool?: Tool to use (claude or cursor)
 * - model?: Model to use for cursor-agent
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  return withErrorHandler(async () => {
    const { taskId } = await params;

    if (!taskId) {
      return handleAPIError(new Error("Task ID is required"), 400);
    }

    const body = await request.json().catch(() => ({}));

    const client = getTalosClient();
    await client.resumeTask({
      taskId,
      debug: body.debug,
      tool: body.tool,
      model: body.model,
    });

    return handleSuccess({ message: "Task resumed successfully" });
  }, "POST /api/tasks/[taskId]/resume");
}
