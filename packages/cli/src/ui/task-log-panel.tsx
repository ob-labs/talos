import React from 'react';
import { Box, Text } from 'ink';

export interface TaskLogPanelProps {
  /** ID of the task to display logs for / 要显示日志的任务 ID */
  taskId?: string;
  /** Log content to display / 要显示的日志内容 */
  logContent?: string;
  /** Number of lines to show from the end / 从末尾显示的行数 */
  tailLines?: number;
  /** Width of the panel for text wrapping / 面板宽度用于文本换行 */
  panelWidth?: number;
}

const DEFAULT_TAIL_LINES = 50;
const NO_TASK_MESSAGE = 'No task selected / 未选择任务';
const EMPTY_LOG_MESSAGE = 'No log content / 无日志内容';

/**
 * TaskLogPanel Component - Display real-time task logs
 * TaskLogPanel 组件 - 显示实时任务日志
 *
 * Features:
 * - Shows last N lines of log content (default 50)
 * - Displays "No task selected" message when no task is selected
 * - Handles log content wrapping based on panel width
 * - Auto-scrolls to show latest content (by showing tail lines)
 */
export const TaskLogPanel: React.FC<TaskLogPanelProps> = ({
  taskId,
  logContent = '',
  tailLines = DEFAULT_TAIL_LINES,
  panelWidth,
}) => {
  // Show "no task selected" message if no task ID is provided
  // 如果没有提供任务 ID，显示"未选择任务"消息
  if (!taskId) {
    return (
      <Text color="gray" dimColor>
        {NO_TASK_MESSAGE}
      </Text>
    );
  }

  // Show empty log message if no log content
  // 如果没有日志内容，显示空日志消息
  if (!logContent || logContent.trim().length === 0) {
    return (
      <Text color="gray" dimColor>
        {EMPTY_LOG_MESSAGE}
      </Text>
    );
  }

  // Split log content into lines
  // 将日志内容分割成行
  const lines = logContent.split('\n');

  // Get the last N lines (tail behavior)
  // 获取最后 N 行（尾部行为）
  const tailLinesToShow = lines.slice(-tailLines);

  // If panel width is specified, we could truncate lines to fit
  // For now, we'll let ink handle the wrapping naturally
  // 如果指定了面板宽度，我们可以截断行以适应
  // 目前，我们让 ink 自然处理换行

  return (
    <Box flexDirection="column" flexGrow={1}>
      {tailLinesToShow.map((line, index) => {
        // Calculate the original line number for display
        // 计算原始行号用于显示
        const originalLineNumber = lines.length - tailLinesToShow.length + index + 1;

        return (
          <Box key={index} width={panelWidth}>
            <Text color="gray" dimColor>
              {String(originalLineNumber).padStart(3, ' ')}│{' '}
            </Text>
            <Text color="white">
              {line || ' '}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
