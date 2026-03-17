import React, { useEffect, useState, useMemo } from 'react';
import { Box, Text, useStdin } from 'ink';
import { TaskListTable } from './task-list-table';
import { TaskLogPanel } from './task-log-panel';
import type { TaskData } from './task-list-table';
import { readTaskLogTail } from '../utils/log-reader';

/**
 * Column widths for calculating panel size
 * 列宽度，用于计算面板大小
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

const LOG_PANEL_MIN_WIDTH = 70;

export interface TaskMonitorProps {
  tasks?: TaskData[];
  watch?: boolean;
  lastUpdate?: Date;
  repoRoot?: string;
}

/**
 * TaskMonitor Component - Responsive dual panel layout
 */
export const TaskMonitor: React.FC<TaskMonitorProps> = ({
  tasks = [],
  watch = false,
  lastUpdate,
  repoRoot,
}) => {
  const [terminalSize, setTerminalSize] = useState({
    width: process.stdout.columns,
    height: process.stdout.rows,
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();
  const [logContent, setLogContent] = useState<string>('');
  const { stdin, setRawMode } = useStdin();

  // Calculate responsive settings before useEffects that depend on it
  // Responsive layout priority: TASK ID > STATUS > CREATED > PROGRESS > WORKSPACE > TOOL
  const responsiveSettings = useMemo(() => {
    const width = terminalSize.width;
    const headerWidth = 32;
    const borderAndPadding = 4;
    const allColumnsWidth = COLUMN_WIDTHS.STATUS + COLUMN_WIDTHS['TASK ID'] +
                           COLUMN_WIDTHS.WORKSPACE + COLUMN_WIDTHS.TOOL + COLUMN_WIDTHS.PROGRESS + COLUMN_WIDTHS.CREATED;
    const minStatusWidth = Math.max(headerWidth, allColumnsWidth) + borderAndPadding;

    // Calculate minimum width when showing only STATUS (compact) and TASK ID
    const minStatusWidthWithoutLog = Math.max(headerWidth,
      COLUMN_WIDTHS.STATUS_COMPACT + COLUMN_WIDTHS['TASK ID']) + borderAndPadding;

    let visibleColumns: string[] = ['TASK ID', 'STATUS', 'WORKSPACE', 'TOOL', 'PROGRESS', 'CREATED'];
    let compactProgress = false;
    let compactStatus = false;
    let showLogPanel = false;

    // Level 1: Show all columns + log panel
    if (width >= minStatusWidth + LOG_PANEL_MIN_WIDTH + 1) {
      showLogPanel = true;
    }
    // Level 2: Hide TOOL (keep CREATED for task time info)
    else if (width >= minStatusWidth - COLUMN_WIDTHS.TOOL + LOG_PANEL_MIN_WIDTH + 1) {
      visibleColumns = ['TASK ID', 'STATUS', 'WORKSPACE', 'PROGRESS', 'CREATED'];
      showLogPanel = true;
    }
    // Level 3: Hide TOOL + WORKSPACE
    else if (width >= minStatusWidth - COLUMN_WIDTHS.TOOL - COLUMN_WIDTHS.WORKSPACE + LOG_PANEL_MIN_WIDTH + 1) {
      visibleColumns = ['TASK ID', 'STATUS', 'PROGRESS', 'CREATED'];
      showLogPanel = true;
    }
    // Level 4: Hide TOOL + WORKSPACE, compact PROGRESS
    else if (width >= minStatusWidth - COLUMN_WIDTHS.TOOL - COLUMN_WIDTHS.WORKSPACE -
             (COLUMN_WIDTHS.PROGRESS - COLUMN_WIDTHS.PROGRESS_COMPACT) + LOG_PANEL_MIN_WIDTH + 1) {
      visibleColumns = ['TASK ID', 'STATUS', 'PROGRESS', 'CREATED'];
      compactProgress = true;
      showLogPanel = true;
    }
    // Level 5: Hide TOOL + WORKSPACE + PROGRESS, compact STATUS
    else if (width >= minStatusWidthWithoutLog + LOG_PANEL_MIN_WIDTH + 1) {
      visibleColumns = ['TASK ID', 'STATUS', 'CREATED'];
      compactStatus = true;
      showLogPanel = true;
    }
    // Level 6: Hide log panel + TOOL + WORKSPACE + PROGRESS, compact STATUS
    else if (width >= minStatusWidthWithoutLog) {
      visibleColumns = ['TASK ID', 'STATUS', 'CREATED'];
      compactStatus = true;
      showLogPanel = false;
    }
    // Level 7: Minimum - show only TASK ID + STATUS
    else {
      visibleColumns = ['TASK ID', 'STATUS'];
      compactStatus = true;
      showLogPanel = false;
    }

    // Calculate panel widths
    let statusPanelWidth: number;
    let logPanelWidth: number;

    if (showLogPanel) {
      // When showing log panel, limit status panel to leave space for log
      statusPanelWidth = Math.min(
        minStatusWidth -
          (compactProgress ? (COLUMN_WIDTHS.PROGRESS - COLUMN_WIDTHS.PROGRESS_COMPACT) : 0) -
          (compactStatus ? (COLUMN_WIDTHS.STATUS - COLUMN_WIDTHS.STATUS_COMPACT) : 0) -
          (!visibleColumns.includes('CREATED') ? COLUMN_WIDTHS.CREATED : 0) -
          (!visibleColumns.includes('WORKSPACE') ? COLUMN_WIDTHS.WORKSPACE : 0) -
          (!visibleColumns.includes('TOOL') ? COLUMN_WIDTHS.TOOL : 0) -
          (!visibleColumns.includes('PROGRESS') ? COLUMN_WIDTHS.PROGRESS : 0),
        width - LOG_PANEL_MIN_WIDTH - 1
      );
      logPanelWidth = width - statusPanelWidth - 1;
    } else {
      // When not showing log panel, status panel takes full width
      statusPanelWidth = width;
      logPanelWidth = 0;
    }

    return {
      visibleColumns,
      compactProgress,
      compactStatus,
      showLogPanel,
      statusPanelWidth,
      logPanelWidth,
    };
  }, [terminalSize.width]);

  // @ts-ignore - process.stdout.on returns stream but effect expects void
  useEffect(() => {
    const handleResize = () => {
      setTerminalSize({
        width: process.stdout.columns,
        height: process.stdout.rows,
      });
    };
    handleResize();
    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);

  // Initialize selected task only when needed
  // Only reset selection if the currently selected task no longer exists
  useEffect(() => {
    if (tasks.length === 0) {
      setSelectedTaskId(undefined);
      return;
    }
    // Only auto-select if nothing is selected, or if current selection is invalid
    const shouldReset = !selectedTaskId || !tasks.some(t => t.id === selectedTaskId);
    if (shouldReset) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [tasks, selectedTaskId]);

  // Get repoRoot for the selected task (for --all mode where each task has its own repoRoot)
  const selectedTaskRepoRoot = useMemo(() => {
    return tasks.find(t => t.id === selectedTaskId)?.repoRoot || repoRoot;
  }, [selectedTaskId, tasks, repoRoot]);

  useEffect(() => {
    if (!selectedTaskId || !selectedTaskRepoRoot) {
      setLogContent('');
      return;
    }
    const loadLog = async () => {
      // All logs are stored in the main repo's .talos/logs directory
      // 所有日志都存储在主仓库的 .talos/logs 目录中
      const content = await readTaskLogTail(selectedTaskRepoRoot, selectedTaskId, 20);
      setLogContent(content);
    };
    loadLog();
    let timer: NodeJS.Timeout | undefined;
    if (watch) {
      timer = setInterval(loadLog, 2000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [selectedTaskId, selectedTaskRepoRoot, watch]);

  // Keyboard navigation - only enable when log panel is visible
  // 键盘导航 - 只在 log 面板可见时启用
  useEffect(() => {
    if (!stdin || !setRawMode) return;
    // Don't set up keyboard navigation if log panel is not shown
    // 如果 log 面板不显示，不设置键盘导航
    if (!responsiveSettings.showLogPanel) return;

    setRawMode(true);
    const handleKeyPress = (data: any) => {
      const key = data.toString();
      if (tasks.length === 0) return;
      const currentIndex = selectedTaskId ? tasks.findIndex(t => t.id === selectedTaskId) : -1;
      const ARROW_UP = '\u001b[A';
      const ARROW_DOWN = '\u001b[B';
      if (key === ARROW_UP || key === 'k') {
        const newIndex = currentIndex <= 0 ? tasks.length - 1 : currentIndex - 1;
        setSelectedTaskId(tasks[newIndex].id);
      } else if (key === ARROW_DOWN || key === 'j') {
        const newIndex = currentIndex >= tasks.length - 1 ? 0 : currentIndex + 1;
        setSelectedTaskId(tasks[newIndex].id);
      }
    };
    stdin.on('data', handleKeyPress);
    return () => {
      stdin.off('data', handleKeyPress);
      setRawMode(false);
    };
  }, [stdin, setRawMode, tasks, selectedTaskId, responsiveSettings.showLogPanel]);

  const formatLastUpdate = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <Box flexDirection="column" width={terminalSize.width}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📊 Task Status Monitor
        </Text>
        {watch && lastUpdate && (
          <Text color="gray">
            {' '}| Last update: {formatLastUpdate(lastUpdate)}
          </Text>
        )}
      </Box>

      <Box flexDirection="row" width={terminalSize.width}>
        <Box
          flexDirection="column"
          width={responsiveSettings.statusPanelWidth}
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          <Box marginBottom={1}>
            <Text bold color="cyan">
              📋 Task List
            </Text>
          </Box>
          <TaskListTable
            tasks={tasks}
            selectedTaskId={responsiveSettings.showLogPanel ? selectedTaskId : undefined}
            onTaskSelect={responsiveSettings.showLogPanel ? setSelectedTaskId : undefined}
            visibleColumns={responsiveSettings.visibleColumns}
            compactProgress={responsiveSettings.compactProgress}
            compactStatus={responsiveSettings.compactStatus}
          />
        </Box>

        {responsiveSettings.showLogPanel && (
          <Box width={1}>
            <Text color="gray">│</Text>
          </Box>
        )}

        {responsiveSettings.showLogPanel && (
          <Box
            flexDirection="column"
            width={responsiveSettings.logPanelWidth}
            borderStyle="single"
            borderColor="gray"
            paddingX={1}
          >
            <Box marginBottom={1}>
              <Text bold color="green">
                📜 Task Logs
              </Text>
            </Box>
            <TaskLogPanel
              taskId={selectedTaskId}
              logContent={logContent}
              panelWidth={responsiveSettings.logPanelWidth - 2}
            />
          </Box>
        )}
      </Box>

      {watch && responsiveSettings.showLogPanel && (
        <Box marginTop={1}>
          <Text color="gray">
            ↑/↓ or j/k: Navigate tasks | Ctrl+C: Exit
          </Text>
        </Box>
      )}
    </Box>
  );
};
