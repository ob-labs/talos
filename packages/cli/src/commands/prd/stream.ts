/**
 * PRD Stream Protocol Handler
 *
 * Implements the stdio JSON protocol for `talos prd --stream`
 * Enables external applications to interact with PRD generation via spawn
 */

import { spawn } from "child_process";
import * as readline from "readline";
import type { PrdStreamMessage, PrdStreamInput, StreamJSONMessage } from "@talos/types";
import { randomUUID } from "crypto";

/**
 * Simple Stream-JSON Parser (inlined to avoid dependency issues)
 */
class StreamJSONParser {
  private buffer: string = "";

  parse(chunk: string): StreamJSONMessage[] {
    const messages: StreamJSONMessage[] = [];
    this.buffer += chunk;

    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const message = JSON.parse(trimmed) as StreamJSONMessage;
        messages.push(message);
      } catch {
        // Skip invalid JSON lines that don't look like JSON
        if (!trimmed.startsWith("{")) {
          continue;
        }
      }
    }

    return messages;
  }

  clear(): void {
    this.buffer = "";
  }
}

/**
 * Context passed to each stream tool strategy
 */
export interface PrdStreamToolContext {
  cwd: string;
  initialPrompt: string;
  model?: string;
  sessionId?: string;
  isResume?: boolean;
  debug?: boolean;
  /** Forward a message to the client */
  sendMessage(msg: PrdStreamMessage): void;
  /** Write user input to the tool's stdin (for multi-turn tools) */
  setStdin(stdin: NodeJS.WritableStream | null): void;
}

/**
 * Strategy interface for stream-mode PRD tool execution
 */
export interface PrdStreamToolStrategy {
  displayName: string;
  /** Start the session; resolves when the tool exits */
  start(ctx: PrdStreamToolContext): Promise<void>;
  /** Forward a user message to the running session (multi-turn) */
  sendUserInput?(content: string, ctx: PrdStreamToolContext): void;
}

// ---- Claude stream strategy ----
const claudeStreamStrategy: PrdStreamToolStrategy = {
  displayName: "Claude Code",
  async start(ctx) {
    const { cwd, initialPrompt, model, sessionId, isResume, debug, sendMessage, setStdin } = ctx;
    const claudeArgs = [
      "--print",
      "--input-format=stream-json",
      "--output-format=stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
    ];
    if (model) claudeArgs.push("--model", model);
    if (sessionId) {
      if (isResume) {
        claudeArgs.splice(1, 0, "--resume", sessionId);
      } else {
        claudeArgs.splice(1, 0, "--session-id", sessionId);
      }
    }

    const claude = spawn("claude", claudeArgs, {
      cwd,
      stdio: ["pipe", "pipe", "inherit"],
    });

    setStdin(claude.stdin);
    if (debug) process.stderr.write(`[DEBUG] Spawned Claude PID:${claude.pid} (${isResume ? 'resume' : 'new'})\n`);

    if (!isResume) {
      const initialMessage = JSON.stringify({
        type: "user",
        message: { role: "user", content: [{ type: "text", text: initialPrompt }] },
      }) + "\n";
      claude.stdin.write(initialMessage);
      if (debug) process.stderr.write(`[DEBUG] Sent initial prompt\n`);
    } else {
      // For resumed sessions, send a minimal trigger to get Claude to respond
      const continueMessage = JSON.stringify({
        type: "user",
        message: { role: "user", content: [{ type: "text", text: "continue" }] },
      }) + "\n";
      claude.stdin.write(continueMessage);
      if (debug) process.stderr.write(`[DEBUG] Sent continue message for resumed session\n`);
    }

    const parser = new StreamJSONParser();
    claude.stdout.on("data", (data: Buffer) => {
      const messages = parser.parse(data.toString());
      for (const msg of messages) {
        if (debug) process.stderr.write(`[DEBUG] Claude message type: ${msg.type}\n`);
        if (msg.type === "system" || msg.type === "result") continue;
        if (msg.type === "assistant") {
          sendMessage({ timestamp: new Date().toISOString(), ...msg } as PrdStreamMessage);
        }
      }
    });

    return new Promise<void>((resolve) => {
      claude.on("close", (code) => {
        setStdin(null);
        if (debug) process.stderr.write(`[DEBUG] Claude exited with code:${code}\n`);
        resolve();
      });
      claude.on("error", (error) => {
        setStdin(null);
        sendMessage({ type: "error", message: `Failed to spawn Claude: ${error.message}`, timestamp: new Date().toISOString() });
        resolve();
      });
    });
  },
  sendUserInput(content, ctx) {
    // ctx.setStdin is a setter; we need the current stdin value via a closure trick —
    // PrdStreamHandler exposes it through the context object's setStdin, but we need
    // a getter too. The handler passes the live ref via the write helper below.
  },
};

