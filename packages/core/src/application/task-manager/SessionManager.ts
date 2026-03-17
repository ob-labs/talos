/**
 * SessionManager - AI agent execution session management
 *
 * Manages session lifecycle, persistence, and conversation tracking.
 * Storage: ~/.talos/sessions/ai/{sessionId}.json
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import type { ISessionManager, ILogger } from "@talos/types";

/**
 * Get the default AI sessions directory
 * Separate from process sessions to avoid confusion
 */
function getDefaultSessionsDir(): string {
  return path.join(os.homedir(), ".talos", "sessions", "ai");
}

/**
 * Generate a unique session ID
 * Format: sess_{timestamp}_{random}
 */
function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `sess_${timestamp}_${random}`;
}

/**
 * AI Session Data (internal storage format)
 */
interface AISessionData {
  sessionId: string;
  prdId: string;
  roleId: string;
  createdAt: string; // ISO string
  closedAt?: string; // ISO string
  messages: Array<{ role: string; content: string }>;
}

/**
 * Session Manager Options
 */
export interface SessionManagerOptions {
  logger: ILogger;
  sessionsDir?: string; // Optional: override default sessions directory
}

/**
 * Session Manager Class
 *
 * Implements ISessionManager interface for managing AI agent sessions.
 * Sessions track conversations between the agent and the system.
 */
export class SessionManager implements ISessionManager {
  private logger: ILogger;
  private sessionsDir: string;

  constructor(options: SessionManagerOptions) {
    this.logger = options.logger;
    this.sessionsDir = options.sessionsDir || getDefaultSessionsDir();
  }

  /**
   * Get the session file path
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * Ensure sessions directory exists
   */
  private async ensureSessionsDir(): Promise<void> {
    try {
      await fs.access(this.sessionsDir);
    } catch {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Create a new session
   *
   * Creates a new AI conversation session with the specified PRD and role.
   * Initializes session metadata and empty conversation history.
   *
   * @param prdId - PRD identifier
   * @param roleId - Role identifier for the AI agent
   * @param initialConversation - Optional initial conversation messages
   * @returns Created session data with session ID
   */
  async createSession(
    prdId: string,
    roleId: string,
    initialConversation?: Array<{
      role: string;
      content: string;
    }>
  ): Promise<{
    sessionId: string;
    prdId: string;
    roleId: string;
    createdAt: Date;
  }> {
    const sessionId = generateSessionId();
    const createdAt = new Date();

    this.logger.info(
      `Creating session ${sessionId} for PRD ${prdId} with role ${roleId}`
    );

    const sessionData: AISessionData = {
      sessionId,
      prdId,
      roleId,
      createdAt: createdAt.toISOString(),
      messages: initialConversation || [],
    };

    await this.ensureSessionsDir();
    await fs.writeFile(this.getSessionPath(sessionId), JSON.stringify(sessionData, null, 2), "utf-8");

    this.logger.info(`Session ${sessionId} created successfully`);

    return {
      sessionId,
      prdId,
      roleId,
      createdAt,
    };
  }

  /**
   * Get session information
   *
   * Retrieves session data including conversation history.
   *
   * @param sessionId - Session identifier
   * @returns Session data or null if not found
   */
  async getSession(sessionId: string): Promise<{
    sessionId: string;
    prdId: string;
    roleId: string;
    createdAt: Date;
    messages: Array<{ role: string; content: string }>;
  } | null> {
    this.logger.info(`Retrieving session ${sessionId}`);

    try {
      const content = await fs.readFile(this.getSessionPath(sessionId), "utf-8");
      const sessionData: AISessionData = JSON.parse(content);

      return {
        sessionId: sessionData.sessionId,
        prdId: sessionData.prdId,
        roleId: sessionData.roleId,
        createdAt: new Date(sessionData.createdAt),
        messages: sessionData.messages,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.logger.warn(`Session ${sessionId} not found`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Close a session
   *
   * Marks the session as closed and updates the closedAt timestamp.
   *
   * @param sessionId - Session identifier
   * @returns true if session was closed, false if not found
   */
  async closeSession(sessionId: string): Promise<boolean> {
    this.logger.info(`Closing session ${sessionId}`);

    try {
      const content = await fs.readFile(this.getSessionPath(sessionId), "utf-8");
      const sessionData: AISessionData = JSON.parse(content);

      // Update closed timestamp
      sessionData.closedAt = new Date().toISOString();

      await fs.writeFile(this.getSessionPath(sessionId), JSON.stringify(sessionData, null, 2), "utf-8");

      this.logger.info(`Session ${sessionId} closed successfully`);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.logger.warn(`Session ${sessionId} not found, cannot close`);
        return false;
      }
      throw error;
    }
  }

  /**
   * Delete a session
   *
   * Permanently removes the session from storage.
   * This is not part of ISessionManager but is useful for cleanup.
   *
   * @param sessionId - Session identifier
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.logger.info(`Deleting session ${sessionId}`);
    try {
      await fs.unlink(this.getSessionPath(sessionId));
      this.logger.info(`Session ${sessionId} deleted`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      // Session doesn't exist, ignore
      this.logger.warn(`Session ${sessionId} not found for deletion`);
    }
  }
}
