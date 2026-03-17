/**
 * TaskProgress - Task Progress Value Object
 *
 * Immutable value object representing task execution progress.
 * Part of the domain layer value objects.
 *
 * @example
 * ```typescript
 * const progress: TaskProgress = {
 *   total: 10,
 *   passing: 7,
 *   incomplete: 3
 * };
 * ```
 */
export interface TaskProgress {
  /**
   * Total number of tasks/stories
   */
  total: number;

  /**
   * Number of passing/completed tasks/stories
   */
  passing: number;

  /**
   * Number of incomplete tasks/stories
   */
  incomplete: number;
}