// ---- Cursor stream strategy ----
const cursorStreamStrategy: PrdStreamToolStrategy = {
  displayName: "Cursor Agent",
  async start(ctx) {
    const { cwd, initialPrompt, model, sendMessage } = ctx;
    const args = ["--print", "--trust", "--force"];
    if (model) args.push("--model", model);

    const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tempDir = await mkdtemp(join(tmpdir(), "talos-prd-cursor-"));
    const tempFile = join(tempDir, "prompt.txt");
    await writeFile(tempFile, initialPrompt, "utf-8");

    const shellCommand = `cat "${tempFile}" | cursor-agent ${args.join(" ")}`;
    const cursor = spawn("sh", ["-c", shellCommand], {
      cwd,
      stdio: ["pipe", "pipe", "inherit"],
    });

    let stdout = "";
    cursor.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });

    return new Promise<void>((resolve) => {
      cursor.on("close", async () => {
        try { await rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
        if (stdout.trim()) {
          sendMessage({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: stdout }] }, timestamp: new Date().toISOString() } as any);
        }
        sendMessage({ type: "done" as any, timestamp: new Date().toISOString() } as any);
        resolve();
      });
      cursor.on("error", async (error) => {
        try { await rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
        sendMessage({ type: "error", message: `Failed to spawn cursor-agent: ${error.message}`, timestamp: new Date().toISOString() });
        resolve();
      });
    });
  },
  // cursor-agent is single-shot; no multi-turn user input forwarding
};

/**
 * Registry of all supported PRD stream tool strategies.
 * Add new tools here without touching PrdStreamHandler.
 */
const PRD_STREAM_TOOL_STRATEGIES: Record<string, PrdStreamToolStrategy> = {
  claude: claudeStreamStrategy,
  cursor: cursorStreamStrategy,
};

/**
 * Handles PRD streaming protocol communication
 */
export class PrdStreamHandler {
  private parser = new StreamJSONParser();
  private debug = process.env.DEBUG === "true";
  private cwd: string = "";
  private toolStdin: NodeJS.WritableStream | null = null;
  private toolName: string = "claude";
  private model: string | undefined = undefined;
  private sessionId: string = "";

  /**
   * Start a new PRD session
   */
  async start(cwd: string, prompt: string, options: { tool?: string; model?: string } = {}): Promise<void> {
    this.cwd = cwd;
    this.toolName = options.tool || "claude";
    this.model = options.model;

    const strategy = PRD_STREAM_TOOL_STRATEGIES[this.toolName];
    if (!strategy) {
      const supported = Object.keys(PRD_STREAM_TOOL_STRATEGIES).join(", ");
      this.sendMessage({ type: "error", message: `Unsupported tool: "${this.toolName}". Supported: ${supported}`, timestamp: new Date().toISOString() });
      return;
    }

    // For Claude, generate and emit session ID
    if (this.toolName === "claude") {
      this.sessionId = randomUUID();
      this.sendMessage({
        type: "session_start",
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
      } as PrdStreamMessage);
    }

    this.sendMessage({
      type: "thinking",
      content: `Starting ${strategy.displayName} PRD generator...`,
      timestamp: new Date().toISOString(),
    });

    const ctx: PrdStreamToolContext = {
      cwd,
      initialPrompt: prompt,
      model: this.model,
      sessionId: this.sessionId || undefined,
      isResume: false,
      debug: this.debug,
      sendMessage: (msg) => this.sendMessage(msg),
      setStdin: (stdin) => { this.toolStdin = stdin; },
    };

    await strategy.start(ctx);
  }

  /**
   * Resume an existing session
   */
  async resume(sessionId: string, prompt: string, options: { tool?: string; model?: string } = {}): Promise<void> {
    this.cwd = cwd;
    this.toolName = options.tool || "claude";
    this.model = options.model;
    this.sessionId = sessionId;

    const strategy = PRD_STREAM_TOOL_STRATEGIES[this.toolName];
    if (!strategy) {
      const supported = Object.keys(PRD_STREAM_TOOL_STRATEGIES).join(", ");
      this.sendMessage({ type: "error", message: `Unsupported tool: "${this.toolName}". Supported: ${supported}`, timestamp: new Date().toISOString() });
      return;
    }

    // Show simple resume message with session ID
    const displaySessionId = sessionId.slice(-8);
    this.sendMessage({
      type: "thinking",
      content: `Resuming ${strategy.displayName} from ${displaySessionId}...`,
      timestamp: new Date().toISOString(),
    });

    const ctx: PrdStreamToolContext = {
      cwd: this.cwd,
      initialPrompt: prompt,
      model: this.model,
      sessionId: this.sessionId,
      isResume: true,
      debug: this.debug,
      sendMessage: (msg) => this.sendMessage(msg),
      setStdin: (stdin) => { this.toolStdin = stdin; },
    };

    await strategy.start(ctx);
  }

  /**
   * Handle client input from stdin
   */
  private handleClientInput(line: string): void {
    try {
      const input: PrdStreamInput = JSON.parse(line);
      if (input.type === "cancel") {
        this.sendMessage({
          type: "cancel",
          message: "Cancelled by user",
          timestamp: new Date().toISOString(),
        });
        process.exit(0);
      } else if (input.type === "input" && input.content) {
        if (!this.toolStdin) {
          this.sendMessage({
            type: "error",
            message: "Tool session not active",
            timestamp: new Date().toISOString(),
          });
          return;
        }
        // Forward user input to the tool in stream-json format
        const toolMessage = JSON.stringify({
          type: "user",
          message: {
            role: "user",
            content: [{ type: "text", text: input.content }]
          }
        }) + "\n";
        this.toolStdin.write(toolMessage);

        if (this.debug) {
          process.stderr.write(`[DEBUG] Sent user input to ${this.toolName}\n`);
        }
      }
    } catch (e) {
      this.sendMessage({
        type: "error",
        message: "Invalid JSON input",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Send a message to client via stdout
   */
  private sendMessage(msg: PrdStreamMessage): void {
    console.log(JSON.stringify(msg));
  }
}
