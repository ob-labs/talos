/**
 * Infrastructure Layer: Process Manager Interface
 *
 * Defines the contract for process management operations.
 * Implementations must support spawning processes, stopping them,
 * checking their status, and managing process groups.
 */

import type { ProcessRuntimeInfo } from './ProcessRuntimeInfo';
import type { ProcessStartOptions } from './ProcessStartOptions';
import type { ProcessEventType, ProcessEvent } from './ProcessEventType';

/**
 * Process spawning options
 * @deprecated Use ProcessStartOptions instead
 */
export interface ProcessSpwanOptions {
  /**
   * Working directory for the process
   */
  cwd?: string;

  /**
   * Environment variables for the process
   */
  env?: Record<string, string>;

  /**
   * Whether to create a new process group
   * When true, the process and its children can be managed as a group
   */
  createGroup?: boolean;

  /**
   * Whether to spawn the process in detached mode
   * When true, the process becomes a process group leader
   */
  detached?: boolean;

  /**
   * File descriptor for standard input
   */
  stdin?: 'ignore' | 'pipe' | 'inherit' | number;

  /**
   * File descriptor for standard output
   */
  stdout?: 'ignore' | 'pipe' | 'inherit' | number;

  /**
   * File descriptor for standard error
   */
  stderr?: 'ignore' | 'pipe' | 'inherit' | number;

  /**
   * Standard I/O configuration as an array [stdin, stdout, stderr]
   */
  stdio?: ['ignore' | 'pipe' | 'inherit' | number, 'ignore' | 'pipe' | 'inherit' | number, 'ignore' | 'pipe' | 'inherit' | number];

  /**
   * Process metadata (user-defined key-value pairs)
   */
  metadata?: Record<string, unknown>;
}

/**
 * Exit information for a terminated process
 * @deprecated Use ProcessExitResult classes instead
 */
export interface ProcessExitInfo {
  /**
   * Process exit code (0-255)
   * null if the process was terminated by a signal
   */
  exitCode: number | null;

  /**
   * Signal that terminated the process (e.g., 'SIGTERM', 'SIGKILL')
   * null if the process exited normally
   */
  signal: NodeJS.Signals | null;

  /**
   * Whether the process was terminated by a signal
   */
  wasSignaled: boolean;

  /**
   * Whether the process was killed
   */
  killed: boolean;

  /**
   * Timestamp when the process exited
   */
  timestamp: Date;
}

/**
 * Process Manager Interface v2.0
 *
 * Provides abstraction over process lifecycle management.
 * Implementations must ensure proper cleanup of processes and their children.
 *
 * v2.0 changes:
 * - register() returns pid and supports processType
 * - get() retrieves process info
 * - stop() supports force flag
 * - isAlive() is async
 * - on() supports event subscription
 */
export interface IProcessManager {
  /**
   * Register and start a new process
   *
   * @param processType - Process type/category (e.g., 'task', 'daemon', 'session')
   * @param options - Process start options
   * @returns Process ID (pid) of the spawned process
   *
   * @throws {Error} If the command cannot be spawned
   *
   * Implementation notes:
   * - Must return a valid process ID
   * - Must track the process for later management
   * - Should respect the createGroup option for managing process trees
   * - Should emit 'process:start' event
   */
  register(
    processType: string,
    options: ProcessStartOptions
  ): Promise<number>;

  /**
   * Get process information
   *
   * @param pid - Process ID
   * @returns Process info if found, null otherwise
   *
   * Implementation notes:
   * - Must return null for non-existent processes
   * - Should not throw exceptions
   */
  get(pid: number): ProcessRuntimeInfo | null;

  /**
   * Stop a running process
   *
   * @param pid - Process ID to stop
   * @param force - Whether to force kill immediately (skip SIGTERM)
   * @returns void
   *
   * @throws {Error} If the process is not managed by this ProcessManager
   *
   * Implementation notes:
   * - If force is false, first attempt graceful shutdown with SIGTERM
   * - If force is true, immediately send SIGKILL
   * - Must clean up process tracking
   * - Should emit 'process:exit' event
   * - Should handle already-terminated processes gracefully
   */
  stop(pid: number, force?: boolean): Promise<void>;

  /**
   * Check if a process is alive
   *
   * @param pid - Process ID to check
   * @returns true if the process is running, false otherwise
   *
   * Implementation notes:
   * - Must handle non-existent processes gracefully (return false)
   * - Should not throw exceptions
   * - Async to support potential external process checks
   */
  isAlive(pid: number): Promise<boolean>;

  /**
   * Subscribe to process events
   *
   * @param event - Event type to listen for
   * @param callback - Callback function to handle events
   *
   * Implementation notes:
   * - Must support 'process:start' and 'process:exit' events
   * - Should allow multiple subscribers for the same event
   * - Should return unsubscribe function or support off()
   */
  on(event: ProcessEventType, callback: (event: ProcessEvent) => void): void;

  // ========== Legacy v1.0 methods (for backward compatibility) ==========

  /**
   * Spawn a new process
   * @deprecated Use register() instead
   *
   * @param command - Command to execute (e.g., 'node', 'python', '/path/to/script')
   * @param args - Command arguments
   * @param options - Process spawning options
   * @returns Process ID (pid) of the spawned process
   *
   * @throws {Error} If the command cannot be spawned
   *
   * Implementation notes:
   * - Must return a valid process ID
   * - Must track the process for later management
   * - Should respect the createGroup option for managing process trees
   */
  spawn(
    command: string,
    args?: string[],
    options?: ProcessSpwanOptions
  ): Promise<number>;

  /**
   * Stop a running process
   * @deprecated Use stop() instead
   *
   * @param pid - Process ID to stop
   * @param signal - Signal to send (default: 'SIGTERM')
   * @param timeout - Milliseconds to wait before force killing with SIGKILL (default: 5000)
   * @returns Exit information
   *
   * @throws {Error} If the process is not managed by this ProcessManager
   *
   * Implementation notes:
   * - First attempt graceful shutdown with SIGTERM
   * - If timeout expires, force kill with SIGKILL
   * - Must clean up process tracking
   * - Should handle already-terminated processes gracefully
   */
  stopLegacy(
    pid: number,
    signal?: NodeJS.Signals,
    timeout?: number
  ): Promise<ProcessExitInfo>;

  /**
   * Check if a process is alive (sync version)
   * @deprecated Use isAlive() instead (async version)
   *
   * @param pid - Process ID to check
   * @returns true if the process is running, false otherwise
   *
   * Implementation notes:
   * - Must handle non-existent processes gracefully (return false)
   * - Should not throw exceptions
   */
  isAliveSync(pid: number): boolean;

  /**
   * Stop all processes in a process group
   *
   * @param leaderPid - Process group leader's PID
   * @param signal - Signal to send (default: 'SIGTERM')
   * @param timeout - Milliseconds to wait before force killing (default: 5000)
   * @returns Map of process IDs to their exit information
   *
   * @throws {Error} If the process group is not managed by this ProcessManager
   *
   * Implementation notes:
   * - Must terminate all processes in the group
   * - Should handle partial failures gracefully
   * - Must clean up tracking for all stopped processes
   */
  stopProcessGroup(
    leaderPid: number,
    signal?: NodeJS.Signals,
    timeout?: number
  ): Promise<Map<number, ProcessExitInfo>>;
}
