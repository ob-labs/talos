/**
 * Killed Process Exit Result
 *
 * Represents a process that was terminated by a signal.
 */

import { ProcessExitResult } from './ProcessExitResult';

/**
 * Process exit result for signal termination
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
