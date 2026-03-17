/**
 * Worktree 锁文件管理
 * Worktree lock file management
 *
 * 用于防止多个进程同时操作同一个 worktree
 * Prevents multiple processes from operating on the same worktree simultaneously
 */

import { existsSync, unlinkSync, writeFileSync, mkdirSync, statSync } from "fs";
import { dirname } from "path";

/**
 * 锁文件过期时间：2 小时（毫秒）
 * Lock file expiration time: 2 hours (milliseconds)
 */
const LOCK_EXPIRATION_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * 获取锁文件路径
 * Get lock file path
 * @param worktreePath worktree 路径 / Worktree path
 * @returns 锁文件路径 / Lock file path
 */
function getLockFilePath(worktreePath: string): string {
  return `${worktreePath}/.ralph-lock`;
}

/**
 * 检查锁文件是否有效（未过期）
 * Check if lock file is valid (not expired)
 * @param lockFilePath 锁文件路径 / Lock file path
 * @returns true if lock is valid (< 2 hours old)
 */
function isLockValid(lockFilePath: string): boolean {
  try {
    const stats = statSync(lockFilePath);
    const lockAge = Date.now() - stats.mtimeMs;
    return lockAge < LOCK_EXPIRATION_MS;
  } catch {
    return false;
  }
}

/**
 * 获取 worktree 锁
 * Acquire worktree lock
 *
 * 创建锁文件以防止并发访问
 * Creates lock file to prevent concurrent access
 *
 * @param worktreePath worktree 路径 / Worktree path
 * @returns 清理函数，调用后删除锁文件 / Cleanup function that removes lock file
 * @throws Error 如果锁文件存在且有效 / Throws if lock file exists and is valid
 */
export function acquireWorktreeLock(worktreePath: string): () => void {
  const lockFilePath = getLockFilePath(worktreePath);

  // 检查锁文件是否存在
  // Check if lock file exists
  if (existsSync(lockFilePath)) {
    if (isLockValid(lockFilePath)) {
      // 锁文件有效，抛出错误
      // Lock file is valid, throw error
      throw new Error(
        `Worktree 正在被另一个进程使用

Worktree 路径: ${worktreePath}

建议：
  - 等待另一个进程完成
  - 如果确认没有其他进程在运行，手动删除锁文件: rm ${lockFilePath}`
      );
    } else {
      // 锁文件已过期，删除它
      // Lock file expired, remove it
      unlinkSync(lockFilePath);
    }
  }

  // 创建锁文件目录（如果不存在）
  // Create lock file directory (if not exists)
  const lockDir = dirname(lockFilePath);
  if (!existsSync(lockDir)) {
    mkdirSync(lockDir, { recursive: true });
  }

  // 创建锁文件，写入进程启动时间戳
  // Create lock file with process start timestamp
  writeFileSync(lockFilePath, Date.now().toString(), { mode: 0o644 });

  // 返回清理函数
  // Return cleanup function
  return () => {
    try {
      if (existsSync(lockFilePath)) {
        unlinkSync(lockFilePath);
      }
    } catch {
      // 清理失败，忽略错误
      // Cleanup failed, ignore error
    }
  };
}
