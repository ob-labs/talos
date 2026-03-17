/**
 * ITask - Task Entity Interface
 *
 * Rich domain model for Task execution units with state transition logic.
 * Implements the Entity pattern from Domain-Driven Design.
 *
 * STATE TRANSITIONS:
 * pending → running → completed
 *                    ↘ failed
 *
 * Any state → stopped (via stop())
 *
 * @example
 * ```typescript
 * class TaskImpl implements ITask {
 *   // ... implement state transition methods with validation
 *   start() {
 *     if (this.status !== 'pending') {
 *       throw new Error('Cannot start task from ' + this.status);
 *     }
 *     this.status = 'running';
 *     this.startedAt = Date.now();
 *   }
 * }
 * ```
 */

// Import TaskMessage from existing types to avoid conflict
import type { TaskMessage } from "../index";
import type { IPRD } from "./IPRD";
import type { IWorktree } from "./IWorktree";
import type { ToolType } from "../index";

export interface ITask {
  /**
   * Unique task identifier
   */
  id: string;

  /**
   * Current task status
   * State transitions are controlled via methods below
   */
  status: TaskStatus;

  /**
   * Task title/description
   */
  title: string;

  /**
   * Detailed task description
   */
  description: string;

  /**
   * Conversation history for this task
   */
  conversation: TaskMessage[];

  /**
   * Task creation timestamp
   */
  timestamp: number;

  /**
   * Task start time (set when started)
   */
  startedAt?: number;

  /**
   * Task completion time (set when completed or failed)
   */
  completedAt?: number;

  /**
   * Associated user story identifier
   */
  storyId?: string;

  /**
   * Role/Claude Code agent executing this task
   */
  role?: string;

  /**
   * Error message if task failed
   */
  error?: string;

  /**
   * PRD entity
   */
  prd: IPRD;

  /**
   * Command to execute
   */
  command: string;

  /**
   * Tool to use (claude or cursor)
   */
  tool?: ToolType;

  /**
   * Workspace name
   */
  workspace: string;

  /**
   * Branch name
   */
  branch: string;

  /**
   * Worktree entity
   */
  worktree?: IWorktree;

  /**
   * Repository root path
   */
  repoRoot?: string;

  /**
   * Process ID
   */
  pid?: number;

  /**
   * Process identifier (string form)
   */
  processId?: string;

  /**
   * Task progress
   */
  progress?: {
    total: number;
    passing: number;
    incomplete: number;
  };

  /**
   * Get PRD ID
   * Returns the PRD identifier for this task
   */
  getPrdId(): string;

  // ============================================
  // State Transition Methods (Domain Logic)
  // ============================================

  /**
   * Start the task (pending → running)
   * @throws Error if task is not in pending state
   */
  start(): void;

  /**
   * Complete the task (running → completed)
   * @throws Error if task is not in progress
   */
  complete(): void;

  /**
   * Fail the task (any state → failed)
   * @param error - Error message describing the failure
   */
  fail(error: string): void;

  /**
   * Stop the task (any state → stopped)
   * Used for manual cancellation
   */
  stop(): void;

  /**
   * General state transition method
   * @param newStatus - Target status
   * @throws Error if transition is invalid
   */
  transitionTo(newStatus: TaskStatus): void;

  /**
   * Check if task can transition to target status
   * @param newStatus - Target status to check
   */
  canTransitionTo(newStatus: TaskStatus): boolean;

  /**
   * Get task duration in seconds
   * Returns undefined if task hasn't completed
   */
  getDuration?(): number | undefined;

  /**
   * Add message to conversation
   * @param message - Message to add
   */
  addMessage(message: TaskMessage): void;
}

/**
 * Task status type
 */
export type TaskStatus =
  | "pending"        // Initial state, ready to start
  | "running"        // Currently executing
  | "completed"      // Finished successfully
  | "failed"         // Failed with error
  | "stopped";       // Manually stopped

/**
 * Valid state transitions
 * Maps current state to array of valid next states
 */
export const VALID_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["running", "stopped"],
  running: ["completed", "failed", "stopped"],
  completed: [], // Terminal state
  failed: [],    // Terminal state
  stopped: []    // Terminal state
};
