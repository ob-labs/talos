import { exec } from 'child_process';
import { promisify } from 'util';
import { NextRequest } from "next/server";
import { withErrorHandler, handleSuccess, handleNotFoundError } from "@/lib/api/error-handler";

const execAsync = promisify(exec);

/**
 * GET /api/tasks/[taskId]/status
 * 获取任务状态（通过调用 CLI 命令并筛选）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  return withErrorHandler(async () => {
    const { taskId } = await params;

    try {
      // 调用 CLI 命令获取任务状态
      const { stdout, stderr } = await execAsync('talos task status --json --no-watch', {
        env: { ...process.env, NODE_ENV: 'production' }
      });

      if (stderr && !stdout) {
        throw new Error(stderr);
      }

      const tasks = JSON.parse(stdout);

      // 筛选出指定 taskId 的任务
      const task = tasks.find((t: any) => t.id === taskId);

      if (!task) {
        return handleNotFoundError("Task", taskId);
      }

      // 返回任务状态信息
      return handleSuccess({
        id: task.id,
        status: task.status,
        pid: task.pid,
        createdAt: task.createdAt,
        workspace: task.workspace,
        prd: task.prd,
      });
    } catch (error) {
      // 如果 Talos 未启动或没有任务，返回 404
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return handleNotFoundError("Task", taskId);
      }
      throw error;
    }
  }, "GET /api/tasks/[taskId]/status");
}
