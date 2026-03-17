import { promises as fs } from 'fs';
import path from 'path';

/**
 * Read log file content with error handling
 * 读取日志文件内容（带错误处理）
 *
 * @param repoRoot - Repository root directory (仓库根目录)
 * @param taskId - Task ID (任务 ID)
 * @returns Log content or empty string if file not found or error occurs
 */
export async function readTaskLog(
  repoRoot: string,
  taskId: string
): Promise<string> {
  try {
    const logPath = path.join(repoRoot, '.talos', 'logs', `${taskId}.log`);
    const content = await fs.readFile(logPath, 'utf-8');
    return content;
  } catch (error) {
    // If file doesn't exist, return empty string (not an error)
    // 如果文件不存在，返回空字符串（不是错误）
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return '';
    }

    // Log other errors but don't crash
    // 记录其他错误但不崩溃
    console.error(`Error reading log file for task ${taskId}:`, error);
    return '';
  }
}

/**
 * Read the last N lines of a log file
 * 读取日志文件的最后 N 行
 *
 * @param repoRoot - Repository root directory (仓库根目录)
 * @param taskId - Task ID (任务 ID)
 * @param tailLines - Number of lines to read from the end (从末尾读取的行数)
 * @returns Last N lines of log content
 */
export async function readTaskLogTail(
  repoRoot: string,
  taskId: string,
  tailLines: number = 50
): Promise<string> {
  try {
    const logPath = path.join(repoRoot, '.talos', 'logs', `${taskId}.log`);
    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.split('\n');
    const tailLinesContent = lines.slice(-tailLines).join('\n');
    return tailLinesContent;
  } catch (error) {
    // If file doesn't exist, return empty string (not an error)
    // 如果文件不存在，返回空字符串（不是错误）
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return '';
    }

    // Log other errors but don't crash
    // 记录其他错误但不崩溃
    console.error(`Error reading log file for task ${taskId}:`, error);
    return '';
  }
}
