/**
 * TaskListTable Component Tests
 * TaskListTable 组件测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { TaskListTable } from './task-list-table';
import type { TaskData } from './task-list-table';

describe('TaskListTable', () => {
  const mockTasks: TaskData[] = [
    {
      status: 'running',
      id: 'task-1',
      workspace: '/path/to/workspace-1',
      createdAt: Date.now() - 3600000, // 1 hour ago
    },
    {
      status: 'stopped',
      id: 'task-2',
      workspace: '/path/to/workspace-2',
      createdAt: Date.now() - 7200000, // 2 hours ago
    },
    {
      status: 'failed',
      id: 'task-3',
      workspace: '/path/to/workspace-3',
      createdAt: Date.now() - 10800000, // 3 hours ago
    },
    {
      status: 'completed',
      id: 'task-4',
      workspace: '/path/to/workspace-4',
      createdAt: Date.now() - 14400000, // 4 hours ago
    },
  ];

  describe('with tasks', () => {
    it('should render task table with all columns', () => {
      const { lastFrame } = render(<TaskListTable tasks={mockTasks} />);
      const output = lastFrame();

      // Check that all column headers are present
      expect(output).toContain('STATUS');
      expect(output).toContain('TASK ID');
      expect(output).toContain('WORKSPACE');
      expect(output).toContain('CREATED');
      expect(output).toContain('ELAPSED');
    });

    it('should render task status with icons', () => {
      const { lastFrame } = render(<TaskListTable tasks={mockTasks} />);
      const output = lastFrame();

      // Check for status icons
      expect(output).toContain('󰔟'); // running icon
      expect(output).toContain('󰔛'); // stopped icon
      expect(output).toContain('󰀦'); // failed icon
      expect(output).toContain('󰄬'); // completed icon
    });

    it('should render task IDs', () => {
      const { lastFrame } = render(<TaskListTable tasks={mockTasks} />);
      const output = lastFrame();

      expect(output).toContain('task-1');
      expect(output).toContain('task-2');
      expect(output).toContain('task-3');
      expect(output).toContain('task-4');
    });

    it('should render workspace names (extracted from path)', () => {
      const { lastFrame } = render(<TaskListTable tasks={mockTasks} />);
      const output = lastFrame();

      // Workspace names should be extracted from paths
      expect(output).toContain('workspace-1');
      expect(output).toContain('workspace-2');
      expect(output).toContain('workspace-3');
      expect(output).toContain('workspace-4');
    });

    it('should format creation dates as YYYY-MM-DD HH:mm:ss', () => {
      const { lastFrame } = render(<TaskListTable tasks={mockTasks} />);
      const output = lastFrame();

      // Date format should contain year-month-day hour:minute:second pattern
      expect(output).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    });

    it('should show elapsed time', () => {
      const { lastFrame } = render(<TaskListTable tasks={mockTasks} />);
      const output = lastFrame();

      // Elapsed time should be present (format: Xs, Xm, Xh, or Xd)
      expect(output).toMatch(/\d+[smhd]/);
    });
  });

  describe('with empty tasks', () => {
    it('should display "No tasks / 没有任务" message', () => {
      const { lastFrame } = render(<TaskListTable tasks={[]} />);
      const output = lastFrame();

      expect(output).toContain('No tasks');
      expect(output).toContain('没有任务');
    });
  });

  describe('with custom elapsed time', () => {
    it('should use provided elapsed time instead of calculating', () => {
      const tasksWithElapsed: TaskData[] = [
        {
          status: 'running',
          id: 'task-1',
          workspace: '/path/to/workspace',
          createdAt: Date.now(),
          elapsed: '5m 30s',
        },
      ];

      const { lastFrame } = render(<TaskListTable tasks={tasksWithElapsed} />);
      const output = lastFrame();

      expect(output).toContain('5m 30s');
    });
  });

  describe('with unknown status', () => {
    it('should render default icon for unknown status', () => {
      const tasksWithUnknownStatus: TaskData[] = [
        {
          status: 'unknown',
          id: 'task-1',
          workspace: '/path/to/workspace',
          createdAt: Date.now(),
        },
      ];

      const { lastFrame } = render(<TaskListTable tasks={tasksWithUnknownStatus} />);
      const output = lastFrame();

      // Default icon is '⚫'
      expect(output).toContain('⚫');
      expect(output).toContain('unknown');
    });
  });
});
