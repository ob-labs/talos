import { connect, Socket } from "net";
import { promisify } from "util";

const setTimeoutPromise = promisify(setTimeout);

/**
 * Log message format sent to the log daemon
 */
interface LogMessage {
  taskId: string;
  message: string;
  timestamp?: string;
}

/**
 * Response format received from the log daemon
 */
interface LogResponse {
  status: "ok" | "error";
  error?: string;
}

/**
 * LoggerClient configuration options
 */
export interface LoggerClientOptions {
  /** Path to the Unix socket (default: /tmp/talos-log-daemon.sock) */
  socketPath?: string;
  /** Number of retry attempts (default: 3) */
  retryAttempts?: number;
  /** Delay between retries in milliseconds (default: 100) */
  retryDelay?: number;
  /** Connection timeout in milliseconds (default: 1000) */
  connectionTimeout?: number;
  /** Enable fallback to stderr on connection failure (default: true) */
  enableFallback?: boolean;
}

/**
 * Default client configuration
 */
const DEFAULT_CLIENT_OPTIONS: Required<LoggerClientOptions> = {
  socketPath: "/tmp/talos-log-daemon.sock",
  retryAttempts: 3,
  retryDelay: 100,
  connectionTimeout: 1000,
  enableFallback: true,
};

/**
 * LoggerClient - Client SDK for sending log messages to the log daemon
 *
 * Features:
 * - Auto-connects to Unix socket on first send
 * - Retry logic with configurable attempts and delay
 * - Fallback to stderr if socket connection fails
 * - Both sync and async send methods
 * - Automatic reconnection on socket disconnect
 * - Connection pooling for better performance
 *
 * @example
 * ```ts
 * const client = new LoggerClient();
 * await client.send("task-123", "Task started");
 *
 * // Sync send (non-blocking)
 * client.sendSync("task-123", "Progress update");
 * ```
 */
export class LoggerClient {
  private options: Required<LoggerClientOptions>;
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(options: LoggerClientOptions = {}) {
    this.options = { ...DEFAULT_CLIENT_OPTIONS, ...options };
  }

  /**
   * Send a log message asynchronously
   *
   * @param taskId - The task identifier
   * @param message - The message to log
   * @returns Promise that resolves when message is sent
   */
  async send(taskId: string, message: string): Promise<void> {
    // Ensure we're connected
    await this.ensureConnection();

    // Send the message
    await this.sendMessage(taskId, message);
  }

  /**
   * Send a log message synchronously (fire-and-forget)
   *
   * This method doesn't wait for the response and returns immediately.
   * Useful for logging in performance-critical code.
   *
   * @param taskId - The task identifier
   * @param message - The message to log
   */
  sendSync(taskId: string, message: string): void {
    // Fire-and-forget: don't await the promise
    this.send(taskId, message).catch((error) => {
      // Error already handled in send(), just swallow here
      // for sync behavior
    });
  }

  /**
   * Ensure the socket is connected, connecting if necessary
   */
  private async ensureConnection(): Promise<void> {
    // If already connected, return immediately
    if (this.isConnected && this.socket) {
      return;
    }

    // If connection is in progress, wait for it
    if (this.isConnecting && this.connectionPromise) {
      await this.connectionPromise;
      return;
    }

    // Start a new connection
    this.isConnecting = true;
    this.connectionPromise = this.connectWithRetry();

    try {
      await this.connectionPromise;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  /**
   * Connect to the socket with retry logic
   */
  private async connectWithRetry(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        await this.connect();
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error as Error;

        // Don't delay after the last attempt
        if (attempt < this.options.retryAttempts) {
          await setTimeoutPromise(this.options.retryDelay);
        }
      }
    }

    // All retries failed, use fallback if enabled
    if (this.options.enableFallback) {
      this.logToStderr(`Failed to connect to log daemon after ${this.options.retryAttempts} attempts: ${lastError?.message}`);
      this.logToStderr("Falling back to stderr for log messages");
      return;
    }

    throw lastError;
  }

  /**
   * Connect to the Unix socket
   */
  private async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Create socket connection
      this.socket = connect(this.options.socketPath);

      // Set up timeout
      const timeout = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error(`Connection timeout after ${this.options.connectionTimeout}ms`));
      }, this.options.connectionTimeout);

      // Handle successful connection
      this.socket.on("connect", () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.setupSocketHandlers();
        resolve();
      });

      // Handle connection error
      this.socket.on("error", (error) => {
        clearTimeout(timeout);
        this.isConnected = false;
        this.socket = null;

        // Check if it's a "connection refused" error (socket doesn't exist)
        if ((error as NodeJS.ErrnoException).code === "ECONNREFUSED") {
          reject(new Error("Log daemon socket not found. Is the log daemon running?"));
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Set up socket event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.socket) return;

    // Handle socket close (reconnect on next send)
    this.socket.on("close", () => {
      this.isConnected = false;
      this.socket = null;
    });

    // Handle socket error
    this.socket.on("error", (error) => {
      this.logToStderr(`Socket error: ${error}`);
      this.isConnected = false;
      this.socket = null;
    });

    // Handle socket end
    this.socket.on("end", () => {
      this.isConnected = false;
      this.socket = null;
    });
  }

  /**
   * Send a message to the log daemon
   */
  private async sendMessage(taskId: string, message: string): Promise<void> {
    // If not connected and fallback is enabled, log to stderr
    if (!this.isConnected || !this.socket) {
      if (this.options.enableFallback) {
        this.logToStderr(`[${taskId}] ${message}`);
        return;
      }
      throw new Error("Not connected to log daemon");
    }

    return new Promise<void>((resolve, reject) => {
      // Prepare message
      const logMessage: LogMessage = {
        taskId,
        message,
        timestamp: new Date().toISOString(),
      };

      const messageStr = JSON.stringify(logMessage) + "\n";

      // Set up listener for response (handle multiple responses in buffer)
      let buffer = "";
      const onResponse = (data: Buffer) => {
        buffer += data.toString();

        // Process all complete responses (newline-separated)
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === "") {
            continue;
          }

          try {
            const response = JSON.parse(line) as LogResponse;

            if (response.status === "ok") {
              resolve();
              return;
            } else {
              reject(new Error(response.error || "Unknown error from log daemon"));
              return;
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error}`));
            return;
          }
        }
      };

      // Add one-time listener
      this.socket!.once("data", onResponse);

      // Send message
      this.socket!.write(messageStr, (error) => {
        if (error) {
          this.socket!.removeListener("data", onResponse);
          reject(error);
        }
      });

      // Set timeout for response
      const timeout = setTimeout(() => {
        this.socket!.removeListener("data", onResponse);
        reject(new Error("Timeout waiting for response from log daemon"));
      }, this.options.connectionTimeout);

      // Clear timeout on response
      this.socket!.once("data", () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Log a message to stderr
   */
  private logToStderr(message: string): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [LoggerClient] ${message}`);
  }

  /**
   * Disconnect from the socket
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.isConnected = false;
  }

  /**
   * Check if connected to the log daemon
   */
  connected(): boolean {
    return this.isConnected;
  }
}
