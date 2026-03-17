/**
 * Process Utilities
 * 进程工具函数
 */

/**
 * Check if a process is alive
 * 检查进程是否存活
 *
 * Uses signal 0 which doesn't actually send a signal but checks if process exists
 * 使用信号 0，它实际上不发送信号但检查进程是否存在
 *
 * @param pid - Process PID (进程 PID)
 * @returns True if process is alive, false otherwise (如果进程存活则为 true，否则为 false)
 */
export function isProcessAlive(pid: number): boolean {
  try {
    // Signal 0 doesn't send a signal but checks if process exists
    // 信号 0 不发送信号但检查进程是否存在
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // Process doesn't exist or we don't have permission
    // 进程不存在或我们没有权限
    return false;
  }
}
