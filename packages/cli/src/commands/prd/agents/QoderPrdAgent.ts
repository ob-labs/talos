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

/**
 * 首条消息：Qoder TUI 不会把 `argv` 里 `--` 后的内容当作首条用户消息；`--attachment` 也只支持图片。
 * 做法：先用 `qodercli -w <dir> -f stream-json -p <taskContent>` 跑完第一轮（`-p`/`--print` 会吃掉下一参数，勿再写 `--print --output-format …`），
 * 从 NDJSON 解析 `session_id`，再 `qodercli -w <dir> -r <session_id>` 进入 TUI 多轮。
 * 流式多轮仍见 QoderPrdStreamRunner。
 */

/** Resolve binary：`TALOS_QODER_CLI`，默认 `qodercli`。 */
export function resolveQoderCliCommand(): string {
  const fromEnv = process.env.TALOS_QODER_CLI?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : "qodercli";
}

/** Short seed when reconnecting with `--resume`; full PRD instructions stay server-side. */
const QODER_RESUME_SEED_PROMPT =
  "Continue the in-progress PRD conversation using prior context. If you were waiting on the user, reply briefly and ask what they need next.";

/** NDJSON lines from `qodercli --output-format stream-json` (cursor-agent–compatible shape). */
interface QoderAgentStreamLine {
  type: string;
  subtype?: string;
  session_id?: string;
  message?: {
    role?: string;
    content?: Array<{ type?: string; text?: string }>;
  };
}

class QoderStreamJsonParser {
  private buffer = "";

  parse(chunk: string): QoderAgentStreamLine[] {
    const messages: QoderAgentStreamLine[] = [];
    this.buffer += chunk;

    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        messages.push(JSON.parse(trimmed) as QoderAgentStreamLine);
      } catch {
        if (!trimmed.startsWith("{")) continue;
      }
    }

    return messages;
  }
}

/**
 * One print-mode turn: sends `taskContent` as the first user message; returns Qoder's session id for `-r` / TUI.
 */
async function runQoderPrintBootstrap(
  cwd: string,
  taskContent: string,
  bin: string
): Promise<string> {
  const args = ["-w", cwd, "-f", "stream-json", "-p", taskContent];
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      stdio: ["ignore", "pipe", "inherit"],
    });
    let qoderSessionId: string | null = null;
    const parser = new QoderStreamJsonParser();
    const stdout = child.stdout;
    if (!stdout) {
      reject(new Error(`${bin}: no stdout`));
      return;
    }
    stdout.on("data", (data: Buffer) => {
      for (const line of parser.parse(data.toString())) {
        if (line.session_id) {
          qoderSessionId = line.session_id;
        }
      }
    });
    child.on("close", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`${bin} print bootstrap exited with code ${code}`));
        return;
      }
      if (!qoderSessionId) {
        reject(new Error(`${bin}: no session_id in stream-json output`));
        return;
      }
      resolve(qoderSessionId);
    });
    child.on("error", (err) => {
      reject(err);
    });
  });
}

function openQoderTui(bin: string, cwd: string, qoderSessionId: string): Promise<void> {
  const proc = spawn(bin, ["-w", cwd, "-r", qoderSessionId], { cwd, stdio: "inherit" });
  return new Promise((resolve, reject) => {
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error(`\n${bin} exited with code: ${code ?? 1}`);
        process.exit(code ?? 1);
      }
    });
    proc.on("error", (error) => {
      console.error(ErrorMessages.UNKNOWN_ERROR(error));
      reject(error);
    });
  });
}

export class QoderPrdAgent implements PrdAgent {
  async start(options: PrdAgentStartOptions): Promise<void> {
    const { repoRoot, taskContent, prdSessionId } = options;
    const bin = resolveQoderCliCommand();
    const sessionManager = new PrdSessionManager();

    console.log("");
    console.log(
      "Loading PRD context in Qoder (non-interactive first turn). The interactive UI opens when this completes."
    );
    console.log("");

    let qoderSessionId: string;
    try {
      qoderSessionId = await runQoderPrintBootstrap(repoRoot, taskContent, bin);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(msg);
      process.exit(1);
    }

    if (prdSessionId) {
      sessionManager.setQoderSessionId(prdSessionId, qoderSessionId);
    }

    await openQoderTui(bin, repoRoot, qoderSessionId);
  }

