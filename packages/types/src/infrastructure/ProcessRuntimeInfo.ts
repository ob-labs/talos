/**
 * Process Runtime Info
 *
 * Contains runtime information about a managed process.
 */

/**
 * Runtime information about a managed process
 */
export interface ProcessRuntimeInfo {
  /**
   * Process ID
   */
  pid: number;

  /**
   * Process type/category (e.g., 'task', 'daemon', 'session')
   */
  type: string;

  /**
   * Process metadata (user-defined key-value pairs)
   */
  metadata: Record<string, unknown>;

  /**
   * Timestamp when the process was started
   */
  startedAt: Date;

  /**
   * Process exit code (0-255)
   * undefined if the process is still running
   * null if the process was terminated by a signal
   */
  exitCode: number | null | undefined;

  /**
   * Signal that terminated the process (e.g., 'SIGTERM', 'SIGKILL')
   * undefined if the process is still running or exited normally
   */
  exitSignal: NodeJS.Signals | null | undefined;

  /**
   * Timestamp when the process exited
   * undefined if the process is still running
   */
  exitTime: Date | undefined;

  /**
   * Whether the process is currently running
   */
  isRunning: boolean;
}
