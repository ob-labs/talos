import { spawn, type ChildProcess } from "child_process";
import * as readline from "readline";
import type { PrdStreamInput, PrdStreamMessage } from "@talos/types";
import { ErrorMessages } from "@/utils/errors";
import { PrdSessionManager } from "../session-manager";
import type {
  PrdAgent,
  PrdAgentResumeOptions,
  PrdAgentResumeStreamOptions,
  PrdAgentStartOptions,
  PrdAgentStartStreamOptions,
} from "./PrdAgent";

/** Short seed message when reconnecting with `--resume`; full PRD instructions stay server-side. */
const CURSOR_RESUME_SEED_PROMPT =
  "Continue the in-progress PRD conversation using prior context. If you were waiting on the user, reply briefly and ask what they need next.";

/** NDJSON lines from `cursor-agent --output-format stream-json`. */
interface CursorAgentStreamLine {
  type: string;
  subtype?: string;
  session_id?: string;
  message?: {
    role?: string;
    content?: Array<{ type?: string; text?: string }>;
  };
}

export class CursorPrdAgent implements PrdAgent {
  async start(options: PrdAgentStartOptions): Promise<void> {
    const { repoRoot, taskContent, model } = options;
    const modelTrim = model?.trim();
    const cursorArgs = ["--workspace", repoRoot];
    if (modelTrim) {
      cursorArgs.push("--model", modelTrim);
    }
    cursorArgs.push("--", taskContent);

    const proc = spawn("cursor-agent", cursorArgs, {
      cwd: repoRoot,
      stdio: "inherit",
    });

    return new Promise((resolve, reject) => {
      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.error(`\nCursor Agent exited with code: ${code ?? 1}`);
          console.error(
            "Tip: ensure CURSOR_API_KEY is set, or run `cursor-agent login` (see docs/CURSOR_AGENT_SETUP.zh-CN.md)."
          );
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
    const { detectWorkspace, loadSystemPrompt, buildTaskContent } = await import("../index.js");

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

    const systemPrompt = loadSystemPrompt();
    const taskContent = buildTaskContent(systemPrompt);

    console.log(`Resuming PRD session: ${prdSessionId}`);
    console.log(`Using Cursor Agent...`);
    console.log("");

    const args = ["--workspace", session.workspacePath];
    if (options.model) {
      args.push("--model", options.model);
    }
    args.push("--", taskContent);

    const proc = spawn("cursor-agent", args, {
      cwd: session.workspacePath,
      stdio: "inherit",
    });

    return new Promise((resolve, reject) => {
      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.error(`\nCursor Agent exited with code: ${code ?? 1}`);
          console.error(
            "Tip: ensure CURSOR_API_KEY is set, or run `cursor-agent login` (see docs/CURSOR_AGENT_SETUP.zh-CN.md)."
          );
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
    const runner = new CursorPrdStreamRunner();
    await runner.start(cwd, prompt, options.model);
  }

  async resumeStream(
    sessionId: string,
    _prompt: string,
    options: PrdAgentResumeStreamOptions = {}
  ): Promise<void> {
    const runner = new CursorPrdStreamRunner();
    const cwd = options.cwd ?? process.cwd();
    await runner.resumeWithCursorSession(sessionId, cwd, options.model);
  }
}

class CursorStreamJsonParser {
  private buffer = "";

  parse(chunk: string): CursorAgentStreamLine[] {
    const messages: CursorAgentStreamLine[] = [];
    this.buffer += chunk;

    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        messages.push(JSON.parse(trimmed) as CursorAgentStreamLine);
      } catch {
        if (!trimmed.startsWith("{")) continue;
      }
    }

    return messages;
  }
}

/**
 * Stream stdio protocol: NDJSON from cursor-agent; multi-turn via a new process per turn
 * with `--resume <session_id>` so only the new user line is sent (context stays on Cursor's side).
 */
class CursorPrdStreamRunner {
  private debug = process.env.DEBUG === "true";
  private rl: readline.ReadLine | null = null;
  private cwd = "";
  private model: string | undefined;
  /** Cursor chat id from stream `system`/`result` (used for `--resume`). */
  private cursorChatId: string | null = null;
  private sessionStartSent = false;
  private busy = false;
  private activeChild: ChildProcess | null = null;

  constructor() {
    this.setupStdinReader();
  }

  private setupStdinReader(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    this.rl.on("line", (line: string) => {
      void this.handleClientInput(line);
    });

    this.rl.on("close", () => {
      if (this.debug) {
        process.stderr.write("[DEBUG] Stdin closed, exiting\n");
      }
      process.exit(0);
    });
  }

  private async handleClientInput(line: string): Promise<void> {
    try {
      const input: PrdStreamInput = JSON.parse(line);
      if (input.type === "cancel") {
        if (this.activeChild && !this.activeChild.killed) {
          this.activeChild.kill("SIGTERM");
        }
        this.sendMessage({
          type: "cancel",
          message: "Cancelled by user",
          timestamp: new Date().toISOString(),
        });
        process.exit(0);
      }
      if (input.type === "input" && input.content) {
        if (this.busy) {
          this.sendMessage({
            type: "error",
            message: "Agent is still running; wait for done before sending input.",
            timestamp: new Date().toISOString(),
          });
          return;
        }
        if (!this.cursorChatId) {
          this.sendMessage({
            type: "error",
            message: "No Cursor session id yet; wait for the first turn to finish.",
            timestamp: new Date().toISOString(),
          });
          return;
        }
        await this.runTurn(input.content);
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

  private buildSpawnArgs(prompt: string): string[] {
    const args = [
      "--print",
      "--trust",
      "--force",
      "--output-format",
      "stream-json",
      "--stream-partial-output",
      "--workspace",
      this.cwd,
    ];
    const modelTrim = this.model?.trim();
    if (modelTrim) {
      args.push("--model", modelTrim);
    }
    if (this.cursorChatId) {
      args.push("--resume", this.cursorChatId);
    }
    args.push("--", prompt);
    return args;
  }

  private handleCursorLine(line: CursorAgentStreamLine): void {
    if (line.session_id) {
      this.cursorChatId = line.session_id;
    }

    if (line.type === "system" && line.subtype === "init" && line.session_id && !this.sessionStartSent) {
      this.sessionStartSent = true;
      this.sendMessage({
        type: "session_start",
        sessionId: line.session_id,
        timestamp: new Date().toISOString(),
      });
    }

    if (line.type === "assistant" && line.message?.content?.length) {
      const text = line.message.content
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text as string)
        .join("");
      if (text.length === 0) {
        return;
      }
      this.sendMessage({
        type: "assistant",
        message: line.message,
        timestamp: new Date().toISOString(),
      } as unknown as PrdStreamMessage);
    }
  }

  private async runTurn(prompt: string): Promise<void> {
    this.busy = true;
    const args = this.buildSpawnArgs(prompt);
    if (this.debug) {
      process.stderr.write(`[DEBUG] cursor-agent ${JSON.stringify(args)}\n`);
    }

    const child = spawn("cursor-agent", args, {
      cwd: this.cwd,
      stdio: ["ignore", "pipe", "inherit"],
    });
    this.activeChild = child;

    const parser = new CursorStreamJsonParser();
    const stdout = child.stdout;
    if (!stdout) {
      this.busy = false;
      this.activeChild = null;
      this.sendMessage({
        type: "error",
        message: "cursor-agent has no stdout pipe",
        timestamp: new Date().toISOString(),
      });
      this.sendMessage({ type: "done", timestamp: new Date().toISOString() });
      return;
    }

    stdout.on("data", (data: Buffer) => {
      for (const msg of parser.parse(data.toString())) {
        this.handleCursorLine(msg);
      }
    });

    await new Promise<void>((resolve) => {
      const finish = () => {
        this.activeChild = null;
        this.busy = false;
        resolve();
      };

      child.on("close", (code) => {
        if (code !== 0 && code !== null) {
          this.sendMessage({
            type: "error",
            message: `cursor-agent exited with code ${code}`,
            timestamp: new Date().toISOString(),
          });
        }
        finish();
      });
      child.on("error", (error) => {
        this.sendMessage({
          type: "error",
          message: `Failed to spawn cursor-agent: ${error.message}`,
          timestamp: new Date().toISOString(),
        });
        finish();
      });
    });

    this.sendMessage({
      type: "done",
      timestamp: new Date().toISOString(),
    });
  }

  async start(cwd: string, prompt: string, model?: string): Promise<void> {
    this.cwd = cwd;
    this.model = model;
    this.cursorChatId = null;
    this.sessionStartSent = false;

    this.sendMessage({
      type: "thinking",
      content: "Starting Cursor Agent PRD generator...",
      timestamp: new Date().toISOString(),
    });

    await this.runTurn(prompt);
  }

  async resumeWithCursorSession(cursorSessionId: string, cwd: string, model?: string): Promise<void> {
    this.cwd = cwd;
    this.model = model;
    this.cursorChatId = cursorSessionId;
    this.sessionStartSent = true;

    const displaySessionId = cursorSessionId.slice(-8);
    this.sendMessage({
      type: "thinking",
      content: `Resuming Cursor Agent (${displaySessionId})...`,
      timestamp: new Date().toISOString(),
    });

    await this.runTurn(CURSOR_RESUME_SEED_PROMPT);
  }
}
