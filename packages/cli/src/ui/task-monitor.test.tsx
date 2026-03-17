/**
 * TaskMonitor Component Tests
 * TaskMonitor 组件测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { TaskMonitor } from './task-monitor';
import type { TaskData } from './task-list-table';

// Mock process.stdout for terminal size
const mockProcessStdout = {
  columns: 120,
  rows: 40,
  on: vi.fn(),
  off: vi.fn(),
};

describe('TaskMonitor', () => {
  const mockTasks: TaskData[] = [
    {
      status: 'running',
      id: 'task-1',
      workspace: '/path/to/workspace-1',
      createdAt: Date.now() - 3600000,
    },
    {
      status: 'stopped',
      id: 'task-2',
      workspace: '/path/to/workspace-2',
      createdAt: Date.now() - 7200000,
    },
  ];

  beforeEach(() => {
    // Mock process.stdout
    vi.stubGlobal('process', {
      stdout: mockProcessStdout,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('layout structure', () => {
    it('should render dual panel layout', () => {
      const { lastFrame } = render(
        <TaskMonitor tasks={mockTasks} watch={true} lastUpdate={new Date()} />
      );
      const output = lastFrame();

      // Should have both task list and log panels
      expect(output).toContain('Task List');
      expect(output).toContain('任务列表');
      expect(output).toContain('Task Logs');
      expect(output).toContain('任务日志');
    });

    it('should render header with title', () => {
      const { lastFrame } = render(
        <TaskMonitor tasks={mockTasks} watch={true} lastUpdate={new Date()} />
      );
      const output = lastFrame();

      expect(output).toContain('Task Status Monitor');
      expect(output).toContain('任务状态监控');
    });

    it('should render last update timestamp in watch mode', () => {
      const testDate = new Date('2026-03-11T12:34:56Z');
      const { lastFrame } = render(
        <TaskMonitor tasks={mockTasks} watch={true} lastUpdate={testDate} />
      );
      const output = lastFrame();

      expect(output).toContain('Last update');
      expect(output).toContain('最后更新');
      expect(output).toContain('12:34:56');
    });

    it('should not render last update timestamp when not in watch mode', () => {
      const testDate = new Date('2026-03-11T12:34:56Z');
      const { lastFrame } = render(
        <TaskMonitor tasks={mockTasks} watch={false} lastUpdate={testDate} />
      );
      const output = lastFrame();

      expect(output).not.toContain('Last update');
      expect(output).not.toContain('最后更新');
    });

    it('should render footer in watch mode', () => {
      const { lastFrame } = render(
        <TaskMonitor tasks={mockTasks} watch={true} lastUpdate={new Date()} />
      );
      const output = lastFrame();

      expect(output).toContain('Ctrl+C');
      expect(output).toContain('退出');
    });

    it('should not render footer when not in watch mode', () => {
      const { lastFrame } = render(
        <TaskMonitor tasks={mockTasks} watch={false} lastUpdate={new Date()} />
      );
      const output = lastFrame();

      expect(output).not.toContain('Ctrl+C');
      expect(output).not.toContain('退出');
    });
  });

  describe('terminal size handling', () => {
    it('should show error when terminal is too small (width < 80)', () => {
      vi.stubGlobal('process', {
        stdout: {
          columns: 60,
          rows: 40,
          on: vi.fn(),
          off: vi.fn(),
        },
      });

      const { lastFrame } = render(
        <TaskMonitor tasks={mockTasks} watch={true} lastUpdate={new Date()} />
      );
      const output = lastFrame();

      expect(output).toContain('Terminal too small');
      expect(output).toContain('终端太小');
      expect(output).toContain('80x24');
    });

    it('should show error when terminal is too small (height < 24)', () => {
      vi.stubGlobal('process', {
        stdout: {
          columns: 100,
          rows: 20,
          on: vi.fn(),
          off: vi.fn(),
        },
      });

      const { lastFrame } = render(
        <TaskMonitor tasks={mockTasks} watch={true} lastUpdate={new Date()} />
      );
      const output = lastFrame();

      expect(output).toContain('Terminal too small');
      expect(output).toContain('终端太小');
      expect(output).toContain('80x24');
    });

    it('should render normally when terminal size is sufficient', () => {
      vi.stubGlobal('process', {
        stdout: {
          columns: 100,
          rows: 30,
          on: vi.fn(),
          off: vi.fn(),
        },
      });

      const { lastFrame } = render(
        <TaskMonitor tasks={mockTasks} watch={true} lastUpdate={new Date()} />
      );
      const output = lastFrame();

      expect(output).not.toContain('Terminal too small');
      expect(output).toContain('Task List');
    });
  });

  describe('with empty tasks', () => {
    it('should render task list panel with empty message', () => {
      const { lastFrame } = render(
        <TaskMonitor tasks={[]} watch={true} lastUpdate={new Date()} />
      );
      const output = lastFrame();

      expect(output).toContain('Task List');
      expect(output).toContain('No tasks');
    });
  });

  describe('panel separation', () => {
    it('should render border separator between panels', () => {
      const { lastFrame } = render(
        <TaskMonitor tasks={mockTasks} watch={true} lastUpdate={new Date()} />
      );
      const output = lastFrame();

      // Should have border character (│)
      expect(output).toContain('│');
    });
  });
});
