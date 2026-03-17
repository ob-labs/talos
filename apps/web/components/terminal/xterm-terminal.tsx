"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { CommandHistoryManager } from "@/lib/terminal";
import { TERMINAL_WS_PATH } from "@/lib/terminal";
import { terminalCache } from "@/lib/terminal";

// WebSocket message types (matching server)
type WSMessage =
  | { type: "input"; data: string }
  | { type: "output"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "exit"; code: number }
  | { type: "ready"; sessionId: string };

// VS Code Dark+ theme colors
const VS_CODE_THEME = {
  background: "#0d1117",
  foreground: "#e6edf3",
  cursor: "#e6edf3",
  cursorAccent: "#0d1117",
  selectionBackground: "#264f78",
  selectionForeground: "#e6edf3",
  black: "#000000",
  red: "#f85149",
  green: "#3fb950",
  yellow: "#d29922",
  blue: "#58a6ff",
  magenta: "#bc8cff",
  cyan: "#39c5cf",
  white: "#e6edf3",
  brightBlack: "#8b949e",
  brightRed: "#f85149",
  brightGreen: "#3fb950",
  brightYellow: "#d29922",
  brightBlue: "#58a6ff",
  brightMagenta: "#bc8cff",
  brightCyan: "#39c5cf",
  brightWhite: "#ffffff",
};

export interface TerminalLog {
  type: "system" | "info" | "success" | "error" | "warning" | "command";
  message: string;
  timestamp: number;
}

interface XtermTerminalProps {
  logs?: TerminalLog[];
  onCommand?: (command: string) => void;
  className?: string;
  welcomeMessage?: string;
  prompt?: string;
  readOnly?: boolean;
  commandHistory?: CommandHistoryManager;
  // WebSocket mode props
  webSocketMode?: boolean;
  webSocketUrl?: string;
  onConnectionChange?: (connected: boolean, sessionId?: string) => void;
  workspaceId?: string;
  workspacePath?: string;
  // Terminal caching props (for use with MultiTabTerminal)
  cacheKey?: string;
  isActive?: boolean;
}

