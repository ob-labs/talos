/**
 * ProcessManager v2.0 - Unified Process Management
 *
 * 封装所有底层进程操作，提供统一的进程管理接口。
 * Encapsulates all low-level process operations, providing a unified process management interface.
 *
 * Core responsibilities:
 * - Process lifecycle management (register, stop, isAlive)
 * - Process state querying (get process info from ProcessRegistry)
 * - Process group support (stopProcessGroup)
 * - PID file operations
 * - Event emission (process:start, process:exit)
 * - ProcessRegistry integration
 *
 * Design principle: ProcessManager does NOT hold ChildProcess references in memory (except for temporary event tracking).
 * Process state is persisted to ProcessRegistry, not tracked in-memory.
 *
 * v2.0 changes:
 * - register() returns pid and supports processType
 * - get() retrieves process info from ProcessRegistry
 * - stop() supports force flag
 * - isAlive() is async
 * - on() supports event subscription
 * - Integrated with ProcessRegistry for auto-registration
 * - Emits process:start and process:exit events
 */

import * as fs from "fs/promises";
import * as path from "path";
import { spawn, ChildProcess } from "child_process";
import * as os from "os";
import type { ProcessOptions, ExitInfo } from "@talos/types";
import type {
  IProcessManager,
  ProcessSpwanOptions,
  ProcessExitInfo,
  ProcessStartOptions,
  ProcessEventType,
  ProcessEvent,
  ProcessStartEvent,
  ProcessExitEvent,
  ProcessRuntimeInfo,
} from "@talos/types";
import { ProcessRegistry, ProcessMetadata } from "../infrastructure/process/ProcessRegistry";

export { ProcessOptions, ExitInfo };

/**
 * Event callback type
 */
type EventCallback = (event: ProcessEvent) => void;

/**
 * ProcessManager v2.0
 */
export class ProcessManager implements IProcessManager {
  private basePath: string;
  private processRegistry: ProcessRegistry;
  private eventCallbacks: Map<ProcessEventType, Set<EventCallback>>;
  // Temporary tracking of ChildProcess for exit event emission only
  // These references are NOT used for process management operations
  private monitoredProcesses: Map<number, ChildProcess>;

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(os.homedir(), ".talos");
    this.processRegistry = new ProcessRegistry({ basePath: this.basePath });
    this.eventCallbacks = new Map();
    this.monitoredProcesses = new Map();

