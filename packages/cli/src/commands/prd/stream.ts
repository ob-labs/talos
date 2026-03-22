/**
 * PRD Stream Protocol Handler
 *
 * Implements the stdio JSON protocol for `talos prd --stream`
 * Enables external applications to interact with PRD generation via spawn
 */

import { spawn } from "child_process";
import * as readline from "readline";
import type { PrdStreamMessage, PrdStreamInput, StreamJSONMessage } from "@talos/types";

/**
 * Detects if Claude output contains a question with options
 */
interface DetectedQuestion {
  text: string;
  options?: string[];
}

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
 * Handles PRD streaming protocol communication
 */
export class PrdStreamHandler {
  private parser = new StreamJSONParser();
  private debug = process.env.DEBUG === "true";
  private cwd: string = "";
  private claudeStdin: NodeJS.WritableStream | null = null;

  /**
   * Start the streaming PRD session
   */
  async start(cwd: string, prompt: string): Promise<void> {
    this.cwd = cwd;
    // Send initial message
    this.sendMessage({
      type: "thinking",
      content: "Starting Claude Code PRD generator...",
      timestamp: new Date().toISOString(),
    });

    // Setup stdin reader for client input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    // Handle stdin from client
    rl.on("line", (line: string) => {
      this.handleClientInput(line);
    });

    // Spawn Claude with stream-json input/output for true multi-turn conversation
    await this.startClaudeSession(prompt);
  }

  /**
   * Start a Claude session that maintains conversation context
   */
  private async startClaudeSession(initialPrompt: string): Promise<void> {
    // Use --input-format=stream-json for multi-turn conversation
    const claude = spawn("claude", [
      "--print",
      "--input-format=stream-json",
      "--output-format=stream-json",
      "--verbose"
    ], {
      cwd: this.cwd,
      stdio: ["pipe", "pipe", "inherit"],
    });

    this.claudeStdin = claude.stdin;

    if (this.debug) {
      process.stderr.write(`[DEBUG] Spawned Claude PID:${claude.pid} with stream-json I/O\n`);
    }

    // Send initial prompt in stream-json format
    const initialMessage = JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: initialPrompt }]
      }
    }) + "\n";
    claude.stdin.write(initialMessage);

    if (this.debug) {
      process.stderr.write(`[DEBUG] Sent initial prompt\n`);
    }

    // Handle stdout from Claude
    claude.stdout.on("data", (data: Buffer) => {
      this.handleClaudeOutput(data.toString());
    });

    // Handle Claude exit
    return new Promise<void>((resolve) => {
      claude.on("close", (code) => {
        this.claudeStdin = null;
        if (this.debug) {
          process.stderr.write(`[DEBUG] Claude exited with code:${code}\n`);
        }
        // Don't send "done" on normal exit - user may cancel
        resolve();
      });

      claude.on("error", (error) => {
        this.claudeStdin = null;
        this.sendMessage({
          type: "error",
          message: `Failed to spawn Claude: ${error.message}`,
          timestamp: new Date().toISOString(),
        });
        resolve();
      });
    });
  }

  /**
   * Parse and handle Claude's stdout
   */
  private handleClaudeOutput(data: string): void {
    const messages = this.parser.parse(data);

    for (const msg of messages) {
      // Ignore system and result messages
      if (msg.type === "system" || msg.type === "result") {
        continue;
      }

      // Forward assistant messages as-is (just add timestamp)
      if (msg.type === "assistant") {
        this.sendMessage({
          timestamp: new Date().toISOString(),
          ...msg,
        });
      }
    }
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
        if (!this.claudeStdin) {
          this.sendMessage({
            type: "error",
            message: "Claude session not active",
            timestamp: new Date().toISOString(),
          });
          return;
        }
        // Forward user input to Claude in stream-json format
        const claudeMessage = JSON.stringify({
          type: "user",
          message: {
            role: "user",
            content: [{ type: "text", text: input.content }]
          }
        }) + "\n";
        this.claudeStdin.write(claudeMessage);

        if (this.debug) {
          process.stderr.write(`[DEBUG] Sent user input to Claude\n`);
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

  /**
   * Detect if message contains a question with options
   */
  private detectQuestion(msg: StreamJSONMessage): DetectedQuestion | null {
    const text = this.extractText(msg);
    if (!text) return null;

    // Detect options like "A)" "B)" "C)" "D)" or "A." "B." etc.
    const optionsMatch = text.match(/[A-D][)\.]\s*([^\n]+)/g);
    if (optionsMatch && optionsMatch.length >= 2) {
      // Split question text from options
      const parts = text.split(/\n\s*[A-D][)\.]/);
      return {
        text: parts[0]?.trim() || text,
        options: optionsMatch.map((o) => o.replace(/^[A-D][)\.]\s*/, "")),
      };
    }
    return null;
  }

  /**
   * Extract text content from a StreamJSONMessage
   */
  private extractText(msg: StreamJSONMessage): string | null {
    if (!msg.message?.content) return null;
    for (const block of msg.message.content) {
      if (block.type === "text") {
        return block.text || "";
      }
    }
    return null;
  }

  /**
   * Check if text looks like PRD content
   * PRD typically has markdown headers like "#", "##", etc.
   */
  private isPRDContent(text: string): boolean {
    const trimmed = text.trim();
    // Check for PRD-like markers
    return (
      trimmed.startsWith("#") ||
      trimmed.startsWith("##") ||
      trimmed.includes("## PRD") ||
      trimmed.includes("# PRD") ||
      /^\s*#+\s*\w/.test(trimmed)
    );
  }
}
