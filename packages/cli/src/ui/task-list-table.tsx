import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { renderProgressBar, getProgressBarColor } from './progress-bar';

export interface TaskData {
  status: string;
  id: string;
  workspace: string;
  tool?: string; // Tool used for task execution (claude, cursor)
  progress?: { total: number; passing: number; incomplete: number } | null; // Task progress information
  createdAt?: number; // Task creation timestamp
  repoRoot?: string; // Task workspace root directory (for --all mode)
}

export interface TaskListTableProps {
  /** Task data to display / 要显示的任务数据 */
  tasks: TaskData[];
  /** Currently selected task ID / 当前选中的任务 ID */
  selectedTaskId?: string;
  /** Callback when a task is selected / 当任务被选中时的回调 */
  onTaskSelect?: (taskId: string) => void;
  /** Visible columns for responsive layout / 响应式布局的可见列 */
  visibleColumns?: string[];
  /** Show compact progress (numbers only) / 显示紧凑进度（仅数字） */
  compactProgress?: boolean;
  /** Show compact status (icon only) / 显示紧凑状态（仅图标） */
  compactStatus?: boolean;
}

/**
 * Spinner frames from ora (dots pattern)
 * 从 ora 提取的 spinner 动画帧（dots 模式）
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_INTERVAL = 80; // milliseconds / 毫秒

/**
 * Status icon mapping using Nerd Fonts icons
 * 状态图标映射（使用 Nerd Fonts 图标）
 */
const STATUS_CONFIG: Record<string, { icon: string; color: string }> = {
  running: { icon: '▶', color: 'cyan' },
  stopped: { icon: '■', color: 'gray' },
  failed: { icon: '✗', color: 'red' },
  completed: { icon: '✓', color: 'green' },
};

/**
 * Column widths for table display
 * 表格显示的列宽度
 */
const COLUMN_WIDTHS = {
  STATUS: 12,
  STATUS_COMPACT: 2,
  'TASK ID': 40,
  WORKSPACE: 20,
  TOOL: 10,
  PROGRESS: 22,
  PROGRESS_COMPACT: 12,
  CREATED: 12,
};

/**
 * Get workspace name from full path
 * 从完整路径获取工作区名称
 */
function getWorkspaceName(workspace: string): string {
  const parts = workspace.split(/[/\\]/);
  return parts[parts.length - 1] || workspace;
}

/**
 * Truncate text to fit column width
 */
function truncate(text: string, width: number): string {
  if (text.length <= width) {
    return text.padEnd(width);
  }
  return text.substring(0, width - 1) + '…';
}

/**
 * Format creation time as compact date and time
 * 格式化创建时间为紧凑的月日时分
 */
