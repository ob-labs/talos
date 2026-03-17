import type { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { IPty } from "node-pty";
import * as os from "os";
import * as fs from "fs";
import { workspaceStorage } from "@talos/core";
import { TERMINAL_WS_PATH } from "./constants";
import { TerminalSessionManager } from "./session-manager";

/**
 * WebSocket 连接接口（用于跟踪连接到 PTY 的 WebSocket）
 */
export interface SocketConnection {
  socket: WebSocket;
  disposables: Array<{ dispose: () => void }>;
}

/**
 * WebSocket 消息类型
 */
export type WSMessage =
  | { type: "input"; data: string }
  | { type: "output"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "exit"; code: number }
  | { type: "ready"; sessionId: string };

/**
 * WebSocket 服务器配置选项
 */
export interface WSServerOptions {
  port?: number;
  host?: string;
  /** When provided, attach to HTTP server (same port as page - fixes cross-host WS) */
  server?: HttpServer;
  /** 参考 EDDYMENS: true=同 workspace 共享一个 PTY（结对编程），false=每连接独立 PTY */
  sharedTerminalMode?: boolean;
}

/**
 * Terminal WebSocket 服务器
 *
 * 管理浏览器和 node-pty 之间的实时通信
 * 使用 TerminalSessionManager 实现持久化 PTY 会话
 */
export class TerminalWSServer {
  private wss: WebSocketServer;
  private sessionManager: TerminalSessionManager;
  private port: number;
  private host: string;

  constructor(options: WSServerOptions = {}) {
    this.port = options.port ?? 3001;
    this.host = options.host ?? "0.0.0.0";
    this.sessionManager = TerminalSessionManager.getInstance();

    if (options.server) {
      this.wss = new WebSocketServer({ noServer: true });
      options.server.on("upgrade", (request, socket, head) => {
        const pathname = new URL(request.url ?? "", `http://${request.headers.host}`).pathname;
        if (pathname === TERMINAL_WS_PATH) {
          this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.wss.emit("connection", ws, request);
          });
        } else {
          socket.destroy();
        }
      });
      this.wss.on("connection", (socket: WebSocket, request?: { url?: string }) => {
        this.handleConnection(socket, request?.url);
      });
      console.log(`Terminal WebSocket Server attached at ${TERMINAL_WS_PATH}`);
    } else {
      this.wss = new WebSocketServer({ port: this.port, host: this.host });
      this.wss.on("connection", (socket: WebSocket) => {
        this.handleConnection(socket);
      });
      console.log(`Terminal WebSocket Server listening on ${this.host}:${this.port}`);
    }
  }

  /**
   * 处理新的 WebSocket 连接
   * 使用 TerminalSessionManager 管理持久化 PTY 会话
   */
  private handleConnection(socket: WebSocket, requestUrl?: string): void {
    // Get workspace path from query parameters
    const url = requestUrl ? new URL(requestUrl, `http://${"localhost"}`) : null;
    const workspaceId = url?.searchParams.get("workspaceId") || undefined;
    const workspacePath = url?.searchParams.get("workspacePath") || undefined;

    // 确定工作目录：优先使用 workspacePath，否则使用 home 目录
    let cwd = process.env.HOME || process.cwd();
    if (workspacePath?.trim()) {
      try {
        const stat = fs.statSync(workspacePath);
        if (stat.isDirectory()) cwd = workspacePath;
      } catch {
        // Path invalid or missing, keep default cwd
      }
    }

    // 使用 TerminalSessionManager 获取或创建持久化 PTY 会话
    // 会话 ID 基于 workspacePath 生成（base64 编码），确保相同路径使用同一 PTY
    const session = this.sessionManager.getOrCreateSession(cwd);

    console.log(`[${session.id}] WebSocket attached, workspaceId: ${workspaceId}, path: ${workspacePath}`);

    // 记录 workspace 关联（如果提供）
    if (workspaceId && workspacePath) {
      workspaceStorage
        .addTerminalSession(workspaceId, session.id, session.pty.pid)
        .catch((error) => {
          console.error(`Failed to record terminal session for workspace ${workspaceId}:`, error);
        });
    }

    // 发送 ready 消息（包含会话 ID）
    if (socket.readyState === WebSocket.OPEN) {
      const readyMessage: WSMessage = { type: "ready", sessionId: session.id };
      socket.send(JSON.stringify(readyMessage));
    }

    // 使用 TerminalSessionManager 附加 WebSocket 到 PTY 会话
    // 这会自动：
    // 1. 发送历史输出到新连接
    // 2. 转发 PTY 输出到此 WebSocket
    // 3. 处理 WebSocket 断开（不杀 PTY）
    this.sessionManager.attachSocket(session, socket);

    // 处理来自客户端的消息
    socket.on("message", (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        this.handleMessage(session, message);
      } catch (error) {
        console.error(`Failed to parse message from ${session.id}:`, error);
      }
    });
  }

  /**
   * 处理来自客户端的消息
   */
  private handleMessage(session: import("./session-manager").PTYSession, message: WSMessage): void {
    switch (message.type) {
      case "input":
        session.pty.write(message.data);
        break;

      case "resize":
        // 调整 PTY 尺寸
        session.pty.resize(message.cols, message.rows);
        break;

      default:
        console.warn(`Unknown message type: ${(message as { type: string }).type}`);
    }
  }

  /**
   * 清理会话（委托给 TerminalSessionManager）
   */
  private cleanupSession(sessionId: string): void {
    this.sessionManager.killSession(sessionId);
  }

  /**
   * 获取当前活跃会话数量
   */
  getSessionCount(): number {
    return this.sessionManager.getSessions().length;
  }

  /**
   * 获取所有会话 ID
   */
  getSessionIds(): string[] {
    return this.sessionManager.getSessions().map(s => s.id);
  }

  /**
   * Kill all sessions for a workspace
   */
  killWorkspaceSessions(workspaceId: string): void {
    // Note: This method would need workspace-to-session mapping in the future
    // For now, we iterate through all sessions and kill them
    const sessions = this.sessionManager.getSessions();
    for (const session of sessions) {
      this.sessionManager.killSession(session.id);
    }
  }

  /**
   * 关闭服务器
   */
  close(): void {
    // 清理所有会话（通过 TerminalSessionManager）
    const sessions = this.sessionManager.getSessions();
    for (const session of sessions) {
      try {
        this.sessionManager.killSession(session.id);
      } catch (error) {
        console.error(`Error cleaning up session ${session.id}:`, error);
      }
    }

    // 关闭 WebSocket 服务器
    this.wss.close((error) => {
      if (error) {
        console.error("Error closing WebSocket server:", error);
      } else {
        console.log("WebSocket Server closed");
      }
    });
  }
}

// 默认导出单例（延迟初始化）
let serverInstance: TerminalWSServer | null = null;

export function startWSServer(options?: WSServerOptions): TerminalWSServer {
  if (!serverInstance) {
    serverInstance = new TerminalWSServer(options);
  }
  return serverInstance;
}

export function getWSServer(): TerminalWSServer | null {
  return serverInstance;
}

export function stopWSServer(): void {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
}
