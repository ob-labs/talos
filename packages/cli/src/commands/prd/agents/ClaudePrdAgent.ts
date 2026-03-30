import { spawn } from "child_process";
import * as readline from "readline";
import { randomUUID } from "crypto";
import type { PrdStreamInput, PrdStreamMessage, StreamJSONMessage } from "@talos/types";
import { ErrorMessages } from "@/utils/errors";
import { PrdSessionManager } from "../session-manager";
import type {
  PrdAgent,
  PrdAgentResumeOptions,
  PrdAgentResumeStreamOptions,
  PrdAgentStartOptions,
  PrdAgentStartStreamOptions,
} from "./PrdAgent";

interface ClaudeStreamContext {
  cwd: string;
  initialPrompt: string;
  model?: string;
  sessionId?: string;
  isResume?: boolean;
  debug: boolean;
  sendMessage(msg: PrdStreamMessage): void;
  setStdin(stdin: NodeJS.WritableStream | null): void;
}

export class ClaudePrdAgent implements PrdAgent {
  async start(options: PrdAgentStartOptions): Promise<void> {
    const { repoRoot, taskContent, model } = options;
    const args = ["--", taskContent];
    if (model) {
      args.unshift("--model", model);
    }
    const proc = spawn("claude", args, { cwd: repoRoot, stdio: "inherit" });
    return new Promise((resolve, reject) => {
      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.error(`\nClaude Code exited with code: ${code ?? 1}`);
          process.exit(code ?? 1);
        }
      });
      proc.on("error", (error) => {
        console.error(ErrorMessages.UNKNOWN_ERROR(error));
        reject(error);
      });
    });
  }

  async resume(prdSessionId: string, options: PrdAgentResumeOptions = {}): Promise<void> {
    const { detectWorkspace } = await import("../index.js");
    void options;

    const sessionManager = new PrdSessionManager();
    const session = sessionManager.getSession(prdSessionId);

    if (!session) {
      console.error(`Session ${prdSessionId} not found.`);
      console.log(`Use --list to see all available sessions.`);
      process.exit(1);
    }

    const { path: currentWorkspace } = await detectWorkspace();
    if (session.workspacePath !== currentWorkspace) {
      console.error(`Workspace mismatch.`);
      console.error(`Session workspace: ${session.workspacePath}`);
      console.error(`Current workspace: ${currentWorkspace}`);
      console.log(`\nNavigate to the correct workspace and try again.`);
      process.exit(1);
    }

    sessionManager.updateLastUsed(prdSessionId);

    console.log(`Resuming PRD session: ${prdSessionId}`);
    console.log(`Using Claude Code...`);
    console.log("");

    const proc = spawn("claude", ["--resume", prdSessionId], {
      cwd: session.workspacePath,
      stdio: "inherit",
    });

    return new Promise((resolve, reject) => {
      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.error(`\nClaude Code exited with code: ${code ?? 1}`);
          process.exit(code ?? 1);
        }
      });
      proc.on("error", (error) => {
        console.error(ErrorMessages.UNKNOWN_ERROR(error));
        reject(error);
      });
    });
  }

  async startStream(
    cwd: string,
    prompt: string,
    options: PrdAgentStartStreamOptions = {}
  ): Promise<void> {
    const handler = new ClaudePrdStreamHandler();
    await handler.start(cwd, prompt, options.model);
  }

  async resumeStream(
    sessionId: string,
    prompt: string,
    options: PrdAgentResumeStreamOptions = {}
  ): Promise<void> {
    const handler = new ClaudePrdStreamHandler();
    await handler.resume(sessionId, prompt, options.cwd, options.model);
  }
}

/** Stream-JSON line parser (same behavior as prd stream protocol). */
class StreamJSONParser {
  private buffer = "";

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
        messages.push(JSON.parse(trimmed) as StreamJSONMessage);
      } catch {
        if (!trimmed.startsWith("{")) continue;
      }
    }

    return messages;
  }
}

