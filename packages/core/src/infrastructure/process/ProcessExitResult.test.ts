/**
 * Unit tests for ProcessExitResult
 */

import { describe, it, expect } from 'vitest';
import type { ProcessRuntimeInfo } from '@talos/types';
import {
  ProcessExitResult,
  SuccessProcessExitResult,
  FailedProcessExitResult,
  KilledProcessExitResult,
} from './ProcessExitResult';

describe('ProcessExitResult', () => {
  describe('SuccessProcessExitResult', () => {
    it('should return true for isSuccess', () => {
      const result = new SuccessProcessExitResult(0, new Date());
      expect(result.isSuccess()).toBe(true);
    });

    it('should return success status', () => {
      const result = new SuccessProcessExitResult(0, new Date());
      expect(result.getStatus()).toBe('success');
    });

    it('should return correct exit code', () => {
      const result = new SuccessProcessExitResult(0, new Date());
      expect(result.getExitCode()).toBe(0);
    });

    it('should return null for exit signal', () => {
      const result = new SuccessProcessExitResult(0, new Date());
      expect(result.getExitSignal()).toBe(null);
    });

    it('should return exit time', () => {
      const exitTime = new Date('2026-03-15T10:00:00Z');
      const result = new SuccessProcessExitResult(0, exitTime);
      expect(result.getExitTime()).toEqual(exitTime);
    });

    it('should return human-readable reason', () => {
      const result = new SuccessProcessExitResult(0, new Date());
      expect(result.getReason()).toBe('Process exited successfully with code 0');
    });
  });

  describe('FailedProcessExitResult', () => {
    it('should return false for isSuccess', () => {
      const result = new FailedProcessExitResult(1, new Date());
      expect(result.isSuccess()).toBe(false);
    });

    it('should return failed status', () => {
      const result = new FailedProcessExitResult(1, new Date());
      expect(result.getStatus()).toBe('failed');
    });

    it('should return correct exit code', () => {
      const result = new FailedProcessExitResult(127, new Date());
      expect(result.getExitCode()).toBe(127);
    });

    it('should return null for exit signal', () => {
      const result = new FailedProcessExitResult(1, new Date());
      expect(result.getExitSignal()).toBe(null);
    });

    it('should return exit time', () => {
      const exitTime = new Date('2026-03-15T10:00:00Z');
      const result = new FailedProcessExitResult(1, exitTime);
      expect(result.getExitTime()).toEqual(exitTime);
    });

    it('should return human-readable reason', () => {
      const result = new FailedProcessExitResult(1, new Date());
      expect(result.getReason()).toBe('Process failed with exit code 1');
    });
  });

  describe('KilledProcessExitResult', () => {
    it('should return false for isSuccess', () => {
      const result = new KilledProcessExitResult('SIGTERM', new Date());
      expect(result.isSuccess()).toBe(false);
    });

    it('should return killed status', () => {
      const result = new KilledProcessExitResult('SIGTERM', new Date());
      expect(result.getStatus()).toBe('killed');
    });

    it('should return null for exit code', () => {
      const result = new KilledProcessExitResult('SIGTERM', new Date());
      expect(result.getExitCode()).toBe(null);
    });

    it('should return exit signal', () => {
      const result = new KilledProcessExitResult('SIGTERM', new Date());
      expect(result.getExitSignal()).toBe('SIGTERM');
    });

    it('should return exit time', () => {
      const exitTime = new Date('2026-03-15T10:00:00Z');
      const result = new KilledProcessExitResult('SIGTERM', exitTime);
      expect(result.getExitTime()).toEqual(exitTime);
    });

    it('should return human-readable reason', () => {
      const result = new KilledProcessExitResult('SIGTERM', new Date());
      expect(result.getReason()).toBe('Process was killed by signal SIGTERM');
    });
  });

  describe('fromExitCode factory method', () => {
    it('should create SuccessProcessExitResult for exit code 0', () => {
      const result = ProcessExitResult.fromExitCode(0);
      expect(result.isSuccess()).toBe(true);
      expect(result.getStatus()).toBe('success');
      expect(result.getExitCode()).toBe(0);
    });

    it('should create FailedProcessExitResult for non-zero exit code', () => {
      const result = ProcessExitResult.fromExitCode(1);
      expect(result.isSuccess()).toBe(false);
      expect(result.getStatus()).toBe('failed');
      expect(result.getExitCode()).toBe(1);
    });

    it('should use provided exit time', () => {
      const exitTime = new Date('2026-03-15T10:00:00Z');
      const result = ProcessExitResult.fromExitCode(0, exitTime);
      expect(result.getExitTime()).toEqual(exitTime);
    });

    it('should use current time when exit time not provided', () => {
      const before = new Date();
      const result = ProcessExitResult.fromExitCode(0);
      const after = new Date();
      expect(result.getExitTime().getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getExitTime().getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('fromInfo factory method', () => {
    it('should create SuccessProcessExitResult for successful exit', () => {
      const info: ProcessRuntimeInfo = {
        pid: 12345,
        type: 'task',
        metadata: { taskId: 'task-123' },
        startedAt: new Date('2026-03-15T09:00:00Z'),
        exitCode: 0,
        exitSignal: null,
        exitTime: new Date('2026-03-15T10:00:00Z'),
        isRunning: false,
      };

      const result = ProcessExitResult.fromInfo(info);
      expect(result.isSuccess()).toBe(true);
      expect(result.getStatus()).toBe('success');
      expect(result.getExitCode()).toBe(0);
      expect(result.getExitSignal()).toBe(null);
    });

    it('should create FailedProcessExitResult for failed exit', () => {
      const info: ProcessRuntimeInfo = {
        pid: 12345,
        type: 'task',
        metadata: { taskId: 'task-123' },
        startedAt: new Date('2026-03-15T09:00:00Z'),
        exitCode: 1,
        exitSignal: null,
        exitTime: new Date('2026-03-15T10:00:00Z'),
        isRunning: false,
      };

      const result = ProcessExitResult.fromInfo(info);
      expect(result.isSuccess()).toBe(false);
      expect(result.getStatus()).toBe('failed');
      expect(result.getExitCode()).toBe(1);
      expect(result.getExitSignal()).toBe(null);
    });

    it('should create KilledProcessExitResult for signal termination', () => {
      const info: ProcessRuntimeInfo = {
        pid: 12345,
        type: 'task',
        metadata: { taskId: 'task-123' },
        startedAt: new Date('2026-03-15T09:00:00Z'),
        exitCode: null,
        exitSignal: 'SIGTERM',
        exitTime: new Date('2026-03-15T10:00:00Z'),
        isRunning: false,
      };

      const result = ProcessExitResult.fromInfo(info);
      expect(result.isSuccess()).toBe(false);
      expect(result.getStatus()).toBe('killed');
      expect(result.getExitCode()).toBe(null);
      expect(result.getExitSignal()).toBe('SIGTERM');
    });

    it('should prioritize signal over exit code', () => {
      // When both signal and exit code are present, signal should take precedence
      const info: ProcessRuntimeInfo = {
        pid: 12345,
        type: 'task',
        metadata: { taskId: 'task-123' },
        startedAt: new Date('2026-03-15T09:00:00Z'),
        exitCode: 143, // SIGTERM exit code on some systems
        exitSignal: 'SIGTERM',
        exitTime: new Date('2026-03-15T10:00:00Z'),
        isRunning: false,
      };

      const result = ProcessExitResult.fromInfo(info);
      expect(result.getStatus()).toBe('killed');
      expect(result.getExitSignal()).toBe('SIGTERM');
    });

    it('should use exit time from info', () => {
      const exitTime = new Date('2026-03-15T10:00:00Z');
      const info: ProcessRuntimeInfo = {
        pid: 12345,
        type: 'task',
        metadata: { taskId: 'task-123' },
        startedAt: new Date('2026-03-15T09:00:00Z'),
        exitCode: 0,
        exitSignal: null,
        exitTime,
        isRunning: false,
      };

      const result = ProcessExitResult.fromInfo(info);
      expect(result.getExitTime()).toEqual(exitTime);
    });

    it('should default to current time when exit time is undefined', () => {
      const info: ProcessRuntimeInfo = {
        pid: 12345,
        type: 'task',
        metadata: { taskId: 'task-123' },
        startedAt: new Date('2026-03-15T09:00:00Z'),
        exitCode: 0,
        exitSignal: null,
        exitTime: undefined,
        isRunning: false,
      };

      const before = new Date();
      const result = ProcessExitResult.fromInfo(info);
      const after = new Date();
      expect(result.getExitTime().getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getExitTime().getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should throw error for running process', () => {
      const info: ProcessRuntimeInfo = {
        pid: 12345,
        type: 'task',
        metadata: { taskId: 'task-123' },
        startedAt: new Date('2026-03-15T09:00:00Z'),
        exitCode: undefined,
        exitSignal: undefined,
        exitTime: undefined,
        isRunning: true,
      };

      expect(() => ProcessExitResult.fromInfo(info)).toThrow(
        'Process is still running, cannot create exit result'
      );
    });

    it('should handle undefined exitCode and exitSignal as success', () => {
      // Some process monitoring systems may not have exit code/signal immediately
      const info: ProcessRuntimeInfo = {
        pid: 12345,
        type: 'task',
        metadata: { taskId: 'task-123' },
        startedAt: new Date('2026-03-15T09:00:00Z'),
        exitCode: undefined,
        exitSignal: undefined,
        exitTime: new Date('2026-03-15T10:00:00Z'),
        isRunning: false,
      };

      const result = ProcessExitResult.fromInfo(info);
      // Should default to success when no code or signal is available
      expect(result.isSuccess()).toBe(true);
      expect(result.getStatus()).toBe('success');
    });

    it('should handle SIGKILL signal', () => {
      const info: ProcessRuntimeInfo = {
        pid: 12345,
        type: 'task',
        metadata: { taskId: 'task-123' },
        startedAt: new Date('2026-03-15T09:00:00Z'),
        exitCode: null,
        exitSignal: 'SIGKILL',
        exitTime: new Date('2026-03-15T10:00:00Z'),
        isRunning: false,
      };

      const result = ProcessExitResult.fromInfo(info);
      expect(result.getStatus()).toBe('killed');
      expect(result.getExitSignal()).toBe('SIGKILL');
      expect(result.getReason()).toBe('Process was killed by signal SIGKILL');
    });

    it('should handle various non-zero exit codes', () => {
      const exitCodes = [1, 2, 127, 130, 255];
      for (const code of exitCodes) {
        const info: ProcessRuntimeInfo = {
          pid: 12345,
          type: 'task',
          metadata: { taskId: 'task-123' },
          startedAt: new Date('2026-03-15T09:00:00Z'),
          exitCode: code,
          exitSignal: null,
          exitTime: new Date('2026-03-15T10:00:00Z'),
          isRunning: false,
        };

        const result = ProcessExitResult.fromInfo(info);
        expect(result.getStatus()).toBe('failed');
        expect(result.getExitCode()).toBe(code);
      }
    });
  });

  describe('type narrowing with discriminated union', () => {
    it('should allow type narrowing based on status', () => {
      const successResult = ProcessExitResult.fromExitCode(0);
      const failedResult = ProcessExitResult.fromExitCode(1);
      const killedResult = new KilledProcessExitResult('SIGTERM', new Date());

      if (successResult.getStatus() === 'success') {
        expect(successResult.getExitCode()).toBe(0);
      }

      if (failedResult.getStatus() === 'failed') {
        expect(failedResult.getExitCode()).toBeGreaterThan(0);
      }

      if (killedResult.getStatus() === 'killed') {
        expect(killedResult.getExitSignal()).toBeTruthy();
      }
    });
  });
});