function formatCreatedAt(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${month}/${day} ${hours}:${minutes}`;
}

/**
 * TaskListTable Component - Simple table implementation using ink components
 * TaskListTable 组件 - 使用 ink 组件的简单表格实现
 *
 * Displays tasks in a formatted table with:
 * - STATUS (状态): Task status with icon and color
 * - TASK ID (任务 ID): Unique task identifier
 * - WORKSPACE (工作区): Workspace name
 * - TOOL (工具): Tool used for task execution (claude, cursor)
 * - PROGRESS (进度): Task progress bar
 * - CREATED (创建时间): Task creation timestamp
 *
 * Features:
 * - Highlights selected task with different background color
 * - Supports task selection via click or keyboard navigation
 * - Supports responsive column display based on available space
 * - Supports compact modes for status (icon only) and progress (numbers only)
 */
export const TaskListTable: React.FC<TaskListTableProps> = ({
  tasks,
  selectedTaskId,
  onTaskSelect,
  visibleColumns,
  compactProgress = false,
  compactStatus = false,
}) => {
  // Spinner animation state
  // Spinner 动画状态
  const [spinIndex, setSpinIndex] = useState(0);

  // Animate spinner when there are running tasks
  // 当有运行中的任务时，显示 spinner 动画
  useEffect(() => {
    const hasRunningTasks = tasks.some(task => task.status === 'running');
    if (!hasRunningTasks) return;

    const timer = setInterval(() => {
      setSpinIndex(i => (i + 1) % SPINNER_FRAMES.length);
    }, SPINNER_INTERVAL);

    return () => clearInterval(timer);
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <Text color="gray">
        No tasks
      </Text>
    );
  }

  // Default to all columns if not specified
  // 如果未指定，默认显示所有列
  // Order: TASK ID before STATUS for faster task lookup
  const allColumns = ['TASK ID', 'STATUS', 'WORKSPACE', 'TOOL', 'PROGRESS', 'CREATED'];
  const columns = visibleColumns || allColumns;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        {columns.map((col) => {
          let width = COLUMN_WIDTHS[col as keyof typeof COLUMN_WIDTHS];
          // STATUS column always uses full width to show complete header text
          // STATUS 列始终使用完整宽度以显示完整表头文字
          if (col === 'PROGRESS' && compactProgress) width = COLUMN_WIDTHS.PROGRESS_COMPACT;

          return (
            <Text key={col} bold>
              {truncate(col, width)}
            </Text>
          );
        })}
      </Box>

      {/* Separator */}
      <Box>
        {columns.map((col) => {
          let width = COLUMN_WIDTHS[col as keyof typeof COLUMN_WIDTHS];
          // STATUS column always uses full width to match header
          // STATUS 列始终使用完整宽度以匹配表头
          if (col === 'PROGRESS' && compactProgress) width = COLUMN_WIDTHS.PROGRESS_COMPACT;

          return <Text key={col}>{'─'.repeat(width)}</Text>;
        })}
      </Box>

      {/* Rows */}
      {tasks.map((task) => {
        const statusConfig = STATUS_CONFIG[task.status] || { icon: '⚫', color: 'white' };
        // Use spinner animation for running tasks
        // 对运行中的任务使用 spinner 动画
        const displayIcon = task.status === 'running'
          ? SPINNER_FRAMES[spinIndex]
          : statusConfig.icon;
        const statusText = compactStatus ? displayIcon : `${displayIcon} ${task.status}`;
        const isSelected = task.id === selectedTaskId;

        const cellRenderers: Record<string, React.ReactNode> = {
          STATUS: (
            <Text
              color={isSelected ? 'white' : statusConfig.color}
              backgroundColor={isSelected ? 'blue' : undefined}
            >
              {truncate(statusText, COLUMN_WIDTHS.STATUS)}
            </Text>
          ),
          'TASK ID': (
            <Text
              color={isSelected ? 'white' : undefined}
              backgroundColor={isSelected ? 'blue' : undefined}
            >
              {truncate(task.id, COLUMN_WIDTHS['TASK ID'])}
            </Text>
          ),
          WORKSPACE: (
            <Text
              color={isSelected ? 'white' : undefined}
              backgroundColor={isSelected ? 'blue' : undefined}
            >
              {truncate(getWorkspaceName(task.workspace), COLUMN_WIDTHS.WORKSPACE)}
            </Text>
          ),
          TOOL: (
            <Text
              color={isSelected ? 'white' : undefined}
              backgroundColor={isSelected ? 'blue' : undefined}
            >
              {truncate(task.tool || 'claude', COLUMN_WIDTHS.TOOL)}
            </Text>
          ),
          PROGRESS: (
            <Text
              color={isSelected ? 'white' : (
                task.progress && task.progress.total > 0
                  ? getProgressBarColor(task.progress.passing, task.progress.total)
                  : 'gray'
              )}
              backgroundColor={isSelected ? 'blue' : undefined}
            >
              {compactProgress ? (
                truncate(
                  task.progress && task.progress.total > 0
                    ? `${task.progress.passing}/${task.progress.total}`
                    : 'N/A',
                  COLUMN_WIDTHS.PROGRESS_COMPACT
                )
              ) : (
                truncate(
                  task.progress && task.progress.total > 0
                    ? renderProgressBar(task.progress.passing, task.progress.total)
                    : 'N/A',
                  COLUMN_WIDTHS.PROGRESS
                )
              )}
            </Text>
          ),
          CREATED: (
            <Text
              color={isSelected ? 'white' : undefined}
              backgroundColor={isSelected ? 'blue' : undefined}
            >
              {task.createdAt
                ? truncate(formatCreatedAt(task.createdAt), COLUMN_WIDTHS.CREATED)
                : ' '.repeat(COLUMN_WIDTHS.CREATED)}
            </Text>
          ),
        };

        return (
          <Box
            key={task.id}
            backgroundColor={isSelected ? 'blue' : undefined}
          >
            {columns.map((col) => cellRenderers[col])}
          </Box>
        );
      })}
    </Box>
  );
};
