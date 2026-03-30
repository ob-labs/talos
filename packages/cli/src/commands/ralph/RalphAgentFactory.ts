/**
 * Factory for Ralph conversion agents (headless PRD → ralph/prd.json).
 *
 * Built-in agents:
 * - `claude`: Claude Code CLI
 * - `cursor`: Cursor Agent (`cursor-agent` CLI)
 * - `qoder`: Qoder CLI (`qodercli`)
 */

import type { RalphAgent } from "./agents/RalphAgent";
import { ClaudeRalphAgent } from "./agents/ClaudeRalphAgent";
import { CursorRalphAgent } from "./agents/CursorRalphAgent";
import { QoderRalphAgent } from "./agents/QoderRalphAgent";

const DEFAULT_TOOL = "claude";

export class RalphAgentFactory {
  private creators: Map<string, () => RalphAgent>;

  static readonly TOOL_DISPLAY_NAMES: Record<string, string> = {
    claude: "Claude Code",
    cursor: "Cursor Agent",
    qoder: "Qoder CLI",
  };

  constructor() {
    this.creators = new Map();

    this.register("claude", () => new ClaudeRalphAgent());
    this.register("cursor", () => new CursorRalphAgent());
    this.register("qoder", () => new QoderRalphAgent());
  }

  private resolveToolName(toolName?: string): string {
    const t = toolName?.trim().toLowerCase() ?? "";
    return t.length > 0 ? t : DEFAULT_TOOL;
  }

  /**
   * @param toolName - Tool id (`claude`, `cursor`). Empty / omitted defaults to `claude`.
   * @throws {Error} If the tool is not registered
   */
  create(toolName?: string): RalphAgent {
    const key = this.resolveToolName(toolName);
    const factory = this.creators.get(key);

    if (!factory) {
      throw new Error(
        `Unsupported Ralph tool: "${toolName ?? ""}". Supported tools: ${this.listAvailable().join(", ")}`
      );
    }

    return factory();
  }

  register(toolName: string, agentFactory: () => RalphAgent): void {
    this.creators.set(toolName.trim().toLowerCase(), agentFactory);
  }

  listAvailable(): string[] {
    return Array.from(this.creators.keys());
  }

  has(toolName: string): boolean {
    return this.creators.has(this.resolveToolName(toolName));
  }

  getDisplayName(toolName: string): string {
    const key = this.resolveToolName(toolName);
    return RalphAgentFactory.TOOL_DISPLAY_NAMES[key] ?? key;
  }
}
