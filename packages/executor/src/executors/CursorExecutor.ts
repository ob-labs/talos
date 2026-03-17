/**
 * Application Layer: Cursor Executor
 *
 * Implements the IToolExecutor interface for Cursor IDE's cursor-agent CLI.
 * Encapsulates cursor-agent calling details including temp file handling,
 * command building, environment cleanup, and idle timeout mechanism.
 *
 * WORKAROUND: cursor-agent --print does not exit properly after completion.
 * This implementation uses an idle timeout mechanism to detect completion
 * and force termination.
 */

import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { kill } from 'node:process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { IToolExecutor } from '@talos/types';
import type {
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolConfig,
} from '@talos/types';

/**
 * Cursor Executor
 *
 * Executes Cursor IDE's cursor-agent CLI with proper environment setup,
 * temp file handling, and idle timeout workaround.
 *
 * The idle timeout mechanism is a WORKAROUND for cursor-agent --print not
 * exiting properly. It monitors stdout for completion signals and forces
 * termination if no output is received for the timeout period.
 */
export class CursorExecutor implements IToolExecutor {
  readonly name = 'cursor';

  private currentProcess: ChildProcess | null = null;
  private stopTimeoutMs = 5000; // 5 seconds for SIGTERM to SIGKILL timeout
  private tempDir: string | null = null;

  // Idle timeout configuration
  private readonly idleTimeoutDebugMs = 2000; // 2 seconds in debug mode
  private readonly idleTimeoutNormalMs = 60000; // 60 seconds in normal mode
  private idleCheckInterval: NodeJS.Timeout | null = null;
  private lastOutputTime: number = 0;

  /**
   * Execute a Cursor agent task
   *
   * @param request - Tool execution request with prompt and options
   * @returns Execution result with success status, output, and error info
   */
  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const { workingDir, prompt, debug, model } = request;

    // Create temp directory for prompt file
    this.tempDir = await mkdtemp(join(tmpdir(), 'talos-cursor-'));

    // Build command arguments
    const args = this.buildCommandArgs(debug, model);

    // Clean environment variables to avoid nested sessions
    const env = this.cleanEnvironment(process.env);

    // Determine idle timeout based on debug mode
    const idleTimeoutMs = debug ? this.idleTimeoutDebugMs : this.idleTimeoutNormalMs;

    let stdout = '';
    let stderr = '';
    let tempFilePath: string | null = null;

    // Create temp file for prompt (cursor-agent doesn't support stdin directly)
    const timestamp = Date.now();
    tempFilePath = join(this.tempDir!, `prompt-${timestamp}.txt`);
    await writeFile(tempFilePath, prompt, 'utf-8');

