import { IPty, spawn } from "node-pty";
import * as os from "os";
import * as fs from "fs";

export interface PTYSession {
  id: string;
  pty: IPty;
  cwd: string;
  activeSockets: Set<any>; // WebSocket type
  history: string;
}

export class TerminalSessionManager {
  private static instance: TerminalSessionManager;
  private sessions = new Map<string, PTYSession>();

  private constructor() {}

  static getInstance(): TerminalSessionManager {
    if (!TerminalSessionManager.instance) {
      TerminalSessionManager.instance = new TerminalSessionManager();
    }
    return TerminalSessionManager.instance;
  }

  /**
   * Generates a session ID based on the workspace path (worktree path).
   * This ensures that the same workspace gets the same terminal session.
   */
  generateSessionId(workspacePath: string): string {
    // Basic hash or normalization of the path
    return Buffer.from(workspacePath).toString('base64');
  }

  /**
   * Gets an existing PTY session or creates a new one for the given workspace path.
   */
  getOrCreateSession(workspacePath: string, env?: Record<string, string>): PTYSession {
    const sessionId = this.generateSessionId(workspacePath);
    
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = this.createSession(sessionId, workspacePath, env);
      this.sessions.set(sessionId, session);
    }
    
    return session;
  }

  private createSession(sessionId: string, cwd: string, customEnv?: Record<string, string>): PTYSession {
    const defaultShell = this.getDefaultShell();
    const shellArgs = process.platform === "win32" ? [] : ["-i"];
    
    // Fallback to home dir or current dir if cwd is invalid
    let validCwd = process.env.HOME || process.cwd();
    if (cwd && cwd.trim()) {
      try {
        const stat = fs.statSync(cwd);
        if (stat.isDirectory()) validCwd = cwd;
      } catch {
        // Keep fallback
      }
    }

    const env = { ...process.env, ...customEnv } as Record<string, string>;

    const pty = spawn(defaultShell, shellArgs, {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: validCwd,
      env: env,
    });

    console.log(`[${sessionId}] PTY spawned: PID=${pty.pid}, shell=${defaultShell}`);

    const session: PTYSession = {
      id: sessionId,
      pty,
      cwd: validCwd,
      activeSockets: new Set(),
      history: "",
    };

    // Keep history
    pty.onData((data: string) => {
      session.history += data;
      // Truncate history if it gets too large (e.g. keep last 100k chars)
      if (session.history.length > 100000) {
        session.history = session.history.slice(-100000);
      }
    });

    pty.onExit(() => {
      console.log(`[${sessionId}] PTY exited`);
      this.sessions.delete(sessionId);
    });

    return session;
  }

  /**
   * Attaches a WebSocket to a session.
   */
  attachSocket(session: PTYSession, socket: any): void {
    session.activeSockets.add(socket);
    
    // Send history to new socket to restore terminal state
    if (session.history && socket.readyState === 1 /* WebSocket.OPEN */) {
      socket.send(JSON.stringify({ type: "output", data: session.history }));
    }

    const dataListener = session.pty.onData((data: string) => {
      if (socket.readyState === 1 /* WebSocket.OPEN */) {
        socket.send(JSON.stringify({ type: "output", data }));
      }
    });

    const exitListener = session.pty.onExit(({ exitCode }) => {
      if (socket.readyState === 1 /* WebSocket.OPEN */) {
        socket.send(JSON.stringify({ type: "exit", code: exitCode ?? 0 }));
      }
    });

    // Cleanup when socket disconnects
    socket.on("close", () => {
      session.activeSockets.delete(socket);
      dataListener.dispose();
      exitListener.dispose();
      // Notice: We DO NOT kill the PTY when socket disconnects
      // PTY keeps running in background
    });

    socket.on("error", () => {
      session.activeSockets.delete(socket);
      dataListener.dispose();
      exitListener.dispose();
    });
  }

  /**
   * Kills a session and its PTY.
   */
  killSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        session.pty.kill();
      } catch (e) {
        console.error(`Error killing PTY for session ${sessionId}:`, e);
      }
      this.sessions.delete(sessionId);
    }
  }

  getSessions(): PTYSession[] {
    return Array.from(this.sessions.values());
  }

  private getDefaultShell(): string {
    const platform = os.platform();

    switch (platform) {
      case "win32":
        return "powershell.exe";
      case "darwin":
      case "linux": {
        const commonShells = [
          process.env.SHELL?.trim(),
          "/bin/zsh",
          "/bin/bash",
          "/usr/local/bin/zsh",
          "/usr/bin/zsh",
          "/usr/bin/bash",
          "/bin/sh",
        ];

        for (const shellPath of commonShells) {
          if (shellPath && fs.existsSync(shellPath)) {
            return shellPath;
          }
        }

        console.warn('[TerminalSessionManager] No shell found, using /bin/sh');
        return "/bin/sh";
      }
      default:
        return "bash";
    }
  }
}