  async resume(prdSessionId: string, options: PrdAgentResumeOptions = {}): Promise<void> {
    void options;
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

    const bin = resolveQoderCliCommand();
    console.log(`Resuming PRD session: ${prdSessionId}`);
    console.log(`Using ${bin}...`);
    console.log("");

    const systemPrompt = loadSystemPrompt();
    const taskContent = buildTaskContent(systemPrompt);

    let qoderSessionId = session.qoderSessionId;
    if (!qoderSessionId) {
      console.log(
        "No Qoder chat id stored for this session yet; running one print turn to load PRD context, then opening TUI."
      );
      console.log("");
      try {
        qoderSessionId = await runQoderPrintBootstrap(session.workspacePath, taskContent, bin);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(msg);
        process.exit(1);
      }
      sessionManager.setQoderSessionId(prdSessionId, qoderSessionId);
    }

    await openQoderTui(bin, session.workspacePath, qoderSessionId);
  }

  async startStream(
    cwd: string,
    prompt: string,
    options: PrdAgentStartStreamOptions = {}
  ): Promise<void> {
    void options;
    const runner = new QoderPrdStreamRunner();
    await runner.start(cwd, prompt);
  }

  async resumeStream(
    sessionId: string,
    _prompt: string,
    options: PrdAgentResumeStreamOptions = {}
  ): Promise<void> {
    const runner = new QoderPrdStreamRunner();
    const cwd = options.cwd ?? process.cwd();
    await runner.resumeWithQoderSession(sessionId, cwd);
  }
}

/**
 * Stream stdio: NDJSON from qodercli print mode; multi-turn via a new process per turn with `-r <session_id>`.
 */
class QoderPrdStreamRunner {
  private debug = process.env.DEBUG === "true";
  private rl: readline.ReadLine | null = null;
  private cwd = "";
  private qoderChatId: string | null = null;
  private sessionStartSent = false;
  private busy = false;
  private activeChild: ChildProcess | null = null;

  constructor() {
    this.setupStdinReader();
  }

  private qoderBin(): string {
    return resolveQoderCliCommand();
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
        if (!this.qoderChatId) {
          this.sendMessage({
            type: "error",
            message: "No Qoder session id yet; wait for the first turn to finish.",
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
    const args = ["-w", this.cwd, "-f", "stream-json"];
    if (this.qoderChatId) {
      args.push("-r", this.qoderChatId);
    }
    args.push("-p", prompt);
    return args;
  }

  private handleQoderLine(line: QoderAgentStreamLine): void {
    if (line.session_id) {
      this.qoderChatId = line.session_id;
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
    const bin = this.qoderBin();
    const args = this.buildSpawnArgs(prompt);
    if (this.debug) {
      process.stderr.write(`[DEBUG] ${bin} ${JSON.stringify(args)}\n`);
    }

    const child = spawn(bin, args, {
      cwd: this.cwd,
      stdio: ["ignore", "pipe", "inherit"],
    });
    this.activeChild = child;

    const parser = new QoderStreamJsonParser();
    const stdout = child.stdout;
    if (!stdout) {
      this.busy = false;
      this.activeChild = null;
      this.sendMessage({
        type: "error",
        message: `${bin} has no stdout pipe`,
        timestamp: new Date().toISOString(),
      });
      this.sendMessage({ type: "done", timestamp: new Date().toISOString() });
      return;
    }

    stdout.on("data", (data: Buffer) => {
      for (const msg of parser.parse(data.toString())) {
        this.handleQoderLine(msg);
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
            message: `${bin} exited with code ${code}`,
            timestamp: new Date().toISOString(),
          });
        }
        finish();
      });
      child.on("error", (error) => {
        this.sendMessage({
          type: "error",
          message: `Failed to spawn ${bin}: ${error.message}`,
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

  async start(cwd: string, prompt: string): Promise<void> {
    this.cwd = cwd;
    this.qoderChatId = null;
    this.sessionStartSent = false;

    this.sendMessage({
      type: "thinking",
      content: `Starting ${this.qoderBin()} PRD generator...`,
      timestamp: new Date().toISOString(),
    });

    await this.runTurn(prompt);
  }

  async resumeWithQoderSession(qoderSessionId: string, cwd: string): Promise<void> {
    this.cwd = cwd;
    this.qoderChatId = qoderSessionId;
    this.sessionStartSent = true;

    const displaySessionId = qoderSessionId.slice(-8);
    this.sendMessage({
      type: "thinking",
      content: `Resuming ${this.qoderBin()} (${displaySessionId})...`,
      timestamp: new Date().toISOString(),
    });

    await this.runTurn(QODER_RESUME_SEED_PROMPT);
  }
}