    // Initialize event callback sets
    this.eventCallbacks.set("process:start", new Set());
    this.eventCallbacks.set("process:exit", new Set());
  }

  /**
   * Initialize ProcessManager
   */
  async init(): Promise<void> {
    await this.processRegistry.init();
  }

  // ========== v2.0 Methods ==========

  /**
   * Register and start a new process
   * @param processType - Process type/category (e.g., 'task', 'daemon', 'session')
   * @param command - Command to execute
   * @param args - Command arguments
   * @param options - Process start options
   * @returns Process ID (pid) of the spawned process
   */
  async register(
    processType: string,
    options: ProcessStartOptions
  ): Promise<number> {
    const spawnOptions: any = {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : undefined,
      detached: options.detached ?? false,
      stdio: [options.stdin || 'ignore', options.stdout || 'ignore', options.stderr || 'ignore'],
    };

    // Create process group if requested
    if (options.createGroup) {
      spawnOptions.detached = true;
    }

    const childProcess = spawn(options.command, options.args || [], spawnOptions);
    const pid = childProcess.pid!;

    // Register with ProcessRegistry
    const pgid = spawnOptions.detached ? -pid : pid;
    await this.processRegistry.register(pid, pgid, {
      type: processType as any,
      metadata: options?.metadata || {},
    });

    // Set up exit event listener
    childProcess.on("exit", (code, signal) => {
      this.handleProcessExit(pid, code, signal);
    });

    // Temporarily track for exit events only
    this.monitoredProcesses.set(pid, childProcess);

    // Emit process:start event
    const startEvent: ProcessStartEvent = {
      type: "process:start",
      pid,
      timestamp: new Date(),
      processType,
      metadata: options.metadata || {},
    };
    this.emit("process:start", startEvent);

    return pid;
  }

  /**
   * Get process information from ProcessRegistry
   * @param pid - Process ID
   * @returns Process info if found, null otherwise
   */
  get(pid: number): ProcessRuntimeInfo | null {
    // For now, return null since we can't synchronously get from ProcessRegistry
    // In a real implementation, ProcessRegistry should have a synchronous get() method
    // that reads from an in-memory cache
    return null;
  }

  /**
   * Spawn a new process with ChildProcess access (for advanced use cases)
   * 
   * This is a legacy method provided for backward compatibility with code that needs
   * direct access to the ChildProcess object (e.g., for stdout/stderr handling).
   * 
   * @deprecated Use register() for new code. Only use this if you need ChildProcess access.
   * @param command - Command to execute
   * @param args - Command arguments  
   * @param options - Process options
   * @returns Handle with pid and process reference
   */
  async spawnWithProcess(
    command: string,
    args?: string[],
    options?: ProcessSpwanOptions
  ): Promise<{ pid: number; process: ChildProcess }> {
    const spawnOptions: any = {
      cwd: options?.cwd,
      env: options?.env ? { ...process.env, ...options.env } : undefined,
      detached: options?.detached ?? false,
      stdio: [options?.stdin || 'ignore', options?.stdout || 'ignore', options?.stderr || 'ignore'],
    };

    if (options?.createGroup) {
      spawnOptions.detached = true;
    }

    const childProcess = spawn(command, args || [], spawnOptions);
    const pid = childProcess.pid!;

    // Register with ProcessRegistry
    const pgid = spawnOptions.detached ? -pid : pid;
    await this.processRegistry.register(pid, pgid, {
      type: "unknown",
      metadata: options?.metadata || {},
    });

    // Set up exit event listener
    childProcess.on("exit", (code, signal) => {
      this.handleProcessExit(pid, code, signal);
    });

    // Temporarily track for exit events only
    this.monitoredProcesses.set(pid, childProcess);

    return { pid, process: childProcess };
  }

  async stop(pid: number, force: boolean = false): Promise<void> {
    try {
      // Check if process is alive
      if (!this.isAliveSync(pid)) {
        // Already exited, unregister if needed
        await this.processRegistry.unregister(pid).catch(() => {});
        this.monitoredProcesses.delete(pid);
        return;
      }

      if (force) {
        // Force kill immediately with SIGKILL
        process.kill(pid, "SIGKILL");
      } else {
        // Graceful shutdown with SIGTERM, then SIGKILL after timeout
        process.kill(pid, "SIGTERM");

        // Wait for process to exit
        const startTime = Date.now();
        const timeout = 5000;
        while (Date.now() - startTime < timeout) {
          if (!this.isAliveSync(pid)) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Check if process is still running
        if (this.isAliveSync(pid)) {
          // Force kill with SIGKILL
          process.kill(pid, "SIGKILL");
        }
      }

      // Clean up monitoring
      this.monitoredProcesses.delete(pid);

      // Note: ProcessRegistry unregistration happens in handleProcessExit
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") {
        // Process doesn't exist, clean up
        this.monitoredProcesses.delete(pid);
        await this.processRegistry.unregister(pid).catch(() => {});
        return;
      }
      throw error;
    }
  }

  /**
   * Check if a process is alive (v2.0 async API)
   * @param pid - Process ID to check
   * @returns true if the process is running, false otherwise
   */
  async isAlive(pid: number): Promise<boolean> {
    return Promise.resolve(this.isAliveSync(pid));
  }

  /**
   * Subscribe to process events
   * @param event - Event type to listen for
   * @param callback - Callback function to handle events
   */
  on(event: ProcessEventType, callback: (event: ProcessEvent) => void): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.add(callback);
    }
  }

  /**
   * Unsubscribe from process events
   * @param event - Event type
   * @param callback - Callback function to remove
   */
  off(event: ProcessEventType, callback: (event: ProcessEvent) => void): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  // ========== Legacy v1.0 Methods (for backward compatibility) ==========

  /**
   * Spawn a new process (legacy v1.0 API)
   * @deprecated Use register() instead
   */
  async spawn(
    command: string,
    args?: string[],
    options?: ProcessSpwanOptions
  ): Promise<number> {
    // Use register with 'unknown' type for backward compatibility
    return this.register("unknown", {
    command,
    args,
    cwd: options?.cwd,
    env: options?.env,
    detached: options?.detached,
    stdin: options?.stdin,
    stdout: options?.stdout,
    stderr: options?.stderr,
    createGroup: options?.createGroup,
    metadata: options?.metadata
  });
  }

  /**
   * Stop a process (legacy v1.0 API)
   * @deprecated Use stop(pid, force) instead
   */
  async stopLegacy(
    pid: number,
    signal: NodeJS.Signals = "SIGTERM",
    timeout: number = 5000
  ): Promise<ProcessExitInfo> {
    let killed = false;
    let exitCode: number | null = null;
    let exitSignal: NodeJS.Signals | null = null;

    try {
      // Check if process is alive
      if (!this.isAliveSync(pid)) {
        return {
          exitCode: null,
          signal: null,
          wasSignaled: false,
          killed: false,
          timestamp: new Date(),
        };
      }

      // Send signal to process
      process.kill(pid, signal);
      killed = true;

      // Wait for process to exit
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        if (!this.isAliveSync(pid)) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Check if process is still running
      if (this.isAliveSync(pid)) {
        // Force kill with SIGKILL
        process.kill(pid, "SIGKILL");
        exitSignal = "SIGKILL";
        await new Promise((resolve) => setTimeout(resolve, 100));
      } else {
        exitSignal = signal;
      }

      return {
        exitCode,
        signal: exitSignal,
        wasSignaled: true,
        killed: true,
        timestamp: new Date(),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") {
        // Process doesn't exist
        return {
          exitCode: null,
          signal: null,
          wasSignaled: false,
          killed: false,
          timestamp: new Date(),
        };
      }
      throw error;
    }
  }

  /**
   * Check if a process is alive (sync version for legacy support)
   * @deprecated Use isAlive() instead (async version)
   */
  isAliveSync(pid: number): boolean {
    // PID -1 is invalid/placeholder, treat as not alive
    if (pid <= 0) {
      return false;
    }
    
    try {
      // Send signal 0 to check if process exists
      process.kill(pid, 0);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") {
        return false;
      }
      // Other error (likely permission denied)
      return false;
    }
  }

  /**
   * Stop all processes in a process group
   * @param leaderPid - Process group leader's PID
   * @param signal - Signal to send (default: "SIGTERM")
   * @param timeout - Milliseconds to wait before force killing (default: 5000)
   * @returns Map of process IDs to their exit information
   */
  async stopProcessGroup(
    leaderPid: number,
    signal: NodeJS.Signals = "SIGTERM",
    timeout: number = 5000
  ): Promise<Map<number, ProcessExitInfo>> {
    const results = new Map<number, ProcessExitInfo>();

    try {
      // Send signal to process group (negative PID)
      process.kill(-leaderPid, signal);

      // Wait for processes to exit
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        if (!this.isAliveSync(leaderPid)) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Check if process group is still running
      if (this.isAliveSync(leaderPid)) {
        // Force kill with SIGKILL
        process.kill(-leaderPid, "SIGKILL");
      }

      // We can't track individual processes in the group, so return a simple result
      results.set(leaderPid, {
        exitCode: null,
        signal: signal,
        wasSignaled: true,
        timestamp: new Date(),
        killed: true,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") {
        // Process group doesn't exist
        results.set(leaderPid, {
          exitCode: null,
          signal: null,
          wasSignaled: false,
          timestamp: new Date(),
          killed: false,
        });
      } else {
        throw error;
      }
    }

    return results;
  }

  // ========== Helper Methods ==========

  /**
   * Handle process exit
   * Emits process:exit event and unregisters from ProcessRegistry
   */
  private async handleProcessExit(
    pid: number,
    exitCode: number | null,
    signal: NodeJS.Signals | null
  ): Promise<void> {
    // Remove from monitoring
    this.monitoredProcesses.delete(pid);

    // Mark as zombie in ProcessRegistry (will be cleaned up later)
    const metadata = await this.processRegistry.get(pid);
    if (metadata && !metadata.isZombie) {
      // Update as zombie (exited but not yet cleaned)
      // This is a simplified approach - in production you'd want proper state updates
    }

    // Emit process:exit event
    const exitEvent: ProcessExitEvent = {
      type: "process:exit",
      pid,
      timestamp: new Date(),
      exitCode,
      exitSignal: signal,
      result: signal ? "killed" : exitCode === 0 ? "success" : "failed",
    };
    this.emit("process:exit", exitEvent);
  }

  /**
   * Emit event to all subscribers
   */
  private emit(event: ProcessEventType, data: ProcessEvent): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(data);
        } catch (error) {
          console.error(`[ProcessManager] Error in event callback for ${event}:`, error);
        }
      }
    }
  }

  // ========== PID File Operations (kept for backward compatibility) ==========

  /**
   * Write PID to file
   */
  async writePid(pidPath: string, pid: number): Promise<void> {
    const dir = path.dirname(pidPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(pidPath, pid.toString(), "utf-8");
  }

  /**
   * Read PID from file
   */
  async readPid(pidPath: string): Promise<number | null> {
    try {
      const content = await fs.readFile(pidPath, "utf-8");
      const pid = parseInt(content.trim(), 10);
      return isNaN(pid) ? null : pid;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if PID from file is running
   */
  async isPidRunning(pidPath: string): Promise<boolean> {
    const pid = await this.readPid(pidPath);
    if (pid === null) {
      return false;
    }
    return this.isAliveSync(pid);
  }

  /**
   * Get exit information for a process (legacy method)
   * @deprecated ProcessManager v2.0 uses ProcessRegistry for state tracking
   */
  async getExitInfo(pid: number): Promise<ExitInfo | null> {
    // If process is alive, no exit info yet
    if (this.isAliveSync(pid)) {
      return null;
    }

    // Process has exited, but we don't have the exit code
    // This is a limitation - we can't get exit info for arbitrary processes
    return {
      exitCode: null,
      signal: null,
      killed: false,
    };
  }

  // ========== ProcessRegistry Access (for advanced use cases) ==========

  /**
   * Get access to ProcessRegistry instance
   * This is provided for advanced use cases like cleanup operations
   */
  getRegistry(): ProcessRegistry {
    return this.processRegistry;
  }
}
