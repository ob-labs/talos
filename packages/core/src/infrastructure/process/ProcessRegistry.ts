/**
 * ProcessRegistry - Centralized Process Metadata Tracking
 *
 * Infrastructure service for tracking all child process metadata.
 * Provides centralized registry with persistence and zombie cleanup.
 *
 * RESPONSIBILITIES:
 * - Register process metadata (pid, pgid, startedAt, metadata, type)
 * - Query processes by pid, type, or list all
 * - Unregister processes on exit
 * - Cleanup zombie processes
 * - Persist metadata to ~/.talos/processes/registry.json using atomic writes
 *
 * DESIGN PRINCIPLES:
 * - Atomic writes for data integrity
 * - In-memory cache for fast queries
 * - File-based persistence for recovery
 * - Zombie detection via callback
 * - Event-driven cleanup
 *
 * @example
 * ```typescript
 * const registry = new ProcessRegistry();
 *
 * // Register a process
 * await registry.register(12345, -12345, {
 *   type: 'task',
 *   taskId: 'task-123',
 *   prdId: 'prd-456'
 * });
 *
 * // Query processes
 * const process = await registry.get(12345);
 * const tasks = await registry.findByType('task');
 * const all = await registry.listAll();
 *
 * // Cleanup zombies
 * await registry.cleanupZombieProcesses((pid) => processManager.isAlive(pid));
 *
 * // Unregister on exit
 * await registry.unregister(12345);
 * ```
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

/**
 * Process metadata type
 */
export type RegisteredProcessType = "task" | "daemon" | "ui" | "ralph" | "unknown";

/**
 * Process metadata interface
 */
export interface ProcessMetadata {
  /** Process ID */
  pid: number;
  /** Process group ID (negative for process group leaders) */
  pgid: number;
  /** Process start timestamp */
  startedAt: number;
  /** Process type */
  type: RegisteredProcessType;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Whether process is a zombie (exited but not cleaned) */
  isZombie?: boolean;
  /** Exit timestamp (if known) */
  exitedAt?: number;
}

/**
 * Process registry state
 */
interface ProcessRegistryState {
  /** All registered processes */
  processes: Record<number, ProcessMetadata>;
  /** Last updated timestamp */
  lastUpdated: number;
}

/**
 * Options for ProcessRegistry
 */
export interface ProcessRegistryOptions {
  /** Base path for registry file (default: ~/.talos) */
  basePath?: string;
  /** Registry file name (default: registry.json) */
  registryFileName?: string;
  /** Auto-cleanup interval in ms (default: disabled) */
  autoCleanupInterval?: number;
}

/**
 * Process Registry
 *
 * Centralized service for tracking process metadata with persistence.
 */
export class ProcessRegistry {
  private registryPath: string;
  private state: ProcessRegistryState;
  private autoCleanupTimer?: NodeJS.Timeout;

  constructor(options?: ProcessRegistryOptions) {
    const basePath = options?.basePath || path.join(os.homedir(), ".talos");
    const processesDir = path.join(basePath, "processes");
    const registryFileName = options?.registryFileName || "registry.json";
    this.registryPath = path.join(processesDir, registryFileName);

    this.state = {
      processes: {},
      lastUpdated: Date.now(),
    };

    // Setup auto-cleanup if interval is specified
    if (options?.autoCleanupInterval) {
      this.startAutoCleanup(options.autoCleanupInterval);
    }
  }

  /**
   * Initialize registry by loading from disk
   */
  async init(): Promise<void> {
    await this.load();
  }

  /**
   * Register a process
   * @param pid - Process ID
   * @param pgid - Process group ID
   * @param metadata - Process metadata
   */
  async register(
    pid: number,
    pgid: number,
    metadata: Omit<ProcessMetadata, "pid" | "pgid" | "startedAt" | "isZombie" | "exitedAt">
  ): Promise<void> {
    this.state.processes[pid] = {
      pid,
      pgid,
      startedAt: Date.now(),
      isZombie: false,
      ...metadata,
    };
    this.state.lastUpdated = Date.now();
    await this.save();
  }

  /**
   * Unregister a process
   * @param pid - Process ID to unregister
   */
  async unregister(pid: number): Promise<void> {
    delete this.state.processes[pid];
    this.state.lastUpdated = Date.now();
    await this.save();
  }

  /**
   * Get process metadata by PID
   * @param pid - Process ID
   * @returns Process metadata or undefined
   */
  async get(pid: number): Promise<ProcessMetadata | undefined> {
    return this.state.processes[pid];
  }

  /**
   * Find processes by type
   * @param type - Process type
   * @returns Array of process metadata
   */
  async findByType(type: RegisteredProcessType): Promise<ProcessMetadata[]> {
    return Object.values(this.state.processes).filter(
      (process) => process.type === type
    );
  }

