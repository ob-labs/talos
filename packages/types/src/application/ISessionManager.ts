/**
 * Session Manager Interface
 *
 * Manages AI agent execution sessions.
 * Handles session lifecycle, state persistence, and health monitoring.
 */
export interface ISessionManager {
  /**
   * Create a new session
   *
   * @param prdId - PRD identifier
   * @param roleId - Role identifier for the AI agent
   * @param initialConversation - Optional initial conversation messages
   * @returns Created session data with session ID
   */
  createSession(
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
  }>;

  /**
   * Get session information
   *
   * @param sessionId - Session identifier
   * @returns Session data or null if not found
   */
  getSession(sessionId: string): Promise<{
    sessionId: string;
    prdId: string;
    roleId: string;
    createdAt: Date;
    messages: Array<{ role: string; content: string }>;
  } | null>;

  /**
   * Close a session
   *
   * @param sessionId - Session identifier
   * @returns true if session was closed, false if not found
   */
  closeSession(sessionId: string): Promise<boolean>;
}