export function XtermTerminal({
  logs = [],
  onCommand,
  className = "",
  welcomeMessage,
  prompt = "➜ ",
  readOnly = false,
  commandHistory,
  webSocketMode = false,
  webSocketUrl = "ws://localhost:3002",
  onConnectionChange,
  workspaceId,
  workspacePath,
  cacheKey,
  isActive = true,
}: XtermTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const currentLineRef = useRef("");
  const isProcessingRef = useRef(false);
  const cursorPositionRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Initialize terminal (with caching support)
  useEffect(() => {
    if (!terminalRef.current) return;

    // If cacheKey is provided, use the cache
    if (cacheKey) {
      const cached = terminalCache.getOrCreate(cacheKey);

      // Attach the cached terminal to our container
      if (terminalRef.current) {
        terminalCache.attach(cacheKey, terminalRef.current, isActive);
      }

      terminalInstanceRef.current = cached.terminal;
      fitAddonRef.current = cached.fitAddon;

      // Note: WebSocket connection and event handlers are set up separately below

      return () => {
        // Detach but don't dispose - keep in cache
        terminalCache.detach(cacheKey);
      };
    }

    // Original non-cached behavior
    if (terminalInstanceRef.current) return;

    const terminal = new Terminal({
      theme: VS_CODE_THEME,
      fontFamily: 'SF Mono, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 10000,
      allowProposedApi: true,
      convertEol: true,
      disableStdin: readOnly,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    // 参考 EDDYMENS：Ctrl/Cmd+V 粘贴剪贴板内容
    if (webSocketMode && !readOnly) {
      terminal.attachCustomKeyEventHandler((e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "v") {
          navigator.clipboard.readText().then((text) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: "input", data: text } as WSMessage));
            }
          }).catch(() => {});
          return false;
        }
        return true;
      });
    }

    terminal.open(terminalRef.current);
    fitAddon.fit();
    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Write welcome message
    if (welcomeMessage) {
      terminal.writeln(`\x1b[38;2;59;166;255m${welcomeMessage}\x1b[0m`);
      terminal.writeln("");
    }

    // Show prompt if not read-only
    if (!readOnly) {
      terminal.write(`\x1b[38;2;63;185;80m${prompt}\x1b[0m `);
    }

    // Helper function to rewrite the current line
    const rewriteLine = (newContent: string) => {
      // Clear from cursor to beginning of line
      const currentLength = currentLineRef.current.length;
      // Move cursor to beginning of input (after prompt)
      terminal.write(`\r\x1b[${prompt.length + 1}C`);
      // Clear to end of line
      terminal.write("\x1b[K");
      // Write new content
      terminal.write(newContent);
      currentLineRef.current = newContent;
      cursorPositionRef.current = newContent.length;
    };

    // Handle input
    if (!readOnly) {
      terminal.onData((data) => {
        // WebSocket 模式：直接透传输入到 PTY，不做任何转换（xterm.js 已正确发送输入序列）
        if (webSocketMode && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "input", data } as WSMessage));
          return;
        }

        // Local command processing mode (original logic)
        if (isProcessingRef.current) return;

        const code = data.charCodeAt(0);

        // Handle Enter key
        if (code === 13) {
          terminal.writeln("");
          const command = currentLineRef.current.trim();

          if (command && onCommand) {
            isProcessingRef.current = true;
            onCommand(command);
            isProcessingRef.current = false;
          }

          // Add to history
          if (command && commandHistory) {
            commandHistory.add(command);
          }

          currentLineRef.current = "";
          cursorPositionRef.current = 0;
          terminal.write(`\x1b[38;2;63;185;80m${prompt}\x1b[0m `);
        }
        // Handle Backspace
        else if (code === 127) {
          if (currentLineRef.current.length > 0 && cursorPositionRef.current > 0) {
            const beforeCursor = currentLineRef.current.slice(0, cursorPositionRef.current - 1);
            const afterCursor = currentLineRef.current.slice(cursorPositionRef.current);
            currentLineRef.current = beforeCursor + afterCursor;
            cursorPositionRef.current--;

            // Redraw line
            terminal.write("\b");
            terminal.write(afterCursor + " ");
            // Move cursor back
            terminal.write(`\x1b[${afterCursor.length + 1}D`);
          }
        }
        // Handle Ctrl+C
        else if (code === 3) {
          terminal.writeln("^C");
          currentLineRef.current = "";
          cursorPositionRef.current = 0;
          terminal.write(`\x1b[38;2;63;185;80m${prompt}\x1b[0m `);
        }
        // Handle Up Arrow (ESC[A sequence)
        else if (data === "\x1b[A" && commandHistory) {
          const previous = commandHistory.getPrevious(currentLineRef.current);
          if (previous !== null) {
            rewriteLine(previous);
          }
        }
        // Handle Down Arrow (ESC[B sequence)
        else if (data === "\x1b[B" && commandHistory) {
          const next = commandHistory.getNext();
          if (next !== null) {
            rewriteLine(next);
          }
        }
        // Handle Left Arrow
        else if (data === "\x1b[D") {
          if (cursorPositionRef.current > 0) {
            cursorPositionRef.current--;
            terminal.write("\x1b[D");
          }
        }
        // Handle Right Arrow
        else if (data === "\x1b[C") {
          if (cursorPositionRef.current < currentLineRef.current.length) {
            cursorPositionRef.current++;
            terminal.write("\x1b[C");
          }
        }
        // Handle Home key
        else if (data === "\x1b[H" || code === 1) {
          // Ctrl+A
          if (cursorPositionRef.current > 0) {
            terminal.write(`\x1b[${cursorPositionRef.current}D`);
            cursorPositionRef.current = 0;
          }
        }
        // Handle End key
        else if (data === "\x1b[F" || code === 5) {
          // Ctrl+E
          const remaining = currentLineRef.current.length - cursorPositionRef.current;
          if (remaining > 0) {
            terminal.write(`\x1b[${remaining}C`);
            cursorPositionRef.current = currentLineRef.current.length;
          }
        }
        // Handle printable characters
        else if (code >= 32 && code <= 126) {
          const beforeCursor = currentLineRef.current.slice(0, cursorPositionRef.current);
          const afterCursor = currentLineRef.current.slice(cursorPositionRef.current);
          currentLineRef.current = beforeCursor + data + afterCursor;
          cursorPositionRef.current++;

          terminal.write(data);
          // Redraw the rest of the line
          if (afterCursor) {
            terminal.write(afterCursor);
            // Move cursor back
            terminal.write(`\x1b[${afterCursor.length}D`);
          }
        }
      });
    }

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();

      // Send resize to WebSocket server if in WebSocket mode
      if (webSocketMode && wsRef.current?.readyState === WebSocket.OPEN) {
        const { cols, rows } = terminal;
        const message: WSMessage = { type: "resize", cols, rows };
        wsRef.current.send(JSON.stringify(message));
      }
    };

    window.addEventListener("resize", handleResize);

    // WebSocket 连接（支持自动重连，参考 EDDYMENS 架构）
    const connectWebSocket = () => {
      const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = typeof window !== "undefined" ? window.location.host : "localhost:3000";
      const wsUrl = new URL(`${protocol}//${host}${TERMINAL_WS_PATH}`);
      if (workspaceId) wsUrl.searchParams.set("workspaceId", workspaceId);
      if (workspacePath) wsUrl.searchParams.set("workspacePath", workspacePath);

      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setIsConnected(true);
        terminal.writeln("\x1b[38;2;63;185;80m✓ Connected to terminal server\x1b[0m");
        terminal.writeln("\x1b[38;2;139;148;158m点击终端区域后即可输入，Ctrl+V 粘贴\x1b[0m");
        requestAnimationFrame(() => {
          const textarea = terminalRef.current?.querySelector(".xterm-helper-textarea") as HTMLTextAreaElement;
          textarea?.focus({ preventScroll: false });
        });
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          switch (message.type) {
            case "ready":
              setSessionId(message.sessionId);
              onConnectionChange?.(true, message.sessionId);
              const { cols, rows } = terminal;
              ws.send(JSON.stringify({ type: "resize", cols, rows } as WSMessage));
              break;
            case "output":
              terminal.write(message.data);
              break;
            case "exit":
              terminal.writeln(`\x1b[38;2;248;81;73mProcess exited with code ${message.code}\x1b[0m`);
              setIsConnected(false);
              onConnectionChange?.(false);
              break;
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        onConnectionChange?.(false);
        wsRef.current = null;
        terminal.writeln("\x1b[38;2;248;81;73m✗ Disconnected\x1b[0m");

        // 自动重连（指数退避，最多 30 秒间隔）
        const attempt = reconnectAttemptRef.current++;
        const delay = Math.min(1000 * 2 ** attempt, 30000);
        reconnectRef.current = setTimeout(() => {
          terminal.writeln(`\x1b[38;2;139;148;158mReconnecting in ${delay / 1000}s...\x1b[0m`);
          connectWebSocket();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error('[XtermTerminal] WebSocket error:', error);
        terminal.writeln("\x1b[38;2;248;81;73m✗ WebSocket error\x1b[0m");
      };
    };

    if (webSocketMode && !readOnly) {
      connectWebSocket();
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      // Only dispose if not using cache
      if (!cacheKey) {
        terminal.dispose();
      }
      terminalInstanceRef.current = null;
      fitAddonRef.current = null;
    };
  }, [welcomeMessage, prompt, readOnly, onCommand, webSocketMode, webSocketUrl, onConnectionChange, workspaceId, workspacePath, cacheKey, isActive]);

  // Write logs to terminal
  const writeLog = useCallback((log: TerminalLog) => {
    const terminal = terminalInstanceRef.current;
    if (!terminal) return;

    const timestamp = new Date(log.timestamp).toLocaleTimeString();
    const prefix = `[${timestamp}] `;

    // Color mapping for log types
    const colorMap: Record<string, string> = {
      system: "\x1b[38;2;139;148;158m", // gray
      info: "\x1b[38;2;88;166;255m", // blue
      success: "\x1b[38;2;63;185;80m", // green
      error: "\x1b[38;2;248;81;73m", // red
      warning: "\x1b[38;2;210;153;34m", // yellow
      command: "\x1b[38;2;88;166;255m", // blue
    };

    const color = colorMap[log.type] || colorMap.system;
    const reset = "\x1b[0m";

    // Write log line
    terminal.writeln(`${color}${prefix}${log.message}${reset}`);
  }, []);

  // Process logs when they change
  useEffect(() => {
    const terminal = terminalInstanceRef.current;
    if (!terminal || logs.length === 0) return;

    // Write all logs on first render or new logs
    logs.forEach((log) => {
      writeLog(log);
    });

    // Auto-scroll to bottom
    terminal.scrollToBottom();
  }, [logs, writeLog]);

  // Method to write a line to terminal (for external use)
  const writeLine = useCallback((message: string, type: TerminalLog["type"] = "info") => {
    const terminal = terminalInstanceRef.current;
    if (!terminal) return;

    const colorMap: Record<string, string> = {
      system: "\x1b[38;2;139;148;158m",
      info: "\x1b[38;2;88;166;255m",
      success: "\x1b[38;2;63;185;80m",
      error: "\x1b[38;2;248;81;73m",
      warning: "\x1b[38;2;210;153;34m",
      command: "\x1b[38;2;88;166;255m",
    };

    const color = colorMap[type] || colorMap.info;
    terminal.writeln(`${color}${message}\x1b[0m`);
    terminal.scrollToBottom();
  }, []);

  // Method to clear terminal
  const clear = useCallback(() => {
    const terminal = terminalInstanceRef.current;
    if (!terminal) return;

    terminal.clear();
    currentLineRef.current = "";
    cursorPositionRef.current = 0;

    if (!readOnly) {
      terminal.write(`\x1b[38;2;63;185;80m${prompt}\x1b[0m `);
    }
  }, [prompt, readOnly]);

  // Expose methods via ref (optional, for parent component control)
  useEffect(() => {
    // Store methods on the container element for external access
    const container = terminalRef.current;
    if (container) {
      (container as unknown as { writeLine: typeof writeLine; clear: typeof clear }).writeLine = writeLine;
      (container as unknown as { writeLine: typeof writeLine; clear: typeof clear }).clear = clear;
    }
  }, [writeLine, clear]);

  return (
    <div
      ref={terminalRef}
      data-terminal
      className={`h-full w-full ${className}`}
      style={{
        backgroundColor: VS_CODE_THEME.background,
        padding: "8px",
        cursor: "text",
      }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const textarea = target.closest("[data-terminal]")?.querySelector(".xterm-helper-textarea") as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
        } else {
          terminalInstanceRef.current?.focus();
        }
      }}
      role="application"
      aria-label="Terminal"
    />
  );
}

export default XtermTerminal;
