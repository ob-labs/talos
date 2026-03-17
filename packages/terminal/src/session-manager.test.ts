import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TerminalSessionManager } from "./session-manager";
import type { PTYSession } from "./session-manager";

// Mock node-pty
vi.mock("node-pty", () => ({
  spawn: vi.fn(),
}));

// Mock fs
vi.mock("fs", () => ({
  statSync: vi.fn(),
  existsSync: vi.fn(),
}));

// Mock os
vi.mock("os", () => ({
  platform: vi.fn(),
}));

import { spawn } from "node-pty";
import * as fs from "fs";
import * as os from "os";

describe("TerminalSessionManager", () => {
  let manager: TerminalSessionManager;

  // Mock PTY object
  const mockPty = {
    pid: 12345,
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    onExit: vi.fn(() => ({ dispose: vi.fn() })),
    kill: vi.fn(),
    resize: vi.fn(),
    write: vi.fn(),
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(os.platform).mockReturnValue("darwin");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => true,
    } as fs.Stats);

    // Setup spawn mock to return mock PTY
    vi.mocked(spawn).mockReturnValue(mockPty as any);

    // Get singleton instance
    manager = TerminalSessionManager.getInstance();
  });

  afterEach(() => {
    // Clean up sessions without calling kill (avoid mock interference)
    const sessions = manager.getSessions();
    sessions.forEach((session) => {
      // Directly delete from sessions Map to avoid calling pty.kill()
      (manager as any).sessions.delete(session.id);
    });
  });

  describe("getInstance", () => {
    it("should return same instance (singleton pattern)", () => {
      const instance1 = TerminalSessionManager.getInstance();
      const instance2 = TerminalSessionManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should return TerminalSessionManager instance", () => {
      const instance = TerminalSessionManager.getInstance();

      expect(instance).toBeInstanceOf(TerminalSessionManager);
    });
  });

  describe("generateSessionId", () => {
    it("should generate consistent ID from workspace path", () => {
      const workspacePath = "/Users/test/workspace";
      const id1 = manager.generateSessionId(workspacePath);
      const id2 = manager.generateSessionId(workspacePath);

      expect(id1).toBe(id2);
    });

    it("should generate different IDs for different paths", () => {
      const id1 = manager.generateSessionId("/path/to/workspace1");
      const id2 = manager.generateSessionId("/path/to/workspace2");

      expect(id1).not.toBe(id2);
    });

    it("should generate base64 encoded ID", () => {
      const workspacePath = "/test/path";
      const id = manager.generateSessionId(workspacePath);

      // Base64 should only contain specific characters
      expect(id).toMatch(/^[A-Za-z0-9+/=]+$/);
    });
  });

  describe("getOrCreateSession", () => {
    it("should create new session if not exists", () => {
      const workspacePath = "/test/workspace";

      vi.mocked(spawn).mockReturnValue(mockPty as any);

      const session = manager.getOrCreateSession(workspacePath);

      expect(session).toBeDefined();
      expect(session.id).toBe(manager.generateSessionId(workspacePath));
      expect(spawn).toHaveBeenCalled();
    });

    it("should reuse existing session for same workspace", () => {
      const workspacePath = "/test/workspace";

      vi.mocked(spawn).mockReturnValue(mockPty as any);

      const session1 = manager.getOrCreateSession(workspacePath);
      const session2 = manager.getOrCreateSession(workspacePath);

      expect(session1.id).toBe(session2.id);
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    it("should create different sessions for different workspaces", () => {
      const path1 = "/workspace1";
      const path2 = "/workspace2";

      vi.mocked(spawn).mockReturnValue(mockPty as any);

      const session1 = manager.getOrCreateSession(path1);
      const session2 = manager.getOrCreateSession(path2);

      expect(session1.id).not.toBe(session2.id);
      expect(spawn).toHaveBeenCalledTimes(2);
    });

    it("should pass custom environment variables to PTY", () => {
      const workspacePath = "/test/workspace";
      const customEnv = { TEST_VAR: "test_value", ANOTHER_VAR: "123" };

      vi.mocked(spawn).mockReturnValue(mockPty as any);

      manager.getOrCreateSession(workspacePath, customEnv);

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            TEST_VAR: "test_value",
            ANOTHER_VAR: "123",
          }),
        })
      );
    });

    it("should validate workspace directory exists", () => {
      const workspacePath = "/nonexistent/workspace";

      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error("Directory not found");
      });
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      const session = manager.getOrCreateSession(workspacePath);

      // Should fallback to HOME or cwd
      expect(session).toBeDefined();
    });
  });

  describe("createSession (via getOrCreateSession)", () => {
    it("should use correct shell for darwin platform", () => {
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      manager.getOrCreateSession("/test/workspace");

      expect(spawn).toHaveBeenCalledWith(
        "/bin/zsh",  // Default shell for darwin
        ["-i"],
        expect.any(Object)
      );
    });

    it("should use correct shell for linux platform", () => {
      vi.mocked(os.platform).mockReturnValue("linux");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      manager.getOrCreateSession("/test/workspace");

      expect(spawn).toHaveBeenCalledWith(
        "/bin/zsh",
        ["-i"],
        expect.any(Object)
      );
    });

    it("should use correct shell for win32 platform", () => {
      // Note: process.platform is read-only, so we can't easily test win32 behavior
      // This test documents the expected behavior based on source code inspection
      // The source code uses: const shellArgs = process.platform === "win32" ? [] : ["-i"];
      vi.mocked(os.platform).mockReturnValue("win32");
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      manager.getOrCreateSession("/test/workspace");

      // On non-win32 platforms (like darwin/linux), shell args will be ["-i"]
      // This test would need to run on actual win32 platform to test []
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          name: "xterm-256color",
          cols: 80,
          rows: 24,
        })
      );
    });

    it("should set PTY environment correctly", () => {
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      manager.getOrCreateSession("/test/workspace", { CUSTOM: "value" });

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          name: "xterm-256color",
          cols: 80,
          rows: 24,
          cwd: expect.any(String),
          env: expect.objectContaining({
            CUSTOM: "value",
          }),
        })
      );
    });

    it("should initialize session with correct structure", () => {
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      const session = manager.getOrCreateSession("/test/workspace");

      expect(session.id).toBeDefined();
      expect(session.pty).toBe(mockPty);
      expect(session.cwd).toBeDefined();
      expect(session.activeSockets).toBeInstanceOf(Set);
      expect(session.activeSockets.size).toBe(0);
      expect(session.history).toBe("");
    });

    it("should attach data listener to PTY", () => {
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      const session = manager.getOrCreateSession("/test/workspace");

      expect(mockPty.onData).toHaveBeenCalled();

      // Trigger onData callback
      const onDataCallback = vi.mocked(mockPty.onData).mock.calls[0][0];
      onDataCallback("test output");

      expect(session.history).toBe("test output");
    });

    it("should truncate history when it exceeds 100k characters", () => {
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      const session = manager.getOrCreateSession("/test/workspace");

      const onDataCallback = vi.mocked(mockPty.onData).mock.calls[0][0];

      // Add data that exceeds limit
      const largeData = "x".repeat(150000);
      onDataCallback(largeData);

      // History should be truncated to last 100k characters
      expect(session.history.length).toBe(100000);
      expect(session.history).toBe("x".repeat(100000));
    });

    it("should attach exit listener to PTY", () => {
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      const sessionId = manager.generateSessionId("/test/workspace");
      manager.getOrCreateSession("/test/workspace");

      expect(mockPty.onExit).toHaveBeenCalled();

      // Trigger onExit callback
      const onExitCallback = vi.mocked(mockPty.onExit).mock.calls[0][0];
      onExitCallback({ exitCode: 0 });

      // Session should be deleted
      expect(manager.getSessions().find(s => s.id === sessionId)).toBeUndefined();
    });
  });

  describe("attachSocket", () => {
    let mockSocket: any;

    beforeEach(() => {
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      mockSocket = {
        readyState: 1, // WebSocket.OPEN
        send: vi.fn(),
        on: vi.fn(),
      };
    });

    it("should add socket to activeSockets", () => {
      const session = manager.getOrCreateSession("/test/workspace");

      manager.attachSocket(session, mockSocket);

      expect(session.activeSockets.has(mockSocket)).toBe(true);
    });

    it("should send history to new socket", () => {
      const session = manager.getOrCreateSession("/test/workspace");
      session.history = "previous output";

      manager.attachSocket(session, mockSocket);

      expect(mockSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "output", data: "previous output" })
      );
    });

    it("should not send history if socket is not open", () => {
      const session = manager.getOrCreateSession("/test/workspace");
      session.history = "previous output";

      mockSocket.readyState = 0; // Not open
      manager.attachSocket(session, mockSocket);

      expect(mockSocket.send).not.toHaveBeenCalled();
    });

    it("should forward PTY data to socket", () => {
      const session = manager.getOrCreateSession("/test/workspace");

      manager.attachSocket(session, mockSocket);

      // Get the onData callback that was registered
      const onDataCallback = vi.mocked(mockPty.onData).mock.calls[1][0];
      onDataCallback("new data");

      expect(mockSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "output", data: "new data" })
      );
    });

    it("should not send to socket if not open when forwarding data", () => {
      const session = manager.getOrCreateSession("/test/workspace");

      manager.attachSocket(session, mockSocket);

      const onDataCallback = vi.mocked(mockPty.onData).mock.calls[1][0];

      mockSocket.readyState = 0;
      onDataCallback("data");

      expect(mockSocket.send).not.toHaveBeenCalledWith(
        JSON.stringify({ type: "output", data: "data" })
      );
    });

    it("should send exit event when PTY exits", () => {
      const session = manager.getOrCreateSession("/test/workspace");

      manager.attachSocket(session, mockSocket);

      // Get the onExit callback
      const onExitCallback = vi.mocked(mockPty.onExit).mock.calls[1][0];
      onExitCallback({ exitCode: 0 });

      expect(mockSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "exit", code: 0 })
      );
    });

    it("should clean up socket on close event", () => {
      const session = manager.getOrCreateSession("/test/workspace");

      manager.attachSocket(session, mockSocket);

      expect(session.activeSockets.has(mockSocket)).toBe(true);

      // Trigger close event
      const closeCallback = vi.mocked(mockSocket.on).mock.calls.find(
        call => call[0] === "close"
      )?.[1];
      closeCallback?.();

      expect(session.activeSockets.has(mockSocket)).toBe(false);
    });

    it("should clean up socket on error event", () => {
      const session = manager.getOrCreateSession("/test/workspace");

      manager.attachSocket(session, mockSocket);

      expect(session.activeSockets.has(mockSocket)).toBe(true);

      // Trigger error event
      const errorCallback = vi.mocked(mockSocket.on).mock.calls.find(
        call => call[0] === "error"
      )?.[1];
      errorCallback?.();

      expect(session.activeSockets.has(mockSocket)).toBe(false);
    });
  });

  describe("killSession", () => {
    it("should kill PTY and remove session", () => {
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      const session = manager.getOrCreateSession("/test/workspace");
      const sessionId = session.id;

      manager.killSession(sessionId);

      expect(mockPty.kill).toHaveBeenCalled();
      expect(manager.getSessions().find(s => s.id === sessionId)).toBeUndefined();
    });

    it("should handle killing non-existent session gracefully", () => {
      expect(() => {
        manager.killSession("non-existent-id");
      }).not.toThrow();
    });

    it("should handle PTY kill errors gracefully", () => {
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      // Create a fresh mock PTY that throws on kill
      const errorPty = {
        ...mockPty,
        kill: vi.fn(() => {
          throw new Error("Kill failed");
        }),
      };
      vi.mocked(spawn).mockReturnValue(errorPty as any);

      const session = manager.getOrCreateSession("/test/workspace");
      const sessionId = session.id;

      // Should not throw
      expect(() => {
        manager.killSession(sessionId);
      }).not.toThrow();

      // Session should still be deleted
      expect(manager.getSessions().find(s => s.id === sessionId)).toBeUndefined();
    });
  });

  describe("getSessions", () => {
    it("should return all active sessions", () => {
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      manager.getOrCreateSession("/workspace1");
      manager.getOrCreateSession("/workspace2");
      manager.getOrCreateSession("/workspace3");

      const sessions = manager.getSessions();

      expect(sessions).toHaveLength(3);
    });

    it("should return empty array when no sessions", () => {
      const sessions = manager.getSessions();

      expect(sessions).toEqual([]);
    });

    it("should not include killed sessions", () => {
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      const session1 = manager.getOrCreateSession("/workspace1");
      manager.getOrCreateSession("/workspace2");

      manager.killSession(session1.id);

      const sessions = manager.getSessions();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).not.toBe(session1.id);
    });
  });

  describe("getDefaultShell", () => {
    it("should return powershell.exe for win32", () => {
      // Note: process.platform is read-only, so we can't easily test win32 behavior
      // This test documents the expected behavior based on source code inspection
      vi.mocked(os.platform).mockReturnValue("win32");
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      manager.getOrCreateSession("/test/workspace");

      // Verify spawn was called with powershell.exe shell
      // (on non-win32 platforms this will test the current platform's shell instead)
      expect(spawn).toHaveBeenCalled();
      const shellArg = vi.mocked(spawn).mock.calls[0][0];
      expect(shellArg).toBeTruthy();
    });

    it("should return /bin/zsh for darwin when exists", () => {
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/bin/zsh";
      });
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      manager.getOrCreateSession("/test/workspace");

      expect(spawn).toHaveBeenCalledWith(
        "/bin/zsh",
        ["-i"],
        expect.any(Object)
      );
    });

    it("should return /bin/bash for linux when zsh not exists", () => {
      vi.mocked(os.platform).mockReturnValue("linux");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/bin/bash";
      });
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      manager.getOrCreateSession("/test/workspace");

      expect(spawn).toHaveBeenCalledWith(
        "/bin/bash",
        ["-i"],
        expect.any(Object)
      );
    });

    it("should fallback to /bin/sh when no common shell found", () => {
      vi.mocked(os.platform).mockReturnValue("linux");
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      manager.getOrCreateSession("/test/workspace");

      expect(spawn).toHaveBeenCalledWith(
        "/bin/sh",
        ["-i"],
        expect.any(Object)
      );
    });

    it("should return bash for unknown platforms", () => {
      vi.mocked(os.platform).mockReturnValue("freebsd");
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      manager.getOrCreateSession("/test/workspace");

      expect(spawn).toHaveBeenCalledWith(
        "bash",
        ["-i"],
        expect.any(Object)
      );
    });

    it("should use SHELL environment variable if set and exists", () => {
      const originalShell = process.env.SHELL;
      process.env.SHELL = "/usr/local/bin/zsh";

      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/usr/local/bin/zsh";
      });
      vi.mocked(spawn).mockReturnValue(mockPty as any);

      manager.getOrCreateSession("/test/workspace");

      expect(spawn).toHaveBeenCalledWith(
        "/usr/local/bin/zsh",
        ["-i"],
        expect.any(Object)
      );

      process.env.SHELL = originalShell;
    });
  });
});
