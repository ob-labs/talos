/**
 * Socket Server Interface
 *
 * Provides bidirectional communication channel for CLI/Web to daemon.
 * Handles request/response messaging over Unix domain sockets.
 */
export interface ISocketServer {
  /**
   * Start the socket server
   *
   * Begins listening for incoming connections on the configured socket path.
   * Removes existing socket file if present.
   */
  start(): Promise<void>;

  /**
   * Stop the socket server
   *
   * Stops listening for new connections and closes the socket.
   * Removes the socket file.
   */
  stop(): Promise<void>;

  /**
   * Check if server is active
   *
   * @returns true if server is listening, false otherwise
   */
  isActive(): boolean;
}
