/**
 * Infrastructure Layer: Protocol Manager
 *
 * Manages Socket protocol versions and message conversion.
 * Handles version negotiation and message transformation between protocol versions.
 */

import type { SocketMessage } from "@talos/types";

/**
 * Current protocol version
 */
export const CURRENT_VERSION = "1.0";

/**
 * Protocol Manager Options
 */
export interface ProtocolManagerOptions {
  /** Supported protocol versions (default: ["1.0"]) */
  supportedVersions?: string[];
  /** Default protocol version (default: CURRENT_VERSION) */
  defaultVersion?: string;
}

/**
 * Protocol Manager
 *
 * Manages protocol version negotiation and message transformation.
 * Phase 4 only implements version 1.0 (no conversion logic).
 * Later versions will implement field mapping and data conversion.
 */
export class ProtocolManager {
  private readonly supportedVersions: string[];
  private readonly defaultVersion: string;

  /**
   * Create a new ProtocolManager
   *
   * @param options - Protocol manager options
   */
  constructor(options: ProtocolManagerOptions = {}) {
    this.supportedVersions = options.supportedVersions || [CURRENT_VERSION];
    this.defaultVersion = options.defaultVersion || CURRENT_VERSION;

    // Validate default version is supported
    if (!this.supportedVersions.includes(this.defaultVersion)) {
      throw new Error(
        `Default version ${this.defaultVersion} is not in supported versions`
      );
    }
  }

  /**
   * Negotiate protocol version with client
   *
   * @param clientVersion - Client's preferred version (optional)
   * @returns Negotiated version
   * @throws {Error} If client version is not supported
   */
  negotiateVersion(clientVersion?: string): string {
    // If client doesn't specify version, use default
    if (!clientVersion) {
      return this.defaultVersion;
    }

    // Check if client version is supported
    if (!this.supportedVersions.includes(clientVersion)) {
      throw new Error(
        `Unsupported protocol version: ${clientVersion}. Supported versions: ${this.supportedVersions.join(", ")}`
      );
    }

    return clientVersion;
  }

  /**
   * Transform message to target version
   *
   * Converts message from current version to target version.
   * Phase 4 only implements version 1.0 (no conversion).
   * Later versions will implement field mapping and data conversion.
   *
   * @param message - Source message
   * @param targetVersion - Target protocol version
   * @returns Transformed message
   */
  transformMessage(message: SocketMessage, targetVersion: string): SocketMessage {
    // Phase 4: Only version 1.0, no conversion needed
    if (targetVersion === CURRENT_VERSION) {
      return message;
    }

    // Future versions will implement conversion logic here
    // For now, just update version field (assume message structure is compatible)
    return {
      ...message,
      version: targetVersion,
    };
  }

  /**
   * Create a request message
   *
   * @param type - Message type
   * @param payload - Message payload
   * @param version - Protocol version (default: CURRENT_VERSION)
   * @returns Socket message
   */
  createRequest(
    type: string,
    payload: unknown,
    version?: string
  ): SocketMessage {
    return {
      version: version || CURRENT_VERSION,
      type,
      payload,
      id: this.generateMessageId(),
    };
  }

  /**
   * Create a response message
   *
   * @param originalMessage - Original request message
   * @param payload - Response payload
   * @param success - Whether the operation succeeded (default: true)
   * @returns Socket message
   */
  createResponse(
    originalMessage: SocketMessage,
    payload: Record<string, unknown> = {},
    success = true
  ): SocketMessage {
    return {
      version: originalMessage.version,
      type: "response",
      payload: {
        success,
        ...payload,
      },
      id: originalMessage.id,
    };
  }

  /**
   * Check if a version is supported
   *
   * @param version - Version to check
   * @returns true if version is supported
   */
  isVersionSupported(version: string): boolean {
    return this.supportedVersions.includes(version);
  }

  /**
   * Generate unique message ID
   *
   * Uses simple timestamp + random string to avoid adding uuid dependency.
   *
   * @returns Unique message ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
