import { NextRequest } from "next/server";
import { withErrorHandler, handleSuccess, handleAPIError } from "@/lib/api/error-handler";
import { getTalosClient } from "@/lib/talos-client";

/**
 * DELETE /api/tasks/[taskId]/remove
 * 删除任务及其资源
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
    await client.removeTask(taskId);

    return handleSuccess({ message: "Task removed successfully" });
  }, "DELETE /api/tasks/[taskId]/remove");
}
