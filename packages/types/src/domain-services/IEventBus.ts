/**
 * IEventBus - Event Bus Interface
 *
 * Domain service for event-driven communication.
 * Implements publish-subscribe pattern for domain events.
 *
 * RESPONSIBILITIES:
 * - Event registration and emission
 * - Event listener management
 * - Cross-module communication
 * - Decoupling of components
 *
 * USE CASES:
 * - Notify subscribers when task status changes
 * - Broadcast story execution progress
 * - Signal worktree creation/deletion
 * - Alert on system events
 *
 * @example
 * ```typescript
 * // Subscribe to events
 * eventBus.on('task:started', (data) => {
 *   console.log('Task started:', data.taskId);
 * });
 *
 * // Publish events
 * eventBus.emit('task:started', { taskId: 'task-123', timestamp: Date.now() });
 *
 * // Unsubscribe
 * eventBus.off('task:started', handler);
 * ```
 */
export interface IEventBus {
  /**
   * Register event listener
   *
   * @param event - Event name (supports wildcards: 'task:*')
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on(event: string, handler: EventHandler): UnsubscribeFunction;

  /**
   * Register one-time event listener
   * Listener is automatically removed after first invocation
   *
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  once(event: string, handler: EventHandler): UnsubscribeFunction;

  /**
   * Unregister event listener
   *
   * @param event - Event name
   * @param handler - Event handler function to remove
   */
  off(event: string, handler: EventHandler): void;

  /**
   * Emit event to all subscribers
   *
   * @param event - Event name
   * @param data - Event payload data
   */
  emit(event: string, data?: unknown): void;

  /**
   * Remove all listeners for an event
   * If no event specified, removes all listeners
   *
   * @param event - Optional event name
   */
  removeAllListeners(event?: string): void;

  /**
   * Get listener count for an event
   *
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount(event: string): number;

  /**
   * Get all registered event names
   *
   * @returns Array of event names
   */
  eventNames(): string[];
}

/**
 * Event handler function
 */
export type EventHandler = (data?: unknown) => void | Promise<void>;

/**
 * Unsubscribe function
 * Call to remove event listener
 */
export type UnsubscribeFunction = () => void;

/**
 * Domain event types
 * Standardized event names for consistency
 */
export enum DomainEvent {
  // Task events
  TASK_CREATED = "task:created",
  TASK_STARTED = "task:started",
  TASK_COMPLETED = "task:completed",
  TASK_FAILED = "task:failed",
  TASK_STOPPED = "task:stopped",

  // Story events
  STORY_STARTED = "story:started",
  STORY_COMPLETED = "story:completed",
  STORY_FAILED = "story:failed",

  // PRD events
  PRD_CREATED = "prd:created",
  PRD_STARTED = "prd:started",
  PRD_COMPLETED = "prd:completed",

  // Worktree events
  WORKTREE_CREATED = "worktree:created",
  WORKTREE_DELETED = "worktree:deleted",
  WORKTREE_SYNCED = "worktree:synced",

  // Workspace events
  WORKSPACE_ADDED = "workspace:added",
  WORKSPACE_REMOVED = "workspace:removed",

  // System events
  SYSTEM_STARTUP = "system:startup",
  SYSTEM_SHUTDOWN = "system:shutdown",
  SYSTEM_ERROR = "system:error",
}

/**
 * Task event payload types
 */
export interface TaskEventPayload {
  taskId: string;
  prdId?: string;
  storyId?: string;
  timestamp: number;
  error?: string;
}

/**
 * Story event payload types
 */
export interface StoryEventPayload {
  storyId: string;
  storyTitle: string;
  prdId: string;
  timestamp: number;
  duration?: number;
  error?: string;
}

/**
 * PRD event payload types
 */
export interface PRDEventPayload {
  prdId: string;
  projectName: string;
  timestamp: number;
  totalStories?: number;
  completedStories?: number;
}