  /**
   * List all registered processes
   * @returns Array of all process metadata
   */
  async listAll(): Promise<ProcessMetadata[]> {
    return Object.values(this.state.processes);
  }

  /**
   * Cleanup zombie processes
   * Marks processes as zombies if they are no longer alive
   * @param aliveCallback - Callback to check if process is alive
   * @returns Number of zombies marked
   */
  async cleanupZombieProcesses(
    aliveCallback: (pid: number) => boolean
  ): Promise<number> {
    let zombiesMarked = 0;

    for (const [pid, metadata] of Object.entries(this.state.processes)) {
      const pidNum = parseInt(pid, 10);

      // Skip if already marked as zombie
      if (metadata.isZombie) {
        continue;
      }

      // Check if process is still alive
      if (!aliveCallback(pidNum)) {
        // Mark as zombie
        this.state.processes[pidNum].isZombie = true;
        this.state.processes[pidNum].exitedAt = Date.now();
        zombiesMarked++;
      }
    }

    if (zombiesMarked > 0) {
      this.state.lastUpdated = Date.now();
      await this.save();
    }

    return zombiesMarked;
  }

  /**
   * Remove zombie processes from registry
   * @returns Number of zombies removed
   */
  async removeZombies(): Promise<number> {
    let removed = 0;

    for (const [pid, metadata] of Object.entries(this.state.processes)) {
      if (metadata.isZombie) {
        delete this.state.processes[parseInt(pid, 10)];
        removed++;
      }
    }

    if (removed > 0) {
      this.state.lastUpdated = Date.now();
      await this.save();
    }

    return removed;
  }

  /**
   * Get all zombie processes
   * @returns Array of zombie process metadata
   */
  async getZombies(): Promise<ProcessMetadata[]> {
    return Object.values(this.state.processes).filter(
      (process) => process.isZombie
    );
  }

  /**
   * Get process count by type
   * @param type - Process type
   * @returns Number of processes of this type
   */
  async countByType(type: RegisteredProcessType): Promise<number> {
    return Object.values(this.state.processes).filter(
      (process) => process.type === type
    ).length;
  }

  /**
   * Get total process count
   * @returns Total number of processes
   */
  async totalCount(): Promise<number> {
    return Object.keys(this.state.processes).length;
  }

  /**
   * Load registry state from disk
   */
  private async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.registryPath, "utf-8");
      this.state = JSON.parse(content) as ProcessRegistryState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // Registry doesn't exist yet, start fresh
        this.state = {
          processes: {},
          lastUpdated: Date.now(),
        };
      } else {
        // Log but don't fail - start with empty state
        console.error(
          `[ProcessRegistry] Failed to load registry from ${this.registryPath}:`,
          error
        );
        this.state = {
          processes: {},
          lastUpdated: Date.now(),
        };
      }
    }
  }

  /**
   * Save registry state to disk using atomic writes
   */
  private async save(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.registryPath);
      await fs.mkdir(dir, { recursive: true });

      // Write to temporary file first (atomic write)
      const tempPath = `${this.registryPath}.tmp`;
      const content = JSON.stringify(this.state, null, 2);
      await fs.writeFile(tempPath, content, "utf-8");

      // Rename temp file to target (atomic operation)
      await fs.rename(tempPath, this.registryPath);
    } catch (error) {
      console.error(
        `[ProcessRegistry] Failed to save registry to ${this.registryPath}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Start auto-cleanup timer
   * @param interval - Cleanup interval in ms
   */
  private startAutoCleanup(interval: number): void {
    this.autoCleanupTimer = setInterval(async () => {
      // Note: This requires aliveCallback to be set separately
      // For now, this is a placeholder for future enhancement
      console.warn(
        "[ProcessRegistry] Auto-cleanup not implemented yet - use cleanupZombieProcesses() manually"
      );
    }, interval);
  }

  /**
   * Stop auto-cleanup timer
   */
  stopAutoCleanup(): void {
    if (this.autoCleanupTimer) {
      clearInterval(this.autoCleanupTimer);
      this.autoCleanupTimer = undefined;
    }
  }

  /**
   * Clear all processes from registry
   */
  async clear(): Promise<void> {
    this.state.processes = {};
    this.state.lastUpdated = Date.now();
    await this.save();
  }

  /**
   * Get registry statistics
   * @returns Registry statistics
   */
  async getStats(): Promise<{
    totalCount: number;
    zombieCount: number;
    countsByType: Record<RegisteredProcessType, number>;
  }> {
    const processes = Object.values(this.state.processes);
    const zombies = processes.filter((p) => p.isZombie);

    const countsByType: Record<RegisteredProcessType, number> = {
      task: 0,
      daemon: 0,
      ui: 0,
      ralph: 0,
      unknown: 0,
    };

    for (const process of processes) {
      countsByType[process.type]++;
    }

    return {
      totalCount: processes.length,
      zombieCount: zombies.length,
      countsByType,
    };
  }
}
