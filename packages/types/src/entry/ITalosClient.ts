/**
 * Entry Layer: Talos Client Interface
 *
 * Defines the contract for client communication with the Talos daemon.
 * Provides a unified API for task management and monitoring.
 *
 * This interface abstracts the underlying transport mechanism (Socket, HTTP, etc.)
 * and provides a high-level API for interacting with Talos.
 */

import type { ITask } from '../entities/ITask';

/**
 * Health check result for task health monitoring
 */
export interface HealthCheckResult {
  /** Whether the task is healthy */
  isHealthy: boolean;
  /** Health status message */
  status?: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Task filters for listing tasks
 */
export interface TaskFilters {
  /** Filter by task status */
  status?: string;
  /** Filter by PRD ID */
  prdId?: string;
  /** Filter by working directory */
  workingDir?: string;
}

/**
 * Task start request
 */
export interface StartTaskRequest {
  /** PRD identifier */
  prdId: string;
  /** Working directory path */
  workingDir: string;
  /** Additional options */
  options?: Record<string, unknown>;
}

/**
 * Task stop request
 */
export interface StopTaskRequest {
  /** Task ID to stop */
  taskId: string;
  /** Optional reason for stopping */
  reason?: string;
}

/**
 * Task resume request
 */
export interface ResumeTaskRequest {
  /** Task ID to resume */
  taskId: string;
  /** Additional options */
  options?: Record<string, unknown>;
}

/**
 * Event subscription callback
 */
export type EventCallback = (event: unknown) => void;

/**
 * Talos Client Interface
 *
 * Provides methods for managing tasks and subscribing to events.
 * Implementations handle the underlying transport protocol.
 */
export interface ITalosClient {
  /**
   * Connect to Talos daemon
   *
   * @throws {Error} If connection fails
   */
  connect(): Promise<void>;

  /**
   * Disconnect from Talos daemon
   */
  disconnect(): Promise<void>;

  /**
   * Check if client is connected
   */
  isConnected(): boolean;

  /**
   * Start a new task
   *
   * @param request - Task start request
   * @returns Created task
   */
  startTask(request: StartTaskRequest): Promise<ITask>;

  /**
   * Stop a running task
   *
   * @param request - Task stop request
   */
  stopTask(request: StopTaskRequest): Promise<void>;

  /**
   * Resume a stopped task
   *
   * @param request - Task resume request
   */
  resumeTask(request: ResumeTaskRequest): Promise<void>;

  /**
   * Get task status
   *
   * @param taskId - Task ID
   * @returns Task with current status
   */
  getTaskStatus(taskId: string): Promise<ITask>;

  /**
   * List all tasks
   *
   * @param filters - Optional task filters
   * @returns Array of tasks
   */
  listTasks(filters?: TaskFilters): Promise<ITask[]>;

  /**
   * Remove a task and its resources
   *
   * @param taskId - Task ID to remove
   */
  removeTask(taskId: string): Promise<void>;

  /**
   * Clear all failed tasks
   *
   * @returns Number of tasks cleared
   */
  clearFailedTasks(): Promise<number>;

  /**
   * Get task health check
   *
   * @param taskId - Task ID
   * @returns Health check result
   */
  getTaskHealth(taskId: string): Promise<HealthCheckResult>;

  /**
   * Shutdown Talos daemon gracefully
   *
   * Sends a shutdown request to the daemon, which will stop all tasks
   * and exit gracefully. The client should not expect a response after
   * the shutdown is initiated.
   */
  shutdownDaemon(): Promise<void>;

  /**
   * Subscribe to events
   *
   * @param eventType - Type of event to subscribe to
   * @param callback - Event callback function
   * @returns Subscription ID for unsubscribing
   */
  subscribe(eventType: string, callback: EventCallback): string;

  /**
   * Unsubscribe from events
   *
   * @param subscriptionId - Subscription ID from subscribe()
   */
  unsubscribe(subscriptionId: string): void;
}
