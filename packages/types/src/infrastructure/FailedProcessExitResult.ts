/**
 * Failed Process Exit Result
 *
 * Represents a process that exited with a non-zero exit code.
 */

import { ProcessExitResult } from './ProcessExitResult';

/**
 * Process exit result for failed execution
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
