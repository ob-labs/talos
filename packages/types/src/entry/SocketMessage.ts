/**
 * Entry Layer: Socket Message Type
 *
 * Defines the message format for Socket-based communication.
 * Used for client-daemon communication in Talos.
 */

/**
 * Socket Message Type
 *
 * Represents a message sent over Socket communication.
 * Messages are versioned for protocol compatibility.
 */
export interface SocketMessage {
  /**
   * Protocol version
   * Used for compatibility checking
   */
  version: string;

  /**
   * Message type
   * Defines the kind of message (e.g., "request", "response", "event")
   */
  type: string;

  /**
   * Message payload
   * Contains the actual data being sent
   */
  payload: unknown;

  /**
   * Optional message ID
   * Used for request/response correlation
   */
  id?: string;
}
