/**
 * Success Process Exit Result
 *
 * Represents a process that exited successfully (exit code 0).
 */

import { ProcessExitResult } from './ProcessExitResult';

/**
 * Process exit result for successful execution
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
