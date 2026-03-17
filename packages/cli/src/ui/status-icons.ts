/**
 * Status Icons - Status icon and color utilities for CLI
 *
 * Provides consistent status icons and colors for task display across the CLI.
 */

/**
 * Task status type
 */
export type TaskStatus = 'running' | 'stopped' | 'completed' | 'failed' | 'pending' | 'initializing';

/**
 * Status configuration with icon and color
 */
export interface StatusConfig {
  /** Icon character / 图标字符 */
  icon: string;
  /** Color name for terminal output / 终端输出颜色名称 */
  color: string;
  /** ANSI color code / ANSI 颜色代码 */
  ansiColor: string;
}

/**
 * Status icon mapping configuration
 * Maps task status to display icons and colors
 */
export const STATUS_CONFIG: Record<TaskStatus, StatusConfig> = {
  running: {
    icon: '🔄',
    color: 'cyan',
    ansiColor: '\x1b[36m',
  },
  stopped: {
    icon: '⏸️',
    color: 'gray',
    ansiColor: '\x1b[90m',
  },
  completed: {
    icon: '✅',
    color: 'green',
    ansiColor: '\x1b[32m',
  },
  failed: {
    icon: '❌',
    color: 'red',
    ansiColor: '\x1b[31m',
  },
  pending: {
    icon: '⏳',
    color: 'yellow',
    ansiColor: '\x1b[33m',
  },
  initializing: {
    icon: '🔧',
    color: 'blue',
    ansiColor: '\x1b[34m',
  },
};

/**
 * ANSI color codes
 */
export const ANSI_COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

/**
 * Get status icon for a given task status
 *
 * @param status - Task status string
 * @returns Status icon character
 *
 * @example
 * ```ts
 * getStatusIcon('running')   // '🔄'
 * getStatusIcon('completed') // '✅'
 * getStatusIcon('failed')    // '❌'
 * ```
 */
export function getStatusIcon(status: string): string {
  const normalizedStatus = status.toLowerCase() as TaskStatus;
  return STATUS_CONFIG[normalizedStatus]?.icon || '⚫';
}

/**
 * Get status color name for a given task status
 *
 * @param status - Task status string
 * @returns Color name (e.g., 'cyan', 'green', 'red')
 *
 * @example
 * ```ts
 * getStatusColor('running')    // 'cyan'
 * getStatusColor('completed')  // 'green'
 * getStatusColor('failed')     // 'red'
 * ```
 */
export function getStatusColor(status: string): string {
  const normalizedStatus = status.toLowerCase() as TaskStatus;
  return STATUS_CONFIG[normalizedStatus]?.color || 'white';
}

/**
 * Get status ANSI color code for a given task status
 *
 * @param status - Task status string
 * @returns ANSI color code
 *
 * @example
 * ```ts
 * getStatusAnsiColor('running')    // '\x1b[36m'
 * getStatusAnsiColor('completed')  // '\x1b[32m'
 * ```
 */
export function getStatusAnsiColor(status: string): string {
  const normalizedStatus = status.toLowerCase() as TaskStatus;
  return STATUS_CONFIG[normalizedStatus]?.ansiColor || ANSI_COLORS.white;
}

/**
 * Format text with status color
 *
 * @param text - Text to colorize
 * @param status - Task status to derive color from
 * @returns Colorized text with ANSI codes
 *
 * @example
 * ```ts
 * colorizeWithStatus('Running', 'running')   // '\x1b[36mRunning\x1b[0m'
 * colorizeWithStatus('Done', 'completed')    // '\x1b[32mDone\x1b[0m'
 * ```
 */
export function colorizeWithStatus(text: string, status: string): string {
  const ansiColor = getStatusAnsiColor(status);
  return `${ansiColor}${text}${ANSI_COLORS.reset}`;
}

/**
 * Get status icon and colorized text
 *
 * @param status - Task status
 * @param showIcon - Include icon in output (default: true)
 * @returns Formatted status string
 *
 * @example
 * ```ts
 * formatStatus('running')           // '🔄 running'
 * formatStatus('completed')         // '✅ completed'
 * formatStatus('failed', false)     // 'failed' (no icon)
 * ```
 */
export function formatStatus(status: string, showIcon: boolean = true): string {
  const icon = showIcon ? `${getStatusIcon(status)} ` : '';
  const statusText = colorizeWithStatus(status, status);
  return `${icon}${statusText}`;
}

/**
 * Get all available status configurations
 *
 * @returns Record of all status configurations
 */
export function getAllStatusConfigs(): Record<TaskStatus, StatusConfig> {
  return { ...STATUS_CONFIG };
}

/**
 * Check if a status is a valid task status
 *
 * @param status - Status string to validate
 * @returns true if valid, false otherwise
 */
export function isValidTaskStatus(status: string): boolean {
  return status.toLowerCase() in STATUS_CONFIG;
}
