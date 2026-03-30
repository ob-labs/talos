/**
 * PRD Agent Factory
 *
 * Registry for PRD agent implementations:
 *
 * Built-in agents:
 * - `claude`: Claude Code CLI
 * - `cursor`: Cursor Agent (`cursor-agent` CLI)
 * - `qoder`: Qoder CLI (`qodercli`)
 */

import type { PrdAgent } from "./agents/PrdAgent";
import { ClaudePrdAgent } from "./agents/ClaudePrdAgent";
import { CursorPrdAgent } from "./agents/CursorPrdAgent";
import { QoderPrdAgent } from "./agents/QoderPrdAgent";

const DEFAULT_TOOL = "claude";

export class PrdAgentFactory {
  private creators: Map<string, () => PrdAgent>;

  static readonly TOOL_DISPLAY_NAMES: Record<string, string> = {
    claude: "Claude Code",
    cursor: "Cursor Agent",
    qoder: "Qoder CLI",
  };

  constructor() {
    this.creators = new Map();

    this.register("claude", () => new ClaudePrdAgent());
    this.register("cursor", () => new CursorPrdAgent());
    this.register("qoder", () => new QoderPrdAgent());
  }

  private resolveToolName(toolName?: string): string {
    const t = toolName?.trim().toLowerCase() ?? "";
    return t.length > 0 ? t : DEFAULT_TOOL;
  }

  /**
   * Create a PRD agent instance.
   *
   * @param toolName - Tool id (`claude`, `cursor`, `qoder`). Empty / omitted defaults to `claude`.
   * @throws {Error} If the tool is not registered
   */
  create(toolName?: string): PrdAgent {
    const key = this.resolveToolName(toolName);
    const factory = this.creators.get(key);

    if (!factory) {
      throw new Error(
        `Unsupported PRD tool: "${toolName ?? ""}". Supported tools: ${this.listAvailable().join(", ")}`
      );
    }

    return factory();
  }

  /**
   * Register or override a PRD agent type.
   *
   * @param toolName - Name under which the agent is created (normalized to lowercase)
   * @param agentFactory - Factory function that returns a new agent instance
   */
  register(toolName: string, agentFactory: () => PrdAgent): void {
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
    return PrdAgentFactory.TOOL_DISPLAY_NAMES[key] ?? key;
  }
}
