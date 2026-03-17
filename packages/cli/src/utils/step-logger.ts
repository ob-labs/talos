/**
 * Step Logger Utility
 * 步骤日志工具
 *
 * 提供统一的步骤日志输出，支持动态步骤编号
 * Provides unified step log output with dynamic step numbering
 */

/**
 * ANSI 颜色代码
 * ANSI color codes
 */
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

/**
 * 日志状态类型
 * Log status type
 */
export type LogStatus = 'success' | 'warning' | 'error';

/**
 * 步骤日志选项
 * Step logger options
 */
export interface StepLoggerOptions {
  /** 是否显示图标（默认 true） / Whether to show icons (default true) */
  showIcon?: boolean;
  /** 是否静默模式（默认 false） / Whether to be silent (default false) */
  quiet?: boolean;
}

/**
 * 步骤日志记录器
 * Step Logger
 *
 * 支持动态步骤编号，只在实际执行操作时才递增
 * Supports dynamic step numbering, only increments when actually performing operations
 *
 * @example
 * ```typescript
 * const logger = new StepLogger();
 * logger.step(1, '创建 worktree', 'success');  // 输出: ● 1. 创建 worktree
 * logger.step(2, '同步文件', 'success');       // 输出: ● 2. 同步文件
 * logger.action('跳过操作', 'warning');        // 输出: ○ 跳过操作
 *
 * // 使用动态计数器
 * const counter = logger.createCounter();
 * if (worktreeExists) {
 *   counter.next('删除 worktree', 'success');  // 输出: ● 1. 删除 worktree
 * }
 * if (branchExists) {
 *   counter.next('删除分支', 'success');       // 输出: ● 2. 删除分支
 * }
 * // 如果只有 worktree 存在，只会输出步骤 1
 * ```
 */
export class StepLogger {
  private showIcon: boolean;
  private quiet: boolean;

  constructor(options: StepLoggerOptions = {}) {
    this.showIcon = options.showIcon !== false; // 默认显示 icon
    this.quiet = options.quiet === true;
  }

  /**
   * 获取状态对应的颜色
   * Get color for status
   */
  private getColor(status: LogStatus): string {
    return status === 'success' ? colors.green :
           status === 'warning' ? colors.yellow :
           colors.red;
  }

  /**
   * 获取状态对应的图标
   * Get icon for status
   */
  private getIcon(status: LogStatus): string {
    return status === 'success' ? '●' :
           status === 'warning' ? '○' :
           '✗';
  }

  /**
   * 输出带步骤编号的日志
   * Output log with step number
   *
   * @param step - 步骤编号 / Step number
   * @param message - 日志消息 / Log message
   * @param status - 日志状态 / Log status
   */
  step(step: number, message: string, status: LogStatus): void {
    if (this.quiet) return;

    const color = this.getColor(status);
    const icon = this.showIcon ? `${this.getIcon(status)} ` : '';
    console.log(`${color}${icon}${step}.${colors.reset} ${message}`);
  }

  /**
   * 输出不带步骤编号的日志（普通操作）
   * Output log without step number (normal action)
   *
   * @param message - 日志消息 / Log message
   * @param status - 日志状态 / Log status
   */
  action(message: string, status: LogStatus): void {
    if (this.quiet) return;

    const color = this.getColor(status);
    const icon = this.showIcon ? `${this.getIcon(status)} ` : '';
    console.log(`${color}${icon}${colors.reset} ${message}`);
  }

  /**
   * 创建动态步骤计数器
   * Create dynamic step counter
   *
   * 返回一个计数器对象，每次调用 next() 时自动递增编号
   * Returns a counter object that auto-increments on each next() call
   *
   * @example
   * ```typescript
   * const counter = logger.createCounter();
   * if (condition1) {
   *   counter.next('执行操作1', 'success');  // 输出: ● 1. 执行操作1
   * }
   * if (condition2) {
   *   counter.next('执行操作2', 'success');  // 输出: ● 2. 执行操作2
   * }
   * // 如果 condition1 不满足，只会输出步骤 1
   * ```
   */
  createCounter(): StepCounter {
    return new StepCounter(this);
  }
}

/**
 * 步骤计数器
 * Step Counter
 *
 * 用于动态步骤编号，只在调用 next() 时才递增
 * Used for dynamic step numbering, only increments when next() is called
 */
export class StepCounter {
  private count: number = 0;
  private logger: StepLogger;

  constructor(logger: StepLogger) {
    this.logger = logger;
  }

  /**
   * 输出下一步并递增计数器
   * Output next step and increment counter
   *
   * @param message - 日志消息 / Log message
   * @param status - 日志状态 / Log status
   * @returns 当前步骤编号 / Current step number
   */
  next(message: string, status: LogStatus): number {
    this.count++;
    this.logger.step(this.count, message, status);
    return this.count;
  }

  /**
   * 获取当前计数（不输出日志）
   * Get current count (without outputting log)
   */
  getCount(): number {
    return this.count;
  }
}

/**
 * 创建默认的步骤日志记录器
 * Create default step logger
 *
 * @param options - 日志选项 / Logger options
 * @returns StepLogger 实例 / StepLogger instance
 */
export function createStepLogger(options?: StepLoggerOptions): StepLogger {
  return new StepLogger(options);
}
