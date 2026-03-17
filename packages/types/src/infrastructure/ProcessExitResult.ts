/**
 * Process Exit Result
 *
 * Abstract base class for semantic exit results.
 * Provides type-safe ways to check and handle different exit scenarios.
 */

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
}
