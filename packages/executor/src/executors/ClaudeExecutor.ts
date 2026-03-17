/**
 * Application Layer: Claude Code Executor
 *
 * Implements the IToolExecutor interface for Claude Code CLI.
 * Encapsulates Claude Code calling details including command building,
 * environment cleanup, and process management.
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

/**
 * Claude Code Executor
 *
 * Executes Claude Code CLI with proper environment setup and cleanup.
 * Handles process lifecycle, availability checks, and result collection.
 */
export class ClaudeExecutor implements IToolExecutor {
  readonly name = 'claude';

  private currentProcess: ChildProcess | null = null;
  private stopTimeoutMs = 5000; // 5 seconds for SIGTERM to SIGKILL timeout

  /**
   * Execute a Claude Code task
   *
   * @param request - Tool execution request with prompt and options
   * @returns Execution result with success status, output, and error info
   */
  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const { workingDir, prompt, debug, model } = request;

    // Build command arguments
    const args = this.buildCommandArgs(debug, model);

    // Clean environment variables to avoid nested sessions
    const env = this.cleanEnvironment(process.env);

    let stdout = '';
    let stderr = '';

    return new Promise<ToolExecutionResult>((resolve) => {
      try {
        this.currentProcess = spawn('claude', args, {
          cwd: workingDir,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Pass prompt via stdin
        if (this.currentProcess.stdin) {
          this.currentProcess.stdin.write(prompt);
          this.currentProcess.stdin.end();
        }

        // Collect stdout
        if (this.currentProcess.stdout) {
          this.currentProcess.stdout.on('data', (data) => {
            stdout += data.toString();
          });
        }

        // Collect stderr
        if (this.currentProcess.stderr) {
          this.currentProcess.stderr.on('data', (data) => {
            stderr += data.toString();
          });
        }

        // Handle process exit
        this.currentProcess.on('close', (code) => {
          this.currentProcess = null;

          const success = code === 0;
          const output = stdout + stderr;

          resolve({
            success,
            output,
            error: success ? undefined : stderr || 'Execution failed',
            exitCode: code === null ? undefined : code,
          });
        });

        // Handle process error (e.g., command not found)
        this.currentProcess.on('error', (error) => {
          this.currentProcess = null;

          resolve({
            success: false,
            output: '',
            error: `Failed to execute Claude Code: ${error.message}`,
            exitCode: -1,
          });
        });
      } catch (error) {
        this.currentProcess = null;

        resolve({
          success: false,
          output: '',
          error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
          exitCode: -1,
        });
      }
    });
  }

  /**
   * Check if Claude Code CLI is available
   *
   * @returns true if the 'claude' command exists and is executable
   */
  async isAvailable(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      try {
        const checkProcess = spawn('command', ['-v', 'claude'], {
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

  /**
   * Stop the currently running Claude Code process
   *
   * Attempts SIGTERM first, then SIGKILL after timeout if needed.
   */
  async stop(): Promise<void> {
    if (!this.currentProcess) {
      return; // No process running, no-op
    }

    const pid = this.currentProcess.pid;
    if (!pid) {
      this.currentProcess = null;
      return;
    }

    // Attempt SIGTERM first
    this.currentProcess.kill('SIGTERM');

    // Wait for graceful shutdown, then SIGKILL if needed
    const timeoutId = setTimeout(() => {
      if (this.currentProcess && this.currentProcess.pid === pid) {
        // Force kill if still running
        kill(pid, 'SIGKILL');
      }
    }, this.stopTimeoutMs);

    // Clear timeout if process exits
    this.currentProcess.on('exit', () => {
      clearTimeout(timeoutId);
    });

    this.currentProcess = null;
  }

  /**
   * Get Claude Code configuration
   *
   * @returns Tool configuration with supported models and capabilities
   */
  getConfig(): ToolConfig {
    return {
      name: 'claude',
      supportsDebugMode: true,
      supportedModels: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-opus-20241022',
        'claude-3-haiku-20240307',
      ],
    };
  }

  /**
   * Build command arguments for Claude Code execution
   *
   * @param debug - Enable debug mode
   * @param model - Optional model identifier
   * @returns Array of command arguments
   */
  private buildCommandArgs(debug?: boolean, model?: string): string[] {
    const args: string[] = ['--dangerously-skip-permissions', '--print'];

    // Add model parameter if provided
    if (model) {
      args.push('--model', model);
    }

    // Add debug mode arguments
    if (debug) {
      args.push('--output-format', 'stream-json', '--verbose');
    }

    return args;
  }

  /**
   * Clean environment variables to avoid nested Claude Code sessions
   *
   * @param env - Current process environment
   * @returns Cleaned environment object
   */
  private cleanEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const cleanedEnv = { ...env };

    // Delete environment variables that would cause nested sessions
    delete cleanedEnv.CLAUDECODE;
    delete cleanedEnv.CLAUDE_CODE_ENTRYPOINT;

    return cleanedEnv;
  }
}
