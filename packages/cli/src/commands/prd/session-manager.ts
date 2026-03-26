/**
 * PRD Session Manager
 * Manages PRD session persistence (prdSessionId is used directly as Claude session ID)
 */

import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { PrdSessionMapping } from "@talos/types";

/**
 * PRD Session Manager
 * Manages persistence and retrieval of PRD sessions
 */
export class PrdSessionManager {
  private readonly sessionsDir: string;

  constructor() {
    this.sessionsDir = join(homedir(), ".talos", "sessions", "prd");
    this.ensureSessionsDir();
  }

  /**
   * Ensure sessions directory exists
   */
  private ensureSessionsDir(): void {
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Get file path for a session
   */
  private getSessionPath(prdSessionId: string): string {
    return join(this.sessionsDir, `${prdSessionId}.json`);
  }

  /**
   * Generate a new PRD session ID
   * Format: prd-{timestamp}-{random}
   */
  generatePrdSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 10);
    return `prd-${timestamp}-${random}`;
  }

  /**
   * Create a new session
   * @returns The session mapping with generated ID
   */
  createSession(workspacePath: string): PrdSessionMapping {
    const prdSessionId = this.generatePrdSessionId();
    const now = new Date().toISOString();

    const session: PrdSessionMapping = {
      prdSessionId,
      workspacePath,
      createdAt: now,
      lastUsedAt: now,
    };

    this.saveSession(session);
    return session;
  }

  /**
   * Save a session to disk
   */
  private saveSession(session: PrdSessionMapping): void {
    const filePath = this.getSessionPath(session.prdSessionId);
    writeFileSync(filePath, JSON.stringify(session, null, 2), "utf-8");
  }

  /**
   * Get a session by PRD session ID
   * @returns The session or null if not found
   */
  getSession(prdSessionId: string): PrdSessionMapping | null {
    const filePath = this.getSessionPath(prdSessionId);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      return JSON.parse(content) as PrdSessionMapping;
    } catch {
      return null;
    }
  }

  /**
   * List all PRD sessions
   * @returns Array of sessions
   */
  listSessions(): PrdSessionMapping[] {
    const sessions: PrdSessionMapping[] = [];

    if (!existsSync(this.sessionsDir)) {
      return sessions;
    }

    const files = readdirSync(this.sessionsDir);
    for (const file of files) {
      if (!file.endsWith(".json")) {
        continue;
      }

      const filePath = join(this.sessionsDir, file);
      try {
        const content = readFileSync(filePath, "utf-8");
        const session = JSON.parse(content) as PrdSessionMapping;
        sessions.push(session);
      } catch {
        // Skip invalid files
        continue;
      }
    }

    // Sort by lastUsedAt descending (most recent first)
    sessions.sort((a, b) =>
      new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
    );

    return sessions;
  }

  /**
   * Delete a session
   * @returns true if deleted, false if not found
   */
  deleteSession(prdSessionId: string): boolean {
    const filePath = this.getSessionPath(prdSessionId);

    if (!existsSync(filePath)) {
      return false;
    }

    unlinkSync(filePath);
    return true;
  }

  /**
   * Update the last used time for a session
   */
  updateLastUsed(prdSessionId: string): void {
    const session = this.getSession(prdSessionId);
    if (session) {
      session.lastUsedAt = new Date().toISOString();
      this.saveSession(session);
    }
  }

  /**
   * Verify workspace path matches
   * @returns true if workspace matches or if session doesn't exist
   */
  verifyWorkspace(prdSessionId: string, workspacePath: string): boolean {
    const session = this.getSession(prdSessionId);
    if (!session) {
      return false;
    }
    return session.workspacePath === workspacePath;
  }
}
