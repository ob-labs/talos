/**
 * Application Layer: Qoder CLI Executor
 *
 * Implements IToolExecutor for Qoder CLI (`qodercli` by default).
 * Matches CLI agents: `-w <workingDir> -f stream-json -p <prompt>`;
 * binary override via `TALOS_QODER_CLI`. Qoder does not accept `--model` on CLI.
 */

import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { kill } from 'node:process';

import type { IToolExecutor } from '@talos/types';
import type {
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolConfig,
} from '@talos/types';

import { createStreamChunkChain } from '../streamChunkChain';

function resolveQoderCliCommand(): string {
  const fromEnv = process.env.TALOS_QODER_CLI?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : 'qodercli';
}

export class QoderExecutor implements IToolExecutor {
  readonly name = 'qoder';

  private currentProcess: ChildProcess | null = null;
  private stopTimeoutMs = 5000;

  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const { workingDir, prompt, onStdoutChunk, onStderrChunk } = request;
    const wallMs = this.resolveWallClockTimeoutMs(request);
    const bin = resolveQoderCliCommand();

    const args = ['-w', workingDir, '-f', 'stream-json', '-p', prompt];
    const env = this.cleanEnvironment(process.env);

    let stdout = '';
    let stderr = '';

    return new Promise<ToolExecutionResult>((resolve) => {
      const streamChunks = createStreamChunkChain();
      let settled = false;
      let timedOut = false;
      let wallTimer: ReturnType<typeof setTimeout> | undefined;
      let forceKillTimer: ReturnType<typeof setTimeout> | undefined;

      const finishOnce = (result: ToolExecutionResult) => {
        if (settled) {
          return;
        }
        settled = true;
        if (wallTimer !== undefined) {
          clearTimeout(wallTimer);
          wallTimer = undefined;
        }
        if (forceKillTimer !== undefined) {
          clearTimeout(forceKillTimer);
          forceKillTimer = undefined;
        }
        streamChunks.finish(resolve, result);
      };

      try {
        this.currentProcess = spawn(bin, args, {
          cwd: workingDir,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        if (wallMs !== null) {
          wallTimer = setTimeout(() => {
            timedOut = true;
            const proc = this.currentProcess;
            if (!proc?.pid) {
              return;
            }
            const pid = proc.pid;
            proc.kill('SIGTERM');
            forceKillTimer = setTimeout(() => {
              try {
                kill(pid, 'SIGKILL');
              } catch {
                // ignore
              }
            }, this.stopTimeoutMs);
          }, wallMs);
        }

        if (this.currentProcess.stdout) {
          this.currentProcess.stdout.on('data', (data) => {
            const s = data.toString();
            stdout += s;
            streamChunks.chainStream(onStdoutChunk, s);
          });
        }

        if (this.currentProcess.stderr) {
          this.currentProcess.stderr.on('data', (data) => {
            const s = data.toString();
            stderr += s;
            streamChunks.chainStream(onStderrChunk, s);
          });
        }

        this.currentProcess.on('close', (code, signal) => {
          if (forceKillTimer !== undefined) {
            clearTimeout(forceKillTimer);
            forceKillTimer = undefined;
          }
          this.currentProcess = null;

          const success = code === 0;
          const output = stdout + stderr;
          const stderrTrim = stderr.trim();

          let error: string | undefined;
          if (success) {
            error = undefined;
          } else if (timedOut && wallMs !== null) {
            error = stderrTrim
              ? `Execution timed out after ${wallMs}ms: ${stderrTrim}`
              : `Execution timed out after ${wallMs}ms`;
          } else if (code === null && signal) {
            error = stderrTrim
              ? `${stderrTrim} (terminated by signal ${signal})`
              : `Process terminated by signal ${signal}`;
          } else {
            error = stderrTrim || 'Execution failed';
          }

          finishOnce({
            success,
            output,
            error,
            exitCode: code === null ? undefined : code,
          });
        });

        this.currentProcess.on('error', (err) => {
          this.currentProcess = null;

          finishOnce({
            success: false,
            output: stdout,
            error: `Failed to execute Qoder CLI (${bin}): ${err.message}`,
            exitCode: -1,
          });
        });
      } catch (error) {
        this.currentProcess = null;

        finishOnce({
          success: false,
          output: '',
          error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
          exitCode: -1,
        });
      }
    });
  }

  async isAvailable(): Promise<boolean> {
    const bin = resolveQoderCliCommand();
    return new Promise<boolean>((resolve) => {
      try {
        const checkProcess = spawn('command', ['-v', bin], {
          stdio: 'pipe',
        });

        checkProcess.on('close', (code) => {
          resolve(code === 0);
        });

        checkProcess.on('error', () => {
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.currentProcess) {
      return;
    }

    const pid = this.currentProcess.pid;
    if (!pid) {
      this.currentProcess = null;
      return;
    }

    this.currentProcess.kill('SIGTERM');

    const timeoutId = setTimeout(() => {
      if (this.currentProcess && this.currentProcess.pid === pid) {
        kill(pid, 'SIGKILL');
      }
    }, this.stopTimeoutMs);

    this.currentProcess.on('exit', () => {
      clearTimeout(timeoutId);
    });

    this.currentProcess = null;
  }

  getConfig(): ToolConfig {
    return {
      name: 'qoder',
      supportsDebugMode: true,
      supportedModels: [],
      defaultTimeout: 600000,
    };
  }

  private resolveWallClockTimeoutMs(
    request: ToolExecutionRequest
  ): number | null {
    if (request.timeout === 0) {
      return null;
    }
    if (typeof request.timeout === 'number' && request.timeout > 0) {
      return request.timeout;
    }
    const defaultMs = this.getConfig().defaultTimeout;
    if (typeof defaultMs === 'number' && defaultMs > 0) {
      return defaultMs;
    }
    return null;
  }

  private cleanEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const cleanedEnv = { ...env };
    delete cleanedEnv.CLAUDECODE;
    return cleanedEnv;
  }
}