    return new Promise<ToolExecutionResult>((resolve) => {
      try {
        // Build shell command: cat "{tempFile}" | cursor-agent --print --trust --force
        const shellCommand = `cat "${tempFilePath}" | cursor-agent ${args.join(' ')}`;

        this.currentProcess = spawn('sh', ['-c', shellCommand], {
          cwd: workingDir,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Initialize last output time
        this.lastOutputTime = Date.now();

        // Start idle timeout checker
        this.startIdleChecker(idleTimeoutMs, resolve);

        // Collect stdout and update last output time
        if (this.currentProcess.stdout) {
          this.currentProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            this.lastOutputTime = Date.now();

            // Check for completion signal in debug mode
            if (debug && this.isCompletionSignal(stdout)) {
              // Give it a short moment to finish, then timeout
              setTimeout(() => {
                this.cleanupAndResolve(resolve, stdout, stderr, this.currentProcess);
              }, 500);
            }
          });
        }

        // Collect stderr and update last output time
        if (this.currentProcess.stderr) {
          this.currentProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            this.lastOutputTime = Date.now();
          });
        }

        // Handle process exit
        this.currentProcess.on('close', (code) => {
          this.stopIdleChecker();
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
          this.stopIdleChecker();
          this.currentProcess = null;

          resolve({
            success: false,
            output: stdout,
            error: `Failed to execute Cursor agent: ${error.message}`,
            exitCode: -1,
          });
        });
      } catch (error) {
        this.stopIdleChecker();
        this.currentProcess = null;

        resolve({
          success: false,
          output: '',
          error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
          exitCode: -1,
        });
      }
    });

    // Clean up temp file after Promise is set up
    if (tempFilePath) {
      try {
        await rm(tempFilePath!, { force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Check if Cursor agent CLI is available
   *
   * @returns true if the 'cursor-agent' command exists and is executable
   */
  async isAvailable(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      try {
        const checkProcess = spawn('command', ['-v', 'cursor-agent'], {
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
   * Stop the currently running Cursor agent process
   *
   * Attempts SIGTERM first, then SIGKILL after timeout if needed.
   */
  async stop(): Promise<void> {
    this.stopIdleChecker();

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
   * Get Cursor agent configuration
   *
   * @returns Tool configuration with supported models and capabilities
   */
  getConfig(): ToolConfig {
    return {
      name: 'cursor',
      supportsDebugMode: true,
      supportedModels: [
        'composer-1.5',
        'composer-1.0',
      ],
      defaultTimeout: 300000, // 5 minutes default
    };
  }

  /**
   * Build command arguments for Cursor agent execution
   *
   * @param debug - Enable debug mode
   * @param model - Optional model identifier
   * @returns Array of command arguments
   */
  private buildCommandArgs(debug?: boolean, model?: string): string[] {
    const args: string[] = ['--print', '--trust', '--force'];

    // Add model parameter if provided
    if (model) {
      args.push('--model', model);
    }

    // Add debug mode argument
    if (debug) {
      args.push('--output-format', 'stream-json');
    }

    return args;
  }

  /**
   * Clean environment variables to avoid nested sessions
   *
   * @param env - Current process environment
   * @returns Cleaned environment object
   */
  private cleanEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const cleanedEnv = { ...env };

    // Delete environment variables that would cause nested sessions
    delete cleanedEnv.CLAUDECODE;

    return cleanedEnv;
  }

  /**
   * Start idle timeout checker
   *
   * Monitors stdout for inactivity and forces termination if timeout is reached.
   *
   * @param idleTimeoutMs - Idle timeout in milliseconds
   * @param resolve - Promise resolve function to call on timeout
   */
  private startIdleChecker(
    idleTimeoutMs: number,
    resolve: (value: ToolExecutionResult) => void
  ): void {
    this.idleCheckInterval = setInterval(() => {
      const now = Date.now();
      const idleTime = now - this.lastOutputTime;

      if (idleTime >= idleTimeoutMs && this.currentProcess) {
        // Idle timeout reached, stop the process
        this.stopIdleChecker();
        this.cleanupAndResolve(
          resolve,
          '', // stdout will be collected from process
          'Idle timeout reached (cursor-agent --print did not exit properly)',
          this.currentProcess
        );
      }
    }, 1000); // Check every second
  }

  /**
   * Stop idle timeout checker
   */
  private stopIdleChecker(): void {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
  }

  /**
   * Check if stdout contains completion signal (debug mode)
   *
   * @param stdout - Standard output content
   * @returns true if completion signal is detected
   */
  private isCompletionSignal(stdout: string): boolean {
    // Look for result followed by success in stream-json format
    return stdout.includes('"type": "result"') && stdout.includes('"type": "success"');
  }

  /**
   * Cleanup and resolve promise
   *
   * @param resolve - Promise resolve function
   * @param stdout - Collected stdout
   * @param stderr - Collected stderr
   * @param process - Child process to cleanup
   */
  private cleanupAndResolve(
    resolve: (value: ToolExecutionResult) => void,
    stdout: string,
    stderr: string,
    process: ChildProcess | null
  ): void {
    this.stopIdleChecker();

    if (process) {
      const pid = process.pid;

      // Send SIGTERM
      process.kill('SIGTERM');

      // Force resolve after 2 seconds
      setTimeout(() => {
        if (pid !== undefined && process.pid === pid) {
          kill(pid, 'SIGKILL');
        }

        resolve({
          success: stderr === '' || !stderr.includes('error'),
          output: stdout,
          error: stderr || undefined,
          exitCode: 0,
        });
      }, 2000);
    }
  }
}
