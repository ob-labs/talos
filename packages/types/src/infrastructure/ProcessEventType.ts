/**
 * Process Event Type
 *
 * Defines the types of events that can be emitted by the ProcessManager.
 */

/**
 * Supported process event types
 */
export type ProcessEventType = 'process:start' | 'process:exit';

/**
 * Base interface for process events
 */
export interface ProcessEvent {
  /**
   * Event type
   */
  type: ProcessEventType;

  /**
   * Process ID
   */
  pid: number;

  /**
   * Timestamp when the event occurred
   */
  timestamp: Date;
}

/**
 * Event emitted when a process starts
 */
export interface ProcessStartEvent extends ProcessEvent {
  type: 'process:start';
  /**
   * Process type/category
   */
  processType: string;

  /**
   * Process metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Event emitted when a process exits
 */
export interface ProcessExitEvent extends ProcessEvent {
  type: 'process:exit';

  /**
   * Process exit code (0-255)
   * null if the process was terminated by a signal
   */
  exitCode: number | null;

  /**
   * Signal that terminated the process (e.g., 'SIGTERM', 'SIGKILL')
   * null if the process exited normally
   */
  exitSignal: NodeJS.Signals | null;

  /**
   * Process exit result
   */
  result: 'success' | 'failed' | 'killed';
}
