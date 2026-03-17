/**
 * TaskStatus - Task Status Value Object
 *
 * Immutable value object representing task execution status.
 * Re-exported from entities/ITask.ts to maintain single source of truth.
 *
 * Valid status values:
 * - "pending": Initial state, ready to start
 * - "in_progress": Currently executing
 * - "completed": Finished successfully
 * - "failed": Failed with error
 * - "stopped": Manually stopped
 *
 * @example
 * ```typescript
 * const status: TaskStatus = "in_progress";
 *
 * if (status === "completed") {
 *   console.log("Task is done!");
 * }
 * ```
 */
export type { TaskStatus } from "../entities/ITask";

/**
 * Valid task state transitions
 * Maps current state to array of valid next states
 *
 * @example
 * ```typescript
 * import { VALID_TASK_TRANSITIONS } from "./value-objects/TaskStatus";
 *
 * const canTransition = VALID_TASK_TRANSITIONS["pending"].includes("in_progress"); // true
 * ```
 */
export { VALID_TASK_TRANSITIONS } from "../entities/ITask";
