import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { NextRequest } from "next/server";
import { withErrorHandler, handleSuccess, handleNotFoundError, handleValidationError } from "@/lib/api/error-handler";

const execAsync = promisify(exec);

/**
 * GET /api/tasks/[taskId]/logs
 * 获取任务日志（通过读取日志文件）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  return withErrorHandler(async () => {
    const { taskId } = await params;
    const { searchParams } = new URL(request.url);
    const lines = parseInt(searchParams.get('lines') || '100');

    try {
      // 首先获取任务信息以确定 workspace 路径
      const { stdout: taskListOutput } = await execAsync('talos task list --json', {
        env: { ...process.env, NODE_ENV: 'production' }
      });

      const tasks = JSON.parse(taskListOutput);
      const task = tasks.find((t: any) => t.id === taskId);

      if (!task) {
        return handleNotFoundError("Task", taskId);
      }

      // 日志文件路径：.talos/logs/{taskId}.log
      const logPath = `${task.workspace}/.talos/logs/${taskId}.log`;

      try {
        // 读取日志文件
        const logContent = await readFile(logPath, 'utf-8');

        // 按行分割，并返回最后 N 行
        const logLines = logContent.split('\n').filter(line => line.trim());
        const slicedLines = lines > 0 ? logLines.slice(-lines) : logLines;

        return handleSuccess({
          taskId,
          logPath,
          totalLines: logLines.length,
          lines: slicedLines,
        });
      } catch (readError) {
        // 如果日志文件不存在，返回空日志
        if ((readError as NodeJS.ErrnoException).code === 'ENOENT') {
          return handleSuccess({
            taskId,
            logPath,
            totalLines: 0,
            lines: [],
            message: 'Log file not found',
          });
        }
        throw readError;
      }
    } catch (error) {
      // 如果 Talos 未启动或没有任务，返回 404
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return handleNotFoundError("Task", taskId);
      }
      throw error;
    }
  }, "GET /api/tasks/[taskId]/logs");
}
