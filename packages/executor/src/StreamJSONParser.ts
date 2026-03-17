/**
 * Stream-JSON Parser
 *
 * 解析 Claude Code 的 stream-json 格式输出，并格式化为易读的文本。
 * 支持缓冲机制处理不完整的 JSON 行。
 *
 * Parses Claude Code's stream-json format output and formats it for readability.
 * Supports buffering for incomplete JSON lines.
 */

import type { StreamJSONMessage, StreamJSONContentBlock } from "@talos/types";

/**
 * Parser configuration options
 */
export interface StreamJSONParserOptions {
  /** Include timestamps in formatted output (default: true) */
  includeTimestamps?: boolean;
  /** Use emoji for different message types (default: true) */
  useEmoji?: boolean;
}

/**
 * Default parser options
 */
const DEFAULT_OPTIONS: Required<StreamJSONParserOptions> = {
  includeTimestamps: true,
  useEmoji: true,
};

/**
 * Stream-JSON Parser class
 */
export class StreamJSONParser {
  private options: Required<StreamJSONParserOptions>;
  private buffer: string = "";

  constructor(options: StreamJSONParserOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Parse a chunk of data containing one or more JSON messages
   *
   * @param chunk - Data chunk (may contain partial or multiple JSON lines)
   * @returns Array of parsed messages
   */
  parse(chunk: string): StreamJSONMessage[] {
    const messages: StreamJSONMessage[] = [];

    // Add chunk to buffer
    this.buffer += chunk;

    // Try to parse complete lines
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
        // Not valid JSON, keep in buffer for next chunk
        // (or just skip if it's clearly not JSON)
        if (!trimmed.startsWith("{")) {
          // Not JSON, skip it
          continue;
        }
      }
    }

    return messages;
  }

  /**
   * Format a single message into human-readable text
   *
   * @param message - Stream-JSON message
   * @returns Formatted string (empty if message has no meaningful content)
   */
  formatMessage(message: StreamJSONMessage): string {
    const lines: string[] = [];

    // Add timestamp if enabled
    if (this.options.includeTimestamps) {
      const timestamp = new Date().toISOString();
      lines.push(`[${timestamp}]`);
    }

    // Handle different message types
    switch (message.type) {
      case "assistant":
        if (message.message?.content) {
          for (const block of message.message.content) {
            const formatted = this.formatContentBlock(block);
            if (formatted) {
              lines.push(formatted);
            }
          }
        }
        break;

      case "user":
        lines.push(`${this.emoji("👤")} User message`);
        if (message.message?.content) {
          for (const block of message.message.content) {
            if (block.type === "text") {
              const text = block.text?.trim();
              if (text) {
                lines.push(`  ${text}`);
              }
            }
          }
        }
        break;

      case "tool_result":
        lines.push(`${this.emoji("🔧")} Tool result`);
        break;

      case "result":
        if (message.result?.type === "success") {
          lines.push(`${this.emoji("✅")} Success${message.result.message ? ": " + message.result.message : ""}`);
        }
        break;
    }

    // Return empty string if no meaningful content
    const result = lines.join("\n");
    // If result only contains timestamp, treat as empty
    if (lines.length === 1 && this.options.includeTimestamps) {
      return "";
    }
    return result;
  }

  /**
   * Format a content block into human-readable text
   *
   * @param block - Content block
   * @returns Formatted string (empty if block has no meaningful content)
   */
  private formatContentBlock(block: StreamJSONContentBlock): string {
    switch (block.type) {
      case "thinking":
        const thinking = block.thinking?.trim();
        if (!thinking) return "";
        return `${this.emoji("🤔")} Thinking:\n${this.indent(thinking)}`;

      case "text":
        const text = block.text?.trim();
        if (!text) return "";
        return `${this.emoji("📝")} ${text}`;

      case "tool_use":
        const inputStr = JSON.stringify(block.input, null, 2);
        return `${this.emoji("🔧")} Tool: ${block.name}\n${this.indent(inputStr)}`;

      case "tool_result":
        const content = block.content || "";
        const status = block.is_error ? "(error)" : "";
        return `${this.emoji("📤")} Tool result ${status}\n${this.indent(content)}`;

      default:
        return `[Unknown block type: ${(block as { type: string }).type}]`;
    }
  }

  /**
   * Indent multi-line text
   *
   * @param text - Text to indent
   * @param indent - Indentation string (default: "  ")
   * @returns Indented text
   */
  private indent(text: string, indent: string = "  "): string {
    return text.split("\n").map(line => indent + line).join("\n");
  }

  /**
   * Get emoji if enabled, otherwise empty string
   *
   * @param emoji - Emoji string
   * @returns Emoji or empty string
   */
  private emoji(emoji: string): string {
    return this.options.useEmoji ? emoji : "";
  }

  /**
   * Clear the buffer (useful for reset scenarios)
   */
  clear(): void {
    this.buffer = "";
  }

  /**
   * Get current buffer content (for debugging)
   *
   * @returns Current buffer content
   */
  getBuffer(): string {
    return this.buffer;
  }
}

/**
 * Convenience function to parse and format in one call
 *
 * @param chunk - Data chunk
 * @param options - Parser options
 * @returns Formatted string
 */
export function parseAndFormat(
  chunk: string,
  options?: StreamJSONParserOptions
): string {
  const parser = new StreamJSONParser(options);
  const messages = parser.parse(chunk);
  return messages.map(msg => parser.formatMessage(msg)).join("\n\n");
}
