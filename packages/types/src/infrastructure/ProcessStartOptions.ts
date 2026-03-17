/**
 * Process Start Options
 *
 * Options for starting a new process.
 */

/**
 * Options for starting a process
 */
export interface ProcessStartOptions {
  /**
   * Command to execute (e.g., 'node', 'python', '/path/to/script')
   */
  command: string;

  /**
   * Command arguments
   */
  args?: string[];

  /**
   * Environment variables for the process
   * Merges with parent process environment by default
   */
  env?: Record<string, string>;

  /**
   * Working directory for the process
   * Defaults to current working directory
   */
  cwd?: string;

  /**
   * Process metadata (user-defined key-value pairs)
   * Can be used to tag processes with additional context
   */
  metadata?: Record<string, unknown>;

  /**
   * Whether to spawn the process in detached mode
   * When true, the process becomes a process group leader
   */
  detached?: boolean;

  /**
   * File descriptor for standard input
   */
  stdin?: 'ignore' | 'pipe' | 'inherit' | number;

  /**
   * File descriptor for standard output
   */
  stdout?: 'ignore' | 'pipe' | 'inherit' | number;

  /**
   * File descriptor for standard error
   */
  stderr?: 'ignore' | 'pipe' | 'inherit' | number;

  /**
   * Whether to create a new process group
   * When true, the process and its children can be managed as a group
   */
  createGroup?: boolean;
}
