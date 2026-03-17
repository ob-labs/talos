/**
 * TaskLogPanel Component Tests
 * TaskLogPanel 组件测试
 */

import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { TaskLogPanel } from './task-log-panel';

describe('TaskLogPanel', () => {
  describe('with no task selected', () => {
    it('should display "No task selected / 未选择任务" message', () => {
      const { lastFrame } = render(<TaskLogPanel />);
      const output = lastFrame();

      expect(output).toContain('No task selected');
      expect(output).toContain('未选择任务');
    });

    it('should display no task message even if log content is provided', () => {
      const { lastFrame } = render(
        <TaskLogPanel logContent="Some log content" />
      );
      const output = lastFrame();

      expect(output).toContain('No task selected');
      expect(output).toContain('未选择任务');
    });
  });

  describe('with task selected but no log content', () => {
    it('should display "No log content / 无日志内容" message', () => {
      const { lastFrame } = render(<TaskLogPanel taskId="task-1" />);
      const output = lastFrame();

      expect(output).toContain('No log content');
      expect(output).toContain('无日志内容');
    });

    it('should display empty log message for empty string', () => {
      const { lastFrame } = render(
        <TaskLogPanel taskId="task-1" logContent="" />
      );
      const output = lastFrame();

      expect(output).toContain('No log content');
      expect(output).toContain('无日志内容');
    });

    it('should display empty log message for whitespace-only content', () => {
      const { lastFrame } = render(
        <TaskLogPanel taskId="task-1" logContent="   " />
      );
      const output = lastFrame();

      expect(output).toContain('No log content');
      expect(output).toContain('无日志内容');
    });
  });

  describe('with log content', () => {
    const mockLogContent = [
      'Line 1: Starting task',
      'Line 2: Processing data',
      'Line 3: Task completed',
    ].join('\n');

    it('should display log lines with line numbers', () => {
      const { lastFrame } = render(
        <TaskLogPanel taskId="task-1" logContent={mockLogContent} />
      );
      const output = lastFrame();

      expect(output).toContain('Line 1: Starting task');
      expect(output).toContain('Line 2: Processing data');
      expect(output).toContain('Line 3: Task completed');
    });

    it('should format line numbers with padding (3 digits)', () => {
      const { lastFrame } = render(
        <TaskLogPanel taskId="task-1" logContent={mockLogContent} />
      );
      const output = lastFrame();

      // Line numbers should be padded to 3 digits: "  1│", "  2│", "  3│"
      expect(output).toMatch(/\s{1,2}1│/);
      expect(output).toMatch(/\s{1,2}2│/);
      expect(output).toMatch(/\s{1,2}3│/);
    });

    it('should handle empty lines in log content', () => {
      const logWithEmptyLines = [
        'Line 1',
        '',
        'Line 3',
      ].join('\n');

      const { lastFrame } = render(
        <TaskLogPanel taskId="task-1" logContent={logWithEmptyLines} />
      );
      const output = lastFrame();

      expect(output).toContain('Line 1');
      expect(output).toContain('Line 3');
    });
  });

  describe('with tail lines option', () => {
    const longLogContent = Array.from({ length: 100 }, (_, i) =>
      `Line ${i + 1}: Some log content`
    ).join('\n');

    it('should show only last N lines when tailLines is specified', () => {
      const { lastFrame } = render(
        <TaskLogPanel taskId="task-1" logContent={longLogContent} tailLines={10} />
      );
      const output = lastFrame();

      // Should show line numbers 91-100 (last 10 lines)
      expect(output).toContain('Line 91');
      expect(output).toContain('Line 100');

      // Should not show earlier lines
      expect(output).not.toContain('Line 1');
      expect(output).not.toContain('Line 50');
    });

    it('should use default tailLines of 50 when not specified', () => {
      const { lastFrame } = render(
        <TaskLogPanel taskId="task-1" logContent={longLogContent} />
      );
      const output = lastFrame();

      // Should show line numbers 51-100 (last 50 lines)
      expect(output).toContain('Line 51');
      expect(output).toContain('Line 100');

      // Should not show earlier lines
      expect(output).not.toContain('Line 1');
      expect(output).not.toContain('Line 49');
    });

    it('should show all content when log has fewer lines than tailLines', () => {
      const shortLog = 'Line 1\nLine 2\nLine 3';
      const { lastFrame } = render(
        <TaskLogPanel taskId="task-1" logContent={shortLog} tailLines={50} />
      );
      const output = lastFrame();

      expect(output).toContain('Line 1');
      expect(output).toContain('Line 2');
      expect(output).toContain('Line 3');
    });
  });

  describe('line number calculation', () => {
    it('should calculate line numbers relative to original log file', () => {
      const logContent = Array.from({ length: 100 }, (_, i) =>
        `Line ${i + 1}`
      ).join('\n');

      const { lastFrame } = render(
        <TaskLogPanel taskId="task-1" logContent={logContent} tailLines={5} />
      );
      const output = lastFrame();

      // Line numbers should be 96-100 (not 1-5)
      expect(output).toContain(' 96│');
      expect(output).toContain(' 97│');
      expect(output).toContain(' 98│');
      expect(output).toContain(' 99│');
      expect(output).toContain('100│');
    });
  });

  describe('with special characters in logs', () => {
    it('should handle special characters and unicode', () => {
      const logWithSpecialChars = [
        'Error: ❌ Failed to connect',
        'Warning: ⚠️ High memory usage',
        'Success: ✅ Task completed',
      ].join('\n');

      const { lastFrame } = render(
        <TaskLogPanel taskId="task-1" logContent={logWithSpecialChars} />
      );
      const output = lastFrame();

      expect(output).toContain('❌');
      expect(output).toContain('⚠️');
      expect(output).toContain('✅');
    });
  });
});
