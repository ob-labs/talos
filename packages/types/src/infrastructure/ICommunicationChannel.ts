/**
 * Infrastructure Layer: Communication Channel Interface
 *
 * Defines the contract for bidirectional message-based communication.
 * Implementations typically use sockets, IPC, or similar transport mechanisms.
 */

/**
 * Message payload structure
 * Can be any JSON-serializable data
 */
export type MessagePayload = unknown;

/**
 * Message structure for communication
 */
export interface Message {
  /**
   * Message type or action identifier
   * Used to route messages to appropriate handlers
   */
  type: string;

  /**
   * Message payload
   */
  payload: MessagePayload;

  /**
   * Optional message ID for request-response correlation
   */
  id?: string;

  /**
   * Optional timestamp for message tracking
   */
  timestamp?: Date;
}

/**
 * Message handler function type
 *
 * @param message - The received message
 * @returns Optional response or Promise for async handlers
 */
export type MessageHandler = (
  message: Message
) => MessagePayload | void | Promise<MessagePayload | void>;

/**
 * Connection state
 */
export enum ConnectionState {
  /**
   * Channel is disconnected
   */
  Disconnected = 'disconnected',

  /**
   * Channel is connecting
   */
  Connecting = 'connecting',

  /**
   * Channel is connected and ready
   */
  Connected = 'connected',

  /**
   * Channel is disconnecting
   */
  Disconnecting = 'disconnecting',

  /**
   * Channel encountered an error
   */
  Error = 'error',
}

/**
 * Communication Channel Interface
 *
 * Provides abstraction over bidirectional message-based communication.
 * Implementations must support:
 * - Sending messages to the remote endpoint
 * - Registering message handlers for specific message types
 * - Connection lifecycle management
 * - Event-driven architecture for real-time communication
 *
 * Typical implementation patterns:
 * - Socket-based (Unix domain sockets, TCP sockets)
 * - IPC-based (inter-process communication)
 * - WebSocket-based (HTTP communication)
 */
export interface ICommunicationChannel {
  /**
   * Send a message to the remote endpoint
   *
   * @param message - Message to send
   * @returns Promise that resolves when message is sent
   *
   * @throws {Error} If the channel is not connected
   * @throws {Error} If the message cannot be serialized
   * @throws {Error} If the send operation fails
   *
   * Implementation notes:
   * - Must throw if channel is not in Connected state
   * - Must serialize messages (typically to JSON)
   * - Should handle send failures gracefully
   * - May queue messages if connection is temporarily unavailable
   */
  send(message: Message): Promise<void>;

  /**
   * Register a message handler for a specific message type
   *
   * @param messageType - Message type to handle (e.g., 'task_status', 'log_entry')
   * @param handler - Handler function to process messages of this type
   *
   * Implementation notes:
   * - Multiple handlers can be registered for the same message type
   * - Handlers are called in the order they were registered
   * - Handlers should be called asynchronously (non-blocking)
   * - Should handle exceptions in user handlers gracefully
   * - Must support wildcard ('*') for handling all message types
   */
  on(messageType: string, handler: MessageHandler): void;

  /**
   * Unregister a message handler
   *
   * @param messageType - Message type the handler was registered for
   * @param handler - Handler function to remove
   *
   * Implementation notes:
   * - Should silently ignore non-existent handlers
   * - Must support wildcard ('*') to remove wildcard handlers
   */
  off(messageType: string, handler: MessageHandler): void;

  /**
   * Connect to the remote endpoint
   *
   * @param endpoint - Connection endpoint (e.g., socket path, URL, IPC name)
   * @returns Promise that resolves when connection is established
   *
   * @throws {Error} If connection fails
   * @throws {Error} If already connected
   *
   * Implementation notes:
   * - Must set state to Connecting during connection attempt
   * - Must set state to Connected on success
   * - Must set state to Error on failure
   * - Should support automatic reconnection with backoff
   * - Must emit connection events if supported
   */
  connect(endpoint: string): Promise<void>;

  /**
   * Disconnect from the remote endpoint
   *
   * @returns Promise that resolves when disconnection is complete
   *
   * Implementation notes:
   * - Must set state to Disconnecting during disconnection
   * - Must set state to Disconnected when complete
   * - Should gracefully flush pending messages before disconnecting
   * - Must clean up all resources (sockets, timers, etc.)
   * - Must emit disconnection events if supported
   */
  disconnect(): Promise<void>;

  /**
   * Get the current connection state
   *
   * @returns Current connection state
   *
   * Implementation notes:
   * - Must be thread-safe (if applicable)
   * - Should reflect the actual state, not a cached state
   */
  getState(): ConnectionState;

  /**
   * Check if the channel is currently connected
   *
   * @returns true if connected, false otherwise
   *
   * Implementation notes:
   * - Equivalent to getState() === ConnectionState.Connected
   * - Provided for convenience
   */
  isConnected(): boolean;
}
