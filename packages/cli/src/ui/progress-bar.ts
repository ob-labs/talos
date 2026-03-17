/**
 * Progress Bar Utility
 *
 * Renders progress data as visual progress bars using Unicode block characters.
 */

export interface ProgressBarColor {
  /** Color name for Ink Text component (e.g., 'gray', 'green') */
  color: 'gray' | 'green';
}

/**
 * Render a progress bar using Unicode block characters
 *
 * @param current - Number of completed items (passing)
 * @param total - Total number of items
 * @param width - Width of progress bar in characters (default: 10)
 * @returns Progress bar string like "[██████░░░░] 6/10" or "N/A"
 *
 * @example
 * ```ts
 * renderProgressBar(6, 10, 10) // "[██████░░░░] 6/10"
 * renderProgressBar(0, 0, 10)   // "N/A"
 * renderProgressBar(10, 10, 10) // "[██████████] 10/10"
 * ```
 */
export function renderProgressBar(
  current: number,
  total: number,
  width: number = 10
): string {
  // Handle edge case: total is 0
  if (total === 0) {
    return `[${'░'.repeat(width)}] 0/0`;
  }

  // Calculate the proportion of completed items
  const ratio = current / total;
  const filledBlocks = Math.round(ratio * width);
  const emptyBlocks = width - filledBlocks;

  // Construct the progress bar using Unicode block characters
  const filled = '█'.repeat(filledBlocks);
  const empty = '░'.repeat(emptyBlocks);
  const progressBar = `${filled}${empty}`;

  return `[${progressBar}] ${current}/${total}`;
}

/**
 * Get the color for a progress bar based on completion status
 *
 * @param current - Number of completed items (passing)
 * @param total - Total number of items
 * @returns Color name for Ink Text component
 *
 * @example
 * ```ts
 * getProgressBarColor(6, 10)  // 'gray'
 * getProgressBarColor(10, 10) // 'green'
 * ```
 */
export function getProgressBarColor(
  current: number,
  total: number
): ProgressBarColor['color'] {
  // Complete (all passing)
  if (total > 0 && current === total) {
    return 'green';
  }
  // Incomplete
  return 'gray';
}
