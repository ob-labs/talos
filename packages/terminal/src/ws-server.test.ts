import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TerminalWSServer } from "./ws-server";
import { TerminalSessionManager } from "./session-manager";
import type { PTYSession } from "./session-manager";
import type { Server } from "http";

// Mock WebSocket
vi.mock("ws", () => ({
  WebSocket: Object.assign(vi.fn(), {
    OPEN: 1,
    CONNECTING: 0,
    CLOSING: 2,
    CLOSED: 3,
  }),
  WebSocketServer: vi.fn(),
}));

// Mock node-pty
vi.mock("node-pty", () => ({
  spawn: vi.fn(),
}));

// Mock fs
vi.mock("fs", () => ({
  statSync: vi.fn(),
  existsSync: vi.fn(),
}));

// Mock @talos/core
vi.mock("@talos/core", () => ({
  workspaceStorage: {
    addTerminalSession: vi.fn(),
  },
}));

import { WebSocket, WebSocketServer } from "ws";
import { spawn } from "node-pty";
import * as fs from "fs";
import { workspaceStorage } from "@talos/core";

describe("TerminalWSServer", () => {
  let wsServer: TerminalWSServer;
  let mockWssInstance: any;
  let mockHttpServer: Server;
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

  // Mock WebSocket instance
  const createMockWebSocket = () => ({
    readyState: 1, // WebSocket.OPEN
    send: vi.fn(),
    on: vi.fn(),
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => true,
    } as fs.Stats);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(spawn).mockReturnValue(mockPty as any);
    vi.mocked(workspaceStorage.addTerminalSession).mockResolvedValue(undefined);

    // Mock WebSocketServer constructor
    mockWssInstance = {
      on: vi.fn(),
      close: vi.fn((callback?: (err?: Error) => void) => {
        callback?.();
      }),
      handleUpgrade: vi.fn(),
    };
    vi.mocked(WebSocketServer).mockReset().mockReturnValue(mockWssInstance);

    // Mock WebSocket constructor
    vi.mocked(WebSocket).mockReset().mockImplementation(() => createMockWebSocket() as any);

    // Get singleton instance
    manager = TerminalSessionManager.getInstance();
  });

  afterEach(() => {
    // Clean up sessions
    const sessions = manager.getSessions();
    sessions.forEach((session) => {
      (manager as any).sessions.delete(session.id);
    });
  });

  describe("constructor", () => {
    it("should create standalone server on port 3001 by default", () => {
      wsServer = new TerminalWSServer();

      expect(WebSocketServer).toHaveBeenCalledWith({
        port: 3001,
        host: "0.0.0.0",
      });
      expect(mockWssInstance.on).toHaveBeenCalledWith(
        "connection",
        expect.any(Function)
      );
    });

    it("should create standalone server with custom port and host", () => {
      wsServer = new TerminalWSServer({
        port: 8080,
        host: "localhost",
      });

      expect(WebSocketServer).toHaveBeenCalledWith({
        port: 8080,
        host: "localhost",
      });
    });

    it("should attach to HttpServer when server option is provided", () => {
      mockHttpServer = {
        on: vi.fn(),
      } as any;

      wsServer = new TerminalWSServer({
        server: mockHttpServer,
      });

      // Should create noServer WebSocket
      expect(WebSocketServer).toHaveBeenCalledWith({
        noServer: true,
      });

      // Should attach upgrade listener
      expect(mockHttpServer.on).toHaveBeenCalledWith(
        "upgrade",
        expect.any(Function)
      );
    });

    it("should handle upgrade for correct path", () => {
      mockHttpServer = {
        on: vi.fn(),
      } as any;

      wsServer = new TerminalWSServer({
        server: mockHttpServer,
      });

      const upgradeCallback = vi.mocked(mockHttpServer.on).mock.calls.find(
        call => call[0] === "upgrade"
      )?.[1];

      const mockRequest = {
        url: "/terminal-ws",
        headers: { host: "localhost:3000" },
      };
      const mockSocket = {
        destroy: vi.fn(),
      };
      const mockHead = Buffer.from([]);

      upgradeCallback(mockRequest, mockSocket, mockHead);

      expect(mockWssInstance.handleUpgrade).toHaveBeenCalled();
      expect(mockSocket.destroy).not.toHaveBeenCalled();
    });

    it("should destroy socket for incorrect upgrade path", () => {
      mockHttpServer = {
        on: vi.fn(),
      } as any;

      wsServer = new TerminalWSServer({
        server: mockHttpServer,
      });

      const upgradeCallback = vi.mocked(mockHttpServer.on).mock.calls.find(
        call => call[0] === "upgrade"
      )?.[1];

      const mockRequest = {
        url: "/wrong-path",
        headers: { host: "localhost:3000" },
      };
      const mockSocket = {
        destroy: vi.fn(),
      };
      const mockHead = Buffer.from([]);

      upgradeCallback(mockRequest, mockSocket, mockHead);

      expect(mockWssInstance.handleUpgrade).not.toHaveBeenCalled();
      expect(mockSocket.destroy).toHaveBeenCalled();
    });
  });

  describe("handleConnection (standalone mode)", () => {
    let mockWebSocket: any;

    beforeEach(() => {
      // Clear existing sessions from previous tests
      const existingSessions = manager.getSessions();
      existingSessions.forEach((session) => {
        (manager as any).sessions.delete(session.id);
      });

      wsServer = new TerminalWSServer();
      mockWebSocket = createMockWebSocket();
    });

    it("should create session with default cwd in standalone mode", () => {
      const connectionCallback = vi.mocked(mockWssInstance.on).mock.calls.find(
        call => call[0] === "connection"
      )?.[1];

      connectionCallback(mockWebSocket, { url: undefined });

      const sessions = manager.getSessions();
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[sessions.length - 1].cwd).toBeDefined();
    });

    it("should use TerminalSessionManager to attach socket", () => {
      const connectionCallback = vi.mocked(mockWssInstance.on).mock.calls.find(
        call => call[0] === "connection"
      )?.[1];

      connectionCallback(mockWebSocket, { url: undefined });

      const sessions = manager.getSessions();
      expect(sessions[sessions.length - 1].activeSockets.has(mockWebSocket)).toBe(true);
    });

    it("should send ready message with sessionId", () => {
      const connectionCallback = vi.mocked(mockWssInstance.on).mock.calls.find(
        call => call[0] === "connection"
      )?.[1];

      const defaultCwd = process.env.HOME || process.cwd();
      const expectedSessionId = manager.generateSessionId(defaultCwd);

      connectionCallback(mockWebSocket, { url: undefined });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "ready",
          sessionId: expectedSessionId,
        })
      );
    });

    it("should handle message event from client", () => {
      const connectionCallback = vi.mocked(mockWssInstance.on).mock.calls.find(
        call => call[0] === "connection"
      )?.[1];

      connectionCallback(mockWebSocket, { url: undefined });

      // Get message callback
      const messageCallback = vi.mocked(mockWebSocket.on).mock.calls.find(
        call => call[0] === "message"
      )?.[1];

      const inputMessage = JSON.stringify({ type: "input", data: "ls\n" });
      messageCallback(Buffer.from(inputMessage));

      expect(mockPty.write).toHaveBeenCalledWith("ls\n");
    });
  });

  describe("handleConnection (HTTP server attached mode)", () => {
    let mockWebSocket: any;
    let mockHttpServer: Server;
    let connectionCallback: any;

    beforeEach(() => {
      // Clear existing sessions from previous tests
      const existingSessions = manager.getSessions();
      existingSessions.forEach((session) => {
        (manager as any).sessions.delete(session.id);
      });

      // Reset the mock to clear previous callbacks
      mockWssInstance.on = vi.fn();

      mockHttpServer = {
        on: vi.fn(),
      } as any;

      wsServer = new TerminalWSServer({
        server: mockHttpServer,
      });
      mockWebSocket = createMockWebSocket();

      // Get the connection callback that was just registered
      connectionCallback = vi.mocked(mockWssInstance.on).mock.calls.find(
        call => call[0] === "connection"
      )?.[1];
    });

    it("should parse workspaceId and workspacePath from URL", async () => {
      const requestUrl = "/terminal-ws?workspaceId=ws-123&workspacePath=/test/path";

      connectionCallback(mockWebSocket, { url: requestUrl });

      // Wait for async addTerminalSession to be called
      await new Promise(resolve => setTimeout(resolve, 0));

      const sessions = manager.getSessions();
      expect(sessions.length).toBeGreaterThan(0);
      expect(workspaceStorage.addTerminalSession).toHaveBeenCalledWith(
        "ws-123",
        expect.any(String),
        mockPty.pid
      );
    });

    it("should send ready message with sessionId", () => {
      const workspacePath = "/test/workspace";
      const requestUrl = `/terminal-ws?workspacePath=${encodeURIComponent(workspacePath)}`;

      connectionCallback(mockWebSocket, { url: requestUrl });

      const expectedSessionId = manager.generateSessionId(workspacePath);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "ready",
          sessionId: expectedSessionId,
        })
      );
    });

    it("should create session using default cwd when no workspacePath", () => {
      connectionCallback(mockWebSocket, { url: "/terminal-ws" });

      const sessions = manager.getSessions();
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[sessions.length - 1].cwd).toBeDefined();
    });

    it("should validate workspacePath is directory", () => {
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error("Not a directory");
      });

      const requestUrl = "/terminal-ws?workspacePath=/invalid/path";
      connectionCallback(mockWebSocket, { url: requestUrl });

      // Should fallback to default cwd
      const sessions = manager.getSessions();
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[sessions.length - 1].cwd).not.toBe("/invalid/path");
    });
  });

  describe("handleMessage", () => {
    let mockWebSocket: any;
    let session: PTYSession;

    beforeEach(() => {
      // Clear existing sessions
      const existingSessions = manager.getSessions();
      existingSessions.forEach((session) => {
        (manager as any).sessions.delete(session.id);
      });

      wsServer = new TerminalWSServer();
      mockWebSocket = createMockWebSocket();

      const connectionCallback = vi.mocked(mockWssInstance.on).mock.calls.find(
        call => call[0] === "connection"
      )?.[1];

      connectionCallback(mockWebSocket, {
        url: "/terminal-ws?workspaceId=ws-123&workspacePath=/test/path",
      });

      session = manager.getSessions()[manager.getSessions().length - 1];
    });

    it("should write input data to PTY", () => {
      const messageCallback = vi.mocked(mockWebSocket.on).mock.calls.find(
        call => call[0] === "message"
      )?.[1];

      messageCallback(Buffer.from(JSON.stringify({ type: "input", data: "echo test\n" })));

      expect(mockPty.write).toHaveBeenCalledWith("echo test\n");
    });

    it("should resize PTY", () => {
      const messageCallback = vi.mocked(mockWebSocket.on).mock.calls.find(
        call => call[0] === "message"
      )?.[1];

      messageCallback(Buffer.from(JSON.stringify({ type: "resize", cols: 120, rows: 30 })));

      expect(mockPty.resize).toHaveBeenCalledWith(120, 30);
    });

    it("should log warning for unknown message type", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const messageCallback = vi.mocked(mockWebSocket.on).mock.calls.find(
        call => call[0] === "message"
      )?.[1];

      messageCallback(Buffer.from(JSON.stringify({ type: "unknown", data: "test" })));

      expect(consoleWarnSpy).toHaveBeenCalledWith("Unknown message type: unknown");

      consoleWarnSpy.mockRestore();
    });

    it("should handle JSON parse errors gracefully", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const messageCallback = vi.mocked(mockWebSocket.on).mock.calls.find(
        call => call[0] === "message"
      )?.[1];

      messageCallback(Buffer.from("invalid json"));

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("getSessionCount", () => {
    let connectionCallback: any;

    beforeEach(() => {
      // Clear existing sessions
      const existingSessions = manager.getSessions();
      existingSessions.forEach((session) => {
        (manager as any).sessions.delete(session.id);
      });

      // Reset the mock to clear previous callbacks
      mockWssInstance.on = vi.fn();

      wsServer = new TerminalWSServer();

      // Get the connection callback that was just registered
      connectionCallback = vi.mocked(mockWssInstance.on).mock.calls.find(
        call => call[0] === "connection"
      )?.[1];
    });

    it("should return 0 when no sessions", () => {
      expect(wsServer.getSessionCount()).toBe(0);
    });

    it("should count each connection (sessions are reused in standalone mode)", () => {
      // In standalone mode, all connections use the same default workspace
      // so they all share the same session
      connectionCallback(createMockWebSocket());
      connectionCallback(createMockWebSocket());
      connectionCallback(createMockWebSocket());

      // Should have 1 session (not 3), because standalone mode uses default cwd
      expect(wsServer.getSessionCount()).toBe(1);
    });
  });

  describe("getSessionIds", () => {
    let connectionCallback: any;

    beforeEach(() => {
      // Clear existing sessions
      const existingSessions = manager.getSessions();
      existingSessions.forEach((session) => {
        (manager as any).sessions.delete(session.id);
      });

      // Reset the mock to clear previous callbacks
      mockWssInstance.on = vi.fn();

      wsServer = new TerminalWSServer();

      // Get the connection callback that was just registered
      connectionCallback = vi.mocked(mockWssInstance.on).mock.calls.find(
        call => call[0] === "connection"
      )?.[1];
    });

    it("should return empty array when no sessions", () => {
      expect(wsServer.getSessionIds()).toEqual([]);
    });

    it("should return all session IDs", () => {
      connectionCallback(createMockWebSocket());
      connectionCallback(createMockWebSocket());

      // Should have 1 session (not 2), because standalone mode uses default cwd
      const ids = wsServer.getSessionIds();
      expect(ids).toHaveLength(1);
    });
  });

  describe("killWorkspaceSessions", () => {
    let connectionCallback: any;

    beforeEach(() => {
      // Clear existing sessions
      const existingSessions = manager.getSessions();
      existingSessions.forEach((session) => {
        (manager as any).sessions.delete(session.id);
      });

      // Reset the mock to clear previous callbacks
      mockWssInstance.on = vi.fn();

      wsServer = new TerminalWSServer();

      // Get the connection callback that was just registered
      connectionCallback = vi.mocked(mockWssInstance.on).mock.calls.find(
        call => call[0] === "connection"
      )?.[1];
    });

    it("should kill all sessions", () => {
      // Create sessions (all will reuse the same default workspace in standalone mode)
      connectionCallback(createMockWebSocket());

      const countBefore = wsServer.getSessionCount();
      expect(countBefore).toBeGreaterThan(0);

      wsServer.killWorkspaceSessions("ws-123");

      expect(wsServer.getSessionCount()).toBe(0);
    });

    it("should handle killing when no sessions exist", () => {
      expect(() => {
        wsServer.killWorkspaceSessions("ws-123");
      }).not.toThrow();
    });
  });

  describe("close", () => {
    let connectionCallback: any;

    beforeEach(() => {
      // Clear existing sessions
      const existingSessions = manager.getSessions();
      existingSessions.forEach((session) => {
        (manager as any).sessions.delete(session.id);
      });

      // Reset the mock to clear previous callbacks
      mockWssInstance.on = vi.fn();

      wsServer = new TerminalWSServer();

      // Get the connection callback that was just registered
      connectionCallback = vi.mocked(mockWssInstance.on).mock.calls.find(
        call => call[0] === "connection"
      )?.[1];
    });

    it("should close WebSocket server", () => {
      wsServer.close();

      expect(mockWssInstance.close).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should clean up all sessions", () => {
      // Create sessions
      connectionCallback(createMockWebSocket(), { url: "/terminal-ws?workspacePath=/path1" });
      connectionCallback(createMockWebSocket(), { url: "/terminal-ws?workspacePath=/path2" });

      const countBefore = wsServer.getSessionCount();
      expect(countBefore).toBeGreaterThan(0);

      wsServer.close();

      expect(wsServer.getSessionCount()).toBe(0);
    });

    it("should handle session cleanup errors gracefully", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      connectionCallback(createMockWebSocket(), { url: "/terminal-ws?workspacePath=/path1" });

      // Make kill throw error
      const session = manager.getSessions()[manager.getSessions().length - 1];
      vi.mocked(session.pty.kill).mockImplementation(() => {
        throw new Error("Kill error");
      });

      expect(() => {
        wsServer.close();
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should handle WebSocketServer close errors", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      vi.mocked(mockWssInstance.close).mockImplementation((callback) => {
        callback?.(new Error("Close error"));
      });

      expect(() => {
        wsServer.close();
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("module exports", () => {
    it("should export startWSServer function", async () => {
      const { startWSServer } = await import("./ws-server");

      const server = startWSServer({ port: 4000 });

      expect(server).toBeInstanceOf(TerminalWSServer);
      expect(WebSocketServer).toHaveBeenCalledWith({
        port: 4000,
        host: "0.0.0.0",
      });
    });

    it("should return same instance from startWSServer", async () => {
      // Reset the singleton first
      const { stopWSServer, startWSServer } = await import("./ws-server");
      stopWSServer();

      const server1 = startWSServer({ port: 4000 });
      const server2 = startWSServer({ port: 4000 });

      expect(server1).toBe(server2);

      // Clean up
      stopWSServer();
    });

    it("should export getWSServer function", async () => {
      const { startWSServer, getWSServer } = await import("./ws-server");

      // Reset singleton
      const { stopWSServer } = await import("./ws-server");
      stopWSServer();

      expect(getWSServer()).toBeNull();

      const server = startWSServer({ port: 4000 });

      expect(getWSServer()).toBe(server);

      // Clean up
      stopWSServer();
    });

    it("should export stopWSServer function", async () => {
      const { startWSServer, getWSServer, stopWSServer } = await import("./ws-server");

      // Reset singleton
      stopWSServer();

      const server = startWSServer({ port: 4000 });

      expect(getWSServer()).toBe(server);

      stopWSServer();

      expect(getWSServer()).toBeNull();
      expect(mockWssInstance.close).toHaveBeenCalled();
    });
  });
});
