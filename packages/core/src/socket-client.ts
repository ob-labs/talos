/**
 * Unix Socket Client for Talos
 *
 * 提供 Unix Socket 客户端，用于 CLI 与 Talos 通信。
 */

import { connect } from "net";
import { promises as fs } from "fs";
import * as path from "path";
import { homedir } from "os";
import type { SocketRequest, SocketResponse } from "./index";
import type { ToolType } from "@talos/types";

/**
 * Socket client options
 */
export interface SocketClientOptions {
  /** Socket file path (default: ~/.talos/talos.sock) */
  socketPath?: string;
  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number;
}

/**
 * Unix Socket Client
 */
export class SocketClient {
  private socketPath: string;
  private timeout: number;

  /**
   * Create a new SocketClient
   *
   * @param options - Client options
   */
  constructor(options: SocketClientOptions = {}) {
    this.socketPath = options.socketPath || path.join(homedir(), ".talos", "talos.sock");
    this.timeout = options.timeout || 5000;
  }

  /**
   * Send request to Talos
   *
   * @param request - Socket request
   * @returns Socket response
   */
  async send(request: SocketRequest): Promise<SocketResponse> {
    return new Promise((resolve, reject) => {
      const client = connect(this.socketPath);

      // Set timeout
      const timeoutId = setTimeout(() => {
        client.destroy();
        reject(new Error(`Socket timeout after ${this.timeout}ms`));
      }, this.timeout);

      // Handle connection
      client.on("connect", () => {
        // Send request
        client.write(JSON.stringify(request) + "\n");
      });

      // Handle response
      let buffer = "";
      client.on("data", (data: Buffer) => {
        buffer += data.toString();

        // Try to parse complete messages
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const message = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          try {
            const response = JSON.parse(message) as SocketResponse;
            clearTimeout(timeoutId);
            client.destroy();
            resolve(response);
            return;
          } catch (error) {
            // Ignore parse errors, wait for more data
          }
        }
      });

      // Handle errors
      client.on("error", (error) => {
        clearTimeout(timeoutId);
        client.destroy();
        reject(new Error(`Socket error: ${error.message}`));
      });

      // Handle close
      client.on("close", () => {
        clearTimeout(timeoutId);
        if (buffer.length > 0) {
          try {
            const response = JSON.parse(buffer) as SocketResponse;
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${buffer}`));
          }
        }
      });
    });
  }

  /**
   * Ping Talos
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.send({ action: "ping" });
      return response.success && response.data?.message === "pong";
    } catch {
      return false;
    }
  }

  /**
   * Get task status
   *
   * @param processId - Process ID
   * @returns Process state file
   */
  async getTaskStatus(processId: string): Promise<any> {
    const response = await this.send({
      action: "get_status",
      processId,
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to get task status");
    }

    return response.data;
  }

  /**
   * List all tasks
   *
   * @returns Array of process state files
   */
  async listTasks(): Promise<any[]> {
    const response = await this.send({
      action: "list_tasks",
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to list tasks");
    }

    return response.data;
  }

  /**
   * Check if Talos is running
   */
  async isTalosRunning(): Promise<boolean> {
    try {
      // Check if socket file exists
      await fs.access(this.socketPath);

      // Try to ping
      return await this.ping();
    } catch {
      return false;
    }
  }

  /**
   * Start a task
   * 启动任务
   *
   * @param prdId - PRD identifier
   * @param workingDir - Working directory
   * @returns Socket response
   */
  async startTask(prdId: string, workingDir: string, options?: { debug?: boolean; tool?: ToolType }): Promise<SocketResponse> {
    return this.send({
      action: "start_task",
      prdId,
      workingDir,
      debug: options?.debug ?? false,
      tool: options?.tool,
    });
  }

  /**
   * Resume a task
   * 恢复任务
   *
   * @param processId - Process ID
   * @returns Socket response
   */
  async resumeTask(processId: string, options?: { debug?: boolean; tool?: ToolType }): Promise<SocketResponse> {
    return this.send({
      action: "resume_task",
      processId,
      reason: "Task resume requested by CLI",
      debug: options?.debug ?? false,
      tool: options?.tool,
    });
  }

  /**
   * Start Web UI
   * 启动 Web UI
   *
   * @param port - Port to run UI on (default: 3000)
   * @returns Socket response with UI process info
   */
  /**
   * Start Web UI
   * 启动 Web UI
   *
   * @param port - Port to run UI on (default: 3000)
   * @returns Socket response with UI process info
   */
  /**
   * Start Web UI
   * 启动 Web UI
   *
   * @param port - Port to run UI on (default: 3000)
   * @param serverPath - Path to the standalone server.js file
   * @returns Socket response with UI process info
   */
  async startUI(port?: number, serverPath?: string): Promise<SocketResponse> {
    return this.send({
      action: "start_ui",
      port: port ?? 3000,
      serverPath,
    });
  }

  /**
   * Stop Web UI
   * 停止 Web UI
   *
   * @returns Socket response
   */
  async stopUI(): Promise<SocketResponse> {
    return this.send({
      action: "stop_ui",
    });
  }

  /**
   * Get Web UI status
   * 获取 Web UI 状态
   *
   * @returns Socket response with UI status
   */
  async getUIStatus(): Promise<SocketResponse> {
    return this.send({
      action: "get_ui_status",
    });
  }
}