async function runClaudeStreamJsonSession(ctx: ClaudeStreamContext): Promise<void> {
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
  if (debug) {
    process.stderr.write(`[DEBUG] Spawned Claude PID:${claude.pid} (${isResume ? "resume" : "new"})\n`);
  }

  if (!isResume) {
    const initialMessage =
      JSON.stringify({
        type: "user",
        message: { role: "user", content: [{ type: "text", text: initialPrompt }] },
      }) + "\n";
    claude.stdin.write(initialMessage);
    if (debug) process.stderr.write(`[DEBUG] Sent initial prompt\n`);
  } else {
    const continueMessage =
      JSON.stringify({
        type: "user",
        message: { role: "user", content: [{ type: "text", text: "continue" }] },
      }) + "\n";
    claude.stdin.write(continueMessage);
    if (debug) process.stderr.write(`[DEBUG] Sent continue message for resumed session\n`);
  }

  const parser = new StreamJSONParser();
  claude.stdout.on("data", (data: Buffer) => {
    for (const msg of parser.parse(data.toString())) {
      if (debug) process.stderr.write(`[DEBUG] Claude message type: ${msg.type}\n`);
      if (msg.type === "system" || msg.type === "result") continue;
      if (msg.type === "assistant") {
        sendMessage({ timestamp: new Date().toISOString(), ...msg } as unknown as PrdStreamMessage);
      }
    }
  });

  await new Promise<void>((resolve) => {
    claude.on("close", (code) => {
      setStdin(null);
      if (debug) process.stderr.write(`[DEBUG] Claude exited with code:${code}\n`);
      resolve();
    });
    claude.on("error", (error) => {
      setStdin(null);
      sendMessage({
        type: "error",
        message: `Failed to spawn Claude: ${error.message}`,
        timestamp: new Date().toISOString(),
      });
      resolve();
    });
  });
}

/**
 * Claude-only stdio JSON stream handler (same protocol as `talos prd --stream` for tool=claude).
 */
class ClaudePrdStreamHandler {
  private debug = process.env.DEBUG === "true";
  private cwd = "";
  private toolStdin: NodeJS.WritableStream | null = null;
  private model: string | undefined;
  private sessionId = "";
  private rl: readline.ReadLine | null = null;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });
    this.rl.on("line", (line) => this.handleClientInput(line));
    this.rl.on("close", () => {
      if (this.debug) process.stderr.write("[DEBUG] Stdin closed, exiting\n");
      process.exit(0);
    });
  }

  async start(cwd: string, prompt: string, model?: string): Promise<void> {
    this.cwd = cwd;
    this.model = model;
    this.sessionId = randomUUID();
    this.sendMessage({
      type: "session_start",
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    } as PrdStreamMessage);
    this.sendMessage({
      type: "thinking",
      content: "Starting Claude Code PRD generator...",
      timestamp: new Date().toISOString(),
    });

    await runClaudeStreamJsonSession({
      cwd,
      initialPrompt: prompt,
      model: this.model,
      sessionId: this.sessionId,
      isResume: false,
      debug: this.debug,
      sendMessage: (msg) => this.sendMessage(msg),
      setStdin: (stdin) => {
        this.toolStdin = stdin;
      },
    });
  }

  async resume(sessionId: string, prompt: string, cwd?: string, model?: string): Promise<void> {
    this.cwd = cwd ?? process.cwd();
    this.model = model;
    this.sessionId = sessionId;

    const displaySessionId = sessionId.slice(-8);
    this.sendMessage({
      type: "thinking",
      content: `Resuming Claude Code from ${displaySessionId}...`,
      timestamp: new Date().toISOString(),
    });

    await runClaudeStreamJsonSession({
      cwd: this.cwd,
      initialPrompt: prompt,
      model: this.model,
      sessionId: this.sessionId,
      isResume: true,
      debug: this.debug,
      sendMessage: (msg) => this.sendMessage(msg),
      setStdin: (stdin) => {
        this.toolStdin = stdin;
      },
    });
  }

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
        const toolMessage =
          JSON.stringify({
            type: "user",
            message: {
              role: "user",
              content: [{ type: "text", text: input.content }],
            },
          }) + "\n";
        this.toolStdin.write(toolMessage);
        if (this.debug) process.stderr.write(`[DEBUG] Sent user input to claude\n`);
      }
    } catch {
      this.sendMessage({
        type: "error",
        message: "Invalid JSON input",
        timestamp: new Date().toISOString(),
      });
    }
  }

  private sendMessage(msg: PrdStreamMessage): void {
    console.log(JSON.stringify(msg));
  }
}
