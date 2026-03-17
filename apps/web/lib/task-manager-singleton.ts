/**
 * Web UI Client Placeholder
 *
 * In the new architecture, the Web UI communicates with the Talos main process
 * via Socket API. The actual client implementation should be in the Web UI code itself.
 *
 * This file serves as a placeholder to maintain compatibility with existing imports.
 *
 * @deprecated Web UI should implement its own Socket client to communicate with Talos.
 * The new architecture does not support direct TaskManager access from Web UI.
 */

/**
 * Placeholder for TaskManager - not available in new architecture
 * Web UI should use Socket API to communicate with Talos main process
 */
export const taskManager = null;

/**
 * Placeholder type
 */
export interface ITaskManager {
  // This interface is kept for type compatibility
  // Actual implementation should use TalosClient from @talos/cli
}
