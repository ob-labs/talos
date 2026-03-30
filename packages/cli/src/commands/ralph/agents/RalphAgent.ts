import type { Spinner } from "../utils.js";

/**
 * Context passed to each Ralph tool agent for headless PRD conversion.
 */
export interface RalphToolContext {
  projectRoot: string;
  taskContent: string;
  model?: string;
  spinner: Spinner;
  identifier: string;
  ralphDir: string;
}

/**
 * Contract for Ralph conversion tool implementations (Claude Code, Cursor Agent, etc.).
 */
export interface RalphAgent {
  readonly displayName: string;
  run(ctx: RalphToolContext): Promise<void>;
}
