/**
 * UIManager - UI Server Management
 *
 * Wrapper for UI server operations (start, stop, status).
 * Extracted from Talos to enable dependency injection in SocketServer.
 *
 * RESPONSIBILITIES:
 * - Start UI server process
 * - Stop UI server process
 * - Query UI server status
 * - Manage UI process state in storage
 */

import type { IProcessManager, ILogger } from "@talos/types";
import { StorageManager } from "../../storage";

/**
 * UIManager dependencies
 */
export interface UIManagerDependencies {
  /**
   * Process manager for spawning/stopping UI process
   */
  processManager: IProcessManager;

  /**
   * Storage manager for UI state persistence
   */
  storageManager: StorageManager;

  /**
   * Logger for logging
   */
  logger: ILogger;
}

/**
 * UIManager - Manages UI server operations
 */
export class UIManager {
  private processManager: IProcessManager;
  private storageManager: StorageManager;
  private logger: ILogger;

  constructor(deps: UIManagerDependencies) {
    this.processManager = deps.processManager;
    this.storageManager = deps.storageManager;
    this.logger = deps.logger;
  }

  /**
   * Start UI server
   *
   * @param port - Port to run UI server on
   * @param serverPath - Path to standalone server.js file
   * @returns Promise with start result
   */
  async startUI(port?: number, serverPath?: string): Promise<{
    success: boolean;
    port?: number;
    message?: string;
  }> {
    try {
      const targetPort = port || 3000;

      // Check if UI is already running
      const existingUI = await this.storageManager.getUIProcessState();
      if (existingUI && existingUI.pid) {
        const isAlive = this.processManager.isAliveSync(existingUI.pid);
        if (isAlive) {
          return {
            success: false,
            message: `UI is already running on PID ${existingUI.pid} (port ${existingUI.port})`,
          };
        }
        // Process died, clean up state
        await this.storageManager.clearUIProcessState();
      }

      // Check if port is available
      const portAvailable = await this.isPortAvailable(targetPort);
      if (!portAvailable) {
        return {
          success: false,
          message: `Port ${targetPort} is already in use. Please specify a different port.`,
        };
      }

      if (!serverPath) {
        return {
          success: false,
          message: "Server path is required. Please use 'talos ui start' from the CLI.",
        };
      }

      // Verify server file exists
      const fs = await import("fs/promises");
      try {
        await fs.access(serverPath);
      } catch (error) {
        return {
          success: false,
          message: `Standalone server file not found: ${serverPath}. Please run 'pnpm run build' in the @talos/web package.`,
        };
      }

      this.logger.info(`🚀 Starting Web UI on port ${targetPort}`);

      // Spawn UI server process
      const pid = await this.processManager.spawn(
        "node",
        [serverPath, "--port", String(targetPort)],
        {
          cwd: process.cwd(),
          detached: true,
          stdin: "ignore", stdout: "pipe", stderr: "pipe",
          createGroup: true,
          env: {
            ...process.env,
            NODE_ENV: "production",
          },
        }
      );

      // Wait a bit for process to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify process is still alive
      const isAlive = this.processManager.isAliveSync(pid);
      if (!isAlive) {
        return {
          success: false,
          message: "UI server process failed to start. Check logs for details.",
        };
      }

      // Save UI process state
      await this.storageManager.setUIProcessState({
        pid,
        port: targetPort,
        startTime: Date.now(),
      });

      this.logger.info(`✅ UI server started: PID=${pid}, port=${targetPort}`);
      return {
        success: true,
        port: targetPort,
        message: `UI server started (PID ${pid}, port ${targetPort})`,
      };
    } catch (error) {
      this.logger.error(`Failed to start UI: ${error}`);
      return {
        success: false,
        message: `Failed to start UI: ${error}`,
      };
    }
  }

  /**
   * Stop UI server
   *
   * @returns Promise with stop result
   */
  async stopUI(): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      this.logger.info(`🛑 Stopping Web UI`);

      const uiState = await this.storageManager.getUIProcessState();
      if (!uiState || !uiState.pid) {
        return { success: false, message: "UI is not running" };
      }

      const { pid } = uiState;

      // Check if process is alive
      const isAlive = this.processManager.isAliveSync(pid);
      if (!isAlive) {
        // Process already dead, clear state
        await this.storageManager.clearUIProcessState();
        return { success: true, message: "UI process was already stopped" };
      }

      // Stop the process group
      await this.processManager.stopProcessGroup(pid, "SIGTERM");
      this.logger.info(`📤 Sent SIGTERM to UI process group: -${pid}`);

      // Wait for graceful shutdown
      const timeout = 5000;
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        if (!this.processManager.isAliveSync(pid)) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Force kill if still running
      if (this.processManager.isAliveSync(pid)) {
        this.logger.warn(`⚠️  UI process did not exit gracefully, force killing`);
        await this.processManager.stop(pid, true);
      }

      // Clear UI state
      await this.storageManager.clearUIProcessState();

      this.logger.info(`✅ UI stopped: PID=${pid}`);
      return { success: true, message: `UI stopped (PID ${pid})` };
    } catch (error) {
      this.logger.error(`Failed to stop UI: ${error}`);
      return {
        success: false,
        message: `Failed to stop UI: ${error}`,
      };
    }
  }

  /**
   * Get UI server status
   *
   * @returns Promise with UI status
   */
  async getUIStatus(): Promise<{
    running: boolean;
    port?: number;
    pid?: number;
    url?: string;
  }> {
    const uiState = await this.storageManager.getUIProcessState();
    if (!uiState || !uiState.pid) {
      return { running: false };
    }

    const isAlive = this.processManager.isAliveSync(uiState.pid);
    if (!isAlive) {
      // Process died, clear state
      await this.storageManager.clearUIProcessState();
      return { running: false };
    }

    return {
      running: true,
      port: uiState.port,
      pid: uiState.pid,
    };
  }

  /**
   * Check if a port is available
   *
   * @param port - Port number to check
   * @returns Promise<boolean> - true if port is available, false if occupied
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    const net = await import("net");
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          resolve(false);
        } else {
          resolve(true);
        }
      });

      server.once("listening", () => {
        server.close();
        resolve(true);
      });

      server.listen(port, "127.0.0.1");
    });
  }
}
