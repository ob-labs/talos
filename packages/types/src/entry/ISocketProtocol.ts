/**
 * Entry Layer: Socket Protocol Interface
 *
 * Defines the contract for Socket-based communication protocol.
 * Used for client-daemon communication in Talos.
 */

import type { SocketMessage } from './SocketMessage';

/**
 * Socket Protocol Interface
 *
 * Defines versioned protocol for Socket communication.
 * Implementations handle message serialization/deserialization.
 */
export interface ISocketProtocol {
  /**
   * Protocol version
   * Used for compatibility checking between client and server
   */
  readonly version: string;

  /**
   * Send a message through the Socket
   *
   * @param message - Message to send
   * @throws {Error} If send fails
   */
  send(message: SocketMessage): void;

  /**
   * Register a message handler
   *
   * @param handler - Message handler function
   */
  on(handler: (message: SocketMessage) => void): void;

  /**
   * Check if protocol version is supported
   *
   * @param version - Version to check
   * @returns true if version is supported
   */
  supportsVersion(version: string): boolean;
}
