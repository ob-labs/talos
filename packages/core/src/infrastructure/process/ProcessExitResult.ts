/**
 * Process Exit Result
 *
 * Abstract base class for semantic exit results with factory methods.
 * Provides type-safe ways to check and handle different exit scenarios.
 */

import type { ProcessRuntimeInfo } from '@talos/types';

/**
 * Process exit status
 */
export type ProcessExitStatus = 'success' | 'failed' | 'killed';

/**
 * Abstract base class for process exit results
 * Uses discriminated union pattern for type-safe handling
 */
export abstract class ProcessExitResult {
  /**
   * Check if the process exited successfully
   */
  abstract isSuccess(): boolean;

  /**
   * Get the exit status
   */
  abstract getStatus(): ProcessExitStatus;

  /**
   * Get the reason for exit (human-readable)
   */
  abstract getReason(): string;

  /**
   * Get the exit code (if available)
   */
  abstract getExitCode(): number | null;

  /**
   * Get the exit signal (if available)
   */
  abstract getExitSignal(): NodeJS.Signals | null;

  /**
   * Get the exit timestamp
   */
  abstract getExitTime(): Date;

  /**
   * Create a ProcessExitResult from ProcessRuntimeInfo
   */
  static fromInfo(info: ProcessRuntimeInfo): ProcessExitResult {
    if (info.isRunning) {
      throw new Error('Process is still running, cannot create exit result');
    }

    const exitTime = info.exitTime ?? new Date();

    // If killed by signal
    if (info.exitSignal !== null && info.exitSignal !== undefined) {
      return new KilledProcessExitResult(info.exitSignal, exitTime);
    }

    // If exited with code
    const exitCode = info.exitCode;
    if (exitCode !== null && exitCode !== undefined) {
      if (exitCode === 0) {
        return new SuccessProcessExitResult(exitCode, exitTime);
      } else {
        return new FailedProcessExitResult(exitCode, exitTime);
      }
    }

    // Default: assume successful exit if no code or signal
    return new SuccessProcessExitResult(0, exitTime);
  }

  /**
   * Create a ProcessExitResult from an exit code
   */
  static fromExitCode(exitCode: number, exitTime: Date = new Date()): ProcessExitResult {
    if (exitCode === 0) {
      return new SuccessProcessExitResult(exitCode, exitTime);
    } else {
      return new FailedProcessExitResult(exitCode, exitTime);
    }
  }
}

/**
 * Success Process Exit Result
 *
 * Represents a process that exited successfully (exit code 0).
 */
export class SuccessProcessExitResult extends ProcessExitResult {
  constructor(
    private readonly exitCode: number,
    private readonly exitTime: Date
  ) {
    super();
  }

  /**
   * Always returns true for successful exits
   */
  isSuccess(): boolean {
    return true;
  }

  /**
   * Returns 'success' status
   */
  getStatus(): 'success' {
    return 'success';
  }

  /**
   * Returns human-readable reason
   */
  getReason(): string {
    return `Process exited successfully with code ${this.exitCode}`;
  }

  /**
   * Returns the exit code (should be 0)
   */
  getExitCode(): number {
    return this.exitCode;
  }

  /**
   * Returns null (no signal for successful exit)
   */
  getExitSignal(): null {
    return null;
  }

  /**
   * Returns the exit timestamp
   */
  getExitTime(): Date {
    return this.exitTime;
  }
}

/**
 * Failed Process Exit Result
 *
 * Represents a process that exited with a non-zero exit code.
 */
export class FailedProcessExitResult extends ProcessExitResult {
  constructor(
    private readonly exitCode: number,
    private readonly exitTime: Date
  ) {
    super();
  }

  /**
   * Always returns false for failed exits
   */
  isSuccess(): boolean {
    return false;
  }

  /**
   * Returns 'failed' status
   */
  getStatus(): 'failed' {
    return 'failed';
  }

  /**
   * Returns human-readable reason
   */
  getReason(): string {
    return `Process failed with exit code ${this.exitCode}`;
  }

  /**
   * Returns the non-zero exit code
   */
  getExitCode(): number {
    return this.exitCode;
  }

  /**
   * Returns null (no signal for failed exit)
   */
  getExitSignal(): null {
    return null;
  }

  /**
   * Returns the exit timestamp
   */
  getExitTime(): Date {
    return this.exitTime;
  }
}

/**
 * Killed Process Exit Result
 *
 * Represents a process that was terminated by a signal.
 */
export class KilledProcessExitResult extends ProcessExitResult {
  constructor(
    private readonly exitSignal: NodeJS.Signals,
    private readonly exitTime: Date
  ) {
    super();
  }

  /**
   * Always returns false for killed processes
   */
  isSuccess(): boolean {
    return false;
  }

  /**
   * Returns 'killed' status
   */
  getStatus(): 'killed' {
    return 'killed';
  }

  /**
   * Returns human-readable reason
   */
  getReason(): string {
    return `Process was killed by signal ${this.exitSignal}`;
  }

  /**
   * Returns null (no exit code for signal termination)
   */
  getExitCode(): null {
    return null;
  }

  /**
   * Returns the terminating signal
   */
  getExitSignal(): NodeJS.Signals {
    return this.exitSignal;
  }

  /**
   * Returns the exit timestamp
   */
  getExitTime(): Date {
    return this.exitTime;
  }
}
