/**
 * Talos Socket Client for Web App
 *
 * Provides a client for communicating with the Talos daemon via Unix socket.
 * Used by Web API routes to perform task operations.
 */

import { connect } from 'net';
import { promises as fs } from 'fs';
import * as path from 'path';
import { homedir } from 'os';

export interface SocketRequest {
  action: string;
  [key: string]: unknown;
}

export interface SocketResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface Task {
  id: string;
  pid?: number;
  status: string;
  workingDir: string;
  prdId?: string;
}

export interface TaskStartRequest {
  prdId: string;
  workingDir: string;
  debug?: boolean;
  tool?: string;
  model?: string;
}

export interface TaskStopRequest {
  taskId: string;
  reason?: string;
}

export interface TaskResumeRequest {
  taskId: string;
  debug?: boolean;
  tool?: string;
  model?: string;
}

/**
 * Talos Socket Client
 */
export class TalosSocketClient {
  private socketPath: string;
  private timeout: number;

  constructor(options: { socketPath?: string; timeout?: number } = {}) {
    this.socketPath = options.socketPath || path.join(homedir(), '.talos', 'talos.sock');
    this.timeout = options.timeout || 30000;
  }

  /**
   * Send request to Talos daemon
   */
  private async sendRequest(request: SocketRequest): Promise<SocketResponse> {
    return new Promise((resolve, reject) => {
      const client = connect(this.socketPath);
      let buffer = '';

      // Set timeout
      const timeoutId = setTimeout(() => {
        client.destroy();
        reject(new Error(`Request timeout after ${this.timeout}ms`));
      }, this.timeout);

      // Handle connection
      client.on('connect', () => {
        client.write(JSON.stringify(request) + '\n');
      });

      // Handle response
      client.on('data', (data: Buffer) => {
        buffer += data.toString();

        // Try to parse complete messages
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const messageStr = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          try {
            const response = JSON.parse(messageStr) as SocketResponse;
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
      client.on('error', (error) => {
        clearTimeout(timeoutId);
        client.destroy();
        reject(new Error(`Socket error: ${error.message}`));
      });

      // Handle close
      client.on('close', () => {
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
   * Check if daemon is running
   */
  async isDaemonRunning(): Promise<boolean> {
    try {
      await fs.access(this.socketPath);
      const response = await this.sendRequest({ action: 'ping' });
      return response.success;
    } catch {
      return false;
    }
  }

  /**
   * Start a new task
   */
  async startTask(request: TaskStartRequest): Promise<Task> {
    const response = await this.sendRequest({
      action: 'start_task',
      prdId: request.prdId,
      workingDir: request.workingDir,
      debug: request.debug,
      tool: request.tool,
      model: request.model,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to start task');
    }

    return response.data as Task;
  }

  /**
   * Stop a running task
   */
  async stopTask(request: TaskStopRequest): Promise<void> {
    const response = await this.sendRequest({
      action: 'stop_task',
      processId: request.taskId,
      reason: request.reason,
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to stop task');
    }
  }

  /**
   * Resume a stopped task
   */
  async resumeTask(request: TaskResumeRequest): Promise<void> {
    const response = await this.sendRequest({
      action: 'resume_task',
      processId: request.taskId,
      debug: request.debug,
      tool: request.tool,
      model: request.model,
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to resume task');
    }
  }

  /**
   * Get task status
   */
  async getTaskStatus(taskId: string): Promise<Task> {
    const response = await this.sendRequest({
      action: 'get_status',
      processId: taskId,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get task status');
    }

    return response.data as Task;
  }

  /**
   * List all tasks
   */
  async listTasks(): Promise<Task[]> {
    const response = await this.sendRequest({
      action: 'list_tasks',
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to list tasks');
    }

    return response.data as Task[];
  }

  /**
   * Remove a task
   */
  async removeTask(taskId: string): Promise<void> {
    const response = await this.sendRequest({
      action: 'delete_task',
      processId: taskId,
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to remove task');
    }
  }
}

// Singleton instance
let clientInstance: TalosSocketClient | null = null;

export function getTalosClient(): TalosSocketClient {
  if (!clientInstance) {
    clientInstance = new TalosSocketClient();
  }
  return clientInstance;
}
