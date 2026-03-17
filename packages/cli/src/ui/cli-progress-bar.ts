/**
 * CLIProgressBar - Command-line progress bar component
 *
 * Provides a real-time updating progress bar for long-running operations.
 * Displays task execution progress with percentage and visual bar.
 */

/**
 * Color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

/**
 * Progress bar configuration options
 */
export interface ProgressBarOptions {
  /** Total value to progress towards (default: 100) / 总进度值（默认：100） */
  total?: number;
  /** Current progress value (default: 0) / 当前进度值（默认：0） */
  current?: number;
  /** Width of the progress bar in characters (default: 30) / 进度条宽度（字符数，默认：30） */
  width?: number;
  /** Show percentage (default: true) / 显示百分比（默认：true） */
  showPercentage?: boolean;
  /** Show current/total values (default: true) / 显示当前/总数（默认：true） */
  showValues?: boolean;
  /** Custom label text (default: empty) / 自定义标签文本（默认：空） */
  label?: string;
  /** Character for filled portion (default: '█') / 填充字符（默认：█） */
  fillChar?: string;
  /** Character for empty portion (default: '░') / 空白字符（默认：░） */
  emptyChar?: string;
}

/**
 * CLIProgressBar - Real-time updating progress bar
 *
 * @example
 * ```ts
 * const bar = new CLIProgressBar({ total: 100, label: 'Processing' });
 * bar.start();
 *
 * for (let i = 0; i <= 100; i++) {
 *   bar.update(i);
 *   await sleep(50);
 * }
 *
 * bar.stop();
 * ```
 */
export class CLIProgressBar {
  private total: number;
  private current: number;
  private width: number;
  private showPercentage: boolean;
  private showValues: boolean;
  private label: string;
  private fillChar: string;
  private emptyChar: string;
  private isRunning: boolean = false;
  private lastOutputLength: number = 0;

  constructor(options: ProgressBarOptions = {}) {
    this.total = options.total ?? 100;
    this.current = options.current ?? 0;
    this.width = options.width ?? 30;
    this.showPercentage = options.showPercentage ?? true;
    this.showValues = options.showValues ?? true;
    this.label = options.label ?? '';
    this.fillChar = options.fillChar ?? '█';
    this.emptyChar = options.emptyChar ?? '░';
  }

  /**
   * Start the progress bar display
   */
  start(): void {
    this.isRunning = true;
    this.render();
  }

  /**
   * Update the progress bar with a new value
   *
   * @param value - New current value (0 to total)
   */
  update(value: number): void {
    this.current = Math.max(0, Math.min(value, this.total));
    if (this.isRunning) {
      this.render();
    }
  }

  /**
   * Increment the current value by a specified amount
   *
   * @param amount - Amount to increment (default: 1)
   */
  increment(amount: number = 1): void {
    this.update(this.current + amount);
  }

  /**
   * Stop the progress bar and print final newline
   */
  stop(): void {
    this.isRunning = false;
    if (this.lastOutputLength > 0) {
      // Clear the progress bar line
      process.stdout.write('\r' + ' '.repeat(this.lastOutputLength) + '\r');
    }
  }

  /**
   * Render the progress bar to stdout
   */
  private render(): void {
    const ratio = this.total > 0 ? this.current / this.total : 0;
    const percentage = Math.round(ratio * 100);
    const filledWidth = Math.round(ratio * this.width);
    const emptyWidth = this.width - filledWidth;

    // Build the progress bar
    const bar = this.fillChar.repeat(filledWidth) + this.emptyChar.repeat(emptyWidth);

    // Build the output string
    const parts: string[] = [];

    if (this.label) {
      parts.push(`${this.label}:`);
    }

    parts.push(`[${bar}]`);

    if (this.showValues) {
      parts.push(`${this.current}/${this.total}`);
    }

    if (this.showPercentage) {
      const color = percentage === 100 ? colors.green : colors.cyan;
      parts.push(`${color}${percentage}%${colors.reset}`);
    }

    const output = parts.join(' ');

    // Clear previous output and write new output
    process.stdout.write('\r' + ' '.repeat(this.lastOutputLength) + '\r');
    process.stdout.write(output);
    this.lastOutputLength = output.length;
  }

  /**
   * Get the current progress as a percentage
   */
  getPercentage(): number {
    return this.total > 0 ? Math.round((this.current / this.total) * 100) : 0;
  }

  /**
   * Check if the progress bar is complete
   */
  isComplete(): boolean {
    return this.current >= this.total;
  }
}

/**
 * Helper function to create and start a progress bar in one call
 *
 * @param options - Progress bar options
 * @returns Progress bar instance
 */
export function createProgressBar(options: ProgressBarOptions = {}): CLIProgressBar {
  const bar = new CLIProgressBar(options);
  bar.start();
  return bar;
}

/**
 * Task-specific progress bar for displaying task execution progress
 *
 * @example
 * ```ts
 * const bar = new TaskProgressBar({
 *   total: 10,
 *   passing: 5,
 *   incomplete: 5,
 *   label: 'Task Progress'
 * });
 * bar.start();
 * // ... update as tasks complete
 * bar.stop();
 * ```
 */
export interface TaskProgressOptions extends ProgressBarOptions {
  /** Number of passing user stories / 通过的用户故事数 */
  passing?: number;
  /** Number of incomplete user stories / 未完成的用户故事数 */
  incomplete?: number;
}

export class TaskProgressBar extends CLIProgressBar {
  private passingCount: number;
  private incompleteCount: number;

  constructor(options: TaskProgressOptions = {}) {
    super({
      total: options.total ?? 100,
      current: options.passing ?? 0,
      width: options.width ?? 30,
      showPercentage: options.showPercentage ?? true,
      showValues: options.showValues ?? true,
      label: options.label ?? 'Task Progress',
    });
    this.passingCount = options.passing ?? 0;
    this.incompleteCount = options.incomplete ?? 0;
  }

  /**
   * Update task progress with new passing/incomplete counts
   *
   * @param passing - Number of passing user stories
   * @param incomplete - Number of incomplete user stories
   */
  updateTaskProgress(passing: number, incomplete: number): void {
    this.passingCount = passing;
    this.incompleteCount = incomplete;
    const total = passing + incomplete;
    this.update(total > 0 ? passing : 0);
  }

  /**
   * Increment passing count
   */
  incrementPassing(): void {
    this.passingCount++;
    this.updateTaskProgress(this.passingCount, this.incompleteCount);
  }

  /**
   * Get current passing count
   */
  getPassingCount(): number {
    return this.passingCount;
  }

  /**
   * Get current incomplete count
   */
  getIncompleteCount(): number {
    return this.incompleteCount;
  }
}
