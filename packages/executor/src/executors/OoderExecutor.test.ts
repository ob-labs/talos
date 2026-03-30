/**
 * Unit tests for QoderExecutor (file name follows local convention)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import * as childProcess from 'node:child_process';
import { QoderExecutor } from './QoderExecutor';
import type { ToolExecutionRequest } from '@talos/types';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

const spawnMock = vi.mocked(childProcess.spawn);

function createMockChildProcess(pid = 42_001): ChildProcess {
  const proc = Object.assign(new EventEmitter(), {
    pid,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(() => true),
  }) as unknown as ChildProcess;
  return proc;
}

describe('QoderExecutor', () => {
  let executor: QoderExecutor;
  const originalQoderCli = process.env.TALOS_QODER_CLI;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TALOS_QODER_CLI;
    executor = new QoderExecutor();
  });

  afterEach(() => {
    if (originalQoderCli === undefined) {
      delete process.env.TALOS_QODER_CLI;
    } else {
      process.env.TALOS_QODER_CLI = originalQoderCli;
    }
  });

  describe('IToolExecutor interface compliance', () => {
    it('should expose name, execute, isAvailable, stop, getConfig', () => {
      expect(executor.name).toBe('qoder');
      expect(typeof executor.execute).toBe('function');
      expect(typeof executor.isAvailable).toBe('function');
      expect(typeof executor.stop).toBe('function');
      expect(typeof executor.getConfig).toBe('function');
    });
  });

  describe('getConfig', () => {
    it('should return qoder tool configuration', () => {
      const config = executor.getConfig();
      expect(config.name).toBe('qoder');
      expect(config.supportsDebugMode).toBe(true);
      expect(config.supportedModels).toEqual([]);
      expect(config.defaultTimeout).toBe(600_000);
    });
  });

  describe('execute', () => {
    it('should spawn qodercli with -w, -f stream-json, -p prompt', async () => {
      const proc = createMockChildProcess();
      spawnMock.mockImplementation(() => {
        queueMicrotask(() => {
          proc.emit('close', 0, null);
        });
        return proc;
      });

      const request: ToolExecutionRequest = {
        workingDir: '/tmp/ws',
        prompt: 'do the thing',
      };

      const result = await executor.execute(request);

      expect(spawnMock).toHaveBeenCalledTimes(1);
      expect(spawnMock).toHaveBeenCalledWith(
        'qodercli',
        ['-w', '/tmp/ws', '-f', 'stream-json', '-p', 'do the thing'],
        expect.objectContaining({
          cwd: '/tmp/ws',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('should use TALOS_QODER_CLI when set', async () => {
      process.env.TALOS_QODER_CLI = '  /opt/qoder/bin/cli  ';
      const proc = createMockChildProcess();
      spawnMock.mockImplementation(() => {
        queueMicrotask(() => proc.emit('close', 0, null));
        return proc;
      });

      await executor.execute({
        workingDir: '/w',
        prompt: 'p',
      });

      expect(spawnMock).toHaveBeenCalledWith(
        '/opt/qoder/bin/cli',
        ['-w', '/w', '-f', 'stream-json', '-p', 'p'],
        expect.any(Object)
      );
    });

    it('should omit CLAUDECODE from child env', async () => {
      process.env.CLAUDECODE = 'nested';
      const proc = createMockChildProcess();
      spawnMock.mockImplementation((_cmd, _args, opts) => {
        expect(opts?.env).toMatchObject({ PATH: process.env.PATH });
        expect(opts?.env).not.toHaveProperty('CLAUDECODE');
        queueMicrotask(() => proc.emit('close', 0, null));
        return proc;
      });

      await executor.execute({ workingDir: '/w', prompt: 'p' });
      delete process.env.CLAUDECODE;
    });

    it('should concatenate stdout and stderr into output', async () => {
      const proc = createMockChildProcess();
      spawnMock.mockImplementation(() => {
        queueMicrotask(() => {
          proc.stdout!.push(Buffer.from('a'));
          proc.stderr!.push(Buffer.from('b'));
          proc.emit('close', 0, null);
        });
        return proc;
      });

      const result = await executor.execute({ workingDir: '/w', prompt: 'p' });
      expect(result.output).toBe('ab');
      expect(result.success).toBe(true);
    });

    it('should invoke onStdoutChunk and onStderrChunk', async () => {
      const proc = createMockChildProcess();
      spawnMock.mockImplementation(() => {
        queueMicrotask(() => {
          proc.stdout!.push(Buffer.from('out'));
          proc.stderr!.push(Buffer.from('err'));
          proc.emit('close', 0, null);
        });
        return proc;
      });

      const onStdoutChunk = vi.fn();
      const onStderrChunk = vi.fn();

      await executor.execute({
        workingDir: '/w',
        prompt: 'p',
        onStdoutChunk,
        onStderrChunk,
      });

      expect(onStdoutChunk).toHaveBeenCalledWith('out');
      expect(onStderrChunk).toHaveBeenCalledWith('err');
    });

    it('should report failure when exit code is non-zero', async () => {
      const proc = createMockChildProcess();
      spawnMock.mockImplementation(() => {
        queueMicrotask(() => {
          proc.stderr!.push(Buffer.from('oops'));
          proc.emit('close', 2, null);
        });
        return proc;
      });

      const result = await executor.execute({ workingDir: '/w', prompt: 'p' });
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
      expect(result.error).toBe('oops');
    });

    it('should report spawn error', async () => {
      spawnMock.mockImplementation(() => {
        const proc = createMockChildProcess();
        queueMicrotask(() => {
          proc.emit('error', new Error('ENOENT'));
        });
        return proc;
      });

      const result = await executor.execute({ workingDir: '/w', prompt: 'p' });
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(-1);
      expect(result.error).toContain('Failed to execute Qoder CLI (qodercli)');
      expect(result.error).toContain('ENOENT');
    });
  });

  describe('isAvailable', () => {
    it('should resolve true when command -v exits 0', async () => {
      const proc = createMockChildProcess();
      spawnMock.mockImplementation((cmd) => {
        if (cmd === 'command') {
          queueMicrotask(() => proc.emit('close', 0, null));
          return proc;
        }
        const fallback = createMockChildProcess();
        queueMicrotask(() => fallback.emit('close', 0, null));
        return fallback;
      });

      await expect(executor.isAvailable()).resolves.toBe(true);
      expect(spawnMock).toHaveBeenCalledWith(
        'command',
        ['-v', 'qodercli'],
        expect.objectContaining({ stdio: 'pipe' })
      );
    });

    it('should resolve false when command -v exits non-zero', async () => {
      const proc = createMockChildProcess();
      spawnMock.mockImplementation((cmd) => {
        if (cmd === 'command') {
          queueMicrotask(() => proc.emit('close', 1, null));
          return proc;
        }
        const fallback = createMockChildProcess();
        queueMicrotask(() => fallback.emit('close', 0, null));
        return fallback;
      });

      await expect(executor.isAvailable()).resolves.toBe(false);
    });
  });

  describe('stop', () => {
    it('should no-op when no process', async () => {
      await expect(executor.stop()).resolves.toBeUndefined();
    });

    it('should send SIGTERM to current process', async () => {
      const proc = createMockChildProcess();
      spawnMock.mockImplementation(() => proc);

      const request: ToolExecutionRequest = {
        workingDir: '/w',
        prompt: 'p',
        timeout: 0,
      };
      void executor.execute(request);

      await vi.waitFor(() => {
        expect(spawnMock).toHaveBeenCalled();
      });

      await executor.stop();
      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });
});
