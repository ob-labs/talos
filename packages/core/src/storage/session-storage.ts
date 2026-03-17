import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import type { SessionMetadata, SessionStatus } from "@talos/types";

/**
 * Path to the global Talos configuration directory
 * Default: ~/.talos/
 */
export const TALOS_DIR = path.join(os.homedir(), ".talos");

/**
 * Path to the sessions directory
 * Default: ~/.talos/sessions/
 */
export const SESSIONS_DIR = path.join(TALOS_DIR, "sessions");

/**
 * Ensures the sessions directory exists at the specified path
 */
async function ensureSessionsDir(basePath: string = SESSIONS_DIR): Promise<void> {
  try {
    await fs.access(basePath);
  } catch {
    await fs.mkdir(basePath, { recursive: true });
  }
}

/**
 * Get the sessions directory path for a given base path
 */
function getSessionsDir(basePath: string | undefined): string {
  return basePath ? path.join(basePath, ".talos", "sessions") : SESSIONS_DIR;
}

/**
 * Get the session file path for a given session ID
 */
function getSessionPath(sessionId: string, basePath: string | undefined): string {
  const sessionsDir = getSessionsDir(basePath);
  return path.join(sessionsDir, `${sessionId}.json`);
}

/**
 * Read a session from storage
 * @param sessionId - Session ID to read
 * @param basePath - Optional base path for testing (defaults to ~/.talos)
 * @returns SessionMetadata or null if not found
 */
export async function getSession(
  sessionId: string,
  basePath?: string
): Promise<SessionMetadata | null> {
  const sessionPath = getSessionPath(sessionId, basePath);

  try {
    const content = await fs.readFile(sessionPath, "utf-8");
    return JSON.parse(content) as SessionMetadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Save a session to storage
 * @param session - SessionMetadata to save
 * @param basePath - Optional base path for testing (defaults to ~/.talos)
 */
export async function saveSession(
  session: SessionMetadata,
  basePath?: string
): Promise<void> {
  const sessionsDir = getSessionsDir(basePath);
  const sessionPath = getSessionPath(session.id, basePath);

  await ensureSessionsDir(sessionsDir);
  await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), "utf-8");
}

/**
 * List all sessions
 * @param basePath - Optional base path for testing (defaults to ~/.talos)
 * @returns Array of SessionMetadata objects
 */
export async function listSessions(basePath?: string): Promise<SessionMetadata[]> {
  const sessionsDir = getSessionsDir(basePath);

  try {
    await ensureSessionsDir(sessionsDir);
    const files = await fs.readdir(sessionsDir);
    const sessionFiles = files.filter((file) => file.endsWith(".json"));

    const sessions: SessionMetadata[] = [];
    for (const file of sessionFiles) {
      const filePath = path.join(sessionsDir, file);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const session = JSON.parse(content) as SessionMetadata;
        sessions.push(session);
      } catch {
        // Skip invalid session files
        continue;
      }
    }

    return sessions;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Delete a session from storage
 * @param sessionId - Session ID to delete
 * @param basePath - Optional base path for testing (defaults to ~/.talos)
 */
export async function deleteSession(sessionId: string, basePath?: string): Promise<void> {
  const sessionPath = getSessionPath(sessionId, basePath);

  try {
    await fs.unlink(sessionPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // Session doesn't exist, ignore
      return;
    }
    throw error;
  }
}

/**
 * Update the status of a session
 * @param sessionId - Session ID to update
 * @param status - New status
 * @param basePath - Optional base path for testing (defaults to ~/.talos)
 */
export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  basePath?: string
): Promise<void> {
  const session = await getSession(sessionId, basePath);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  session.status = status;
  await saveSession(session, basePath);
}
