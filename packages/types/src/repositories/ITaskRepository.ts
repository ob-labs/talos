/**
 * ITaskRepository - Task Repository Interface
 *
 * Repository pattern for Task entities.
 * Provides CRUD operations for Task persistence.
 *
 * DESIGN PRINCIPLES:
 * - Only accepts complete entities (no partial updates)
 * - Returns entities or null (not undefined)
 * - Encapsulates storage implementation details
 *
 * @example
 * ```typescript
 * const task: ITask = { ... };
 * await taskRepository.save(task);        // Save complete task
 * const found = await taskRepository.findById('task-123');
 * const all = await taskRepository.findAll();
 * await taskRepository.delete('task-123');
 * ```
 */
export interface ITaskRepository {
  /**
   * Save a complete task entity
   * Creates new or updates existing task
   *
   * @param task - Complete task entity to save
   * @throws Error if task is invalid or save fails
   */
  save(task: ITask): Promise<void>;

  /**
   * Find task by ID
   *
   * @param taskId - Task identifier
   * @returns Task entity or null if not found
   */
  findById(taskId: string): Promise<ITask | null>;

  /**
   * Find all tasks
   * Optionally filter by status or PRD ID
   *
   * @param filter - Optional filter criteria
   * @returns Array of task entities
   */
  findAll(filter?: TaskFilter): Promise<ITask[]>;

  /**
   * Delete a task by ID
   *
   * @param taskId - Task identifier
   * @throws Error if task not found or delete fails
   */
  delete(taskId: string): Promise<void>;

  /**
   * Check if task exists
   *
   * @param taskId - Task identifier
   * @returns true if task exists, false otherwise
   */
  exists(taskId: string): Promise<boolean>;

  /**
   * Count tasks matching filter
   *
   * @param filter - Optional filter criteria
   * @returns Number of matching tasks
   */
  count(filter?: TaskFilter): Promise<number>;
}

/**
 * Task filter criteria
 */
export interface TaskFilter {
  /**
   * Filter by task status
   */
  status?: string;

  /**
   * Filter by PRD ID
   */
  prdId?: string;

  /**
   * Filter by story ID
   */
  storyId?: string;

  /**
   * Filter by role/agent
   */
  role?: string;
}

/**
 * Import ITask entity interface
 */
import type { ITask } from "../entities/ITask";
