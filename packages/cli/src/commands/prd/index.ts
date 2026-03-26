#!/usr/bin/env node
/**
 * talos prd command
 * Create PRD through Claude Code conversation
 */

import { fileURLToPath } from 'url';
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { ErrorMessages } from "@/utils/errors.js";
import { GitRepository } from '@talos/git';
import { WorkspaceRepository } from '@talos/core';
import { PrdSessionManager } from "./session-manager.js";

// ESM __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Detect and return workspace info
 * @param workspaceName - Optional workspace name to use instead of auto-detection
 */
export async function detectWorkspace(workspaceName?: string): Promise<{ path: string; name: string }> {
  const workspaceRepo = new WorkspaceRepository();

  if (workspaceName) {
    // Use provided workspace name
    const workspace = await workspaceRepo.findByName(workspaceName);
    if (!workspace) {
      throw new Error(`Workspace configuration not found (name: ${workspaceName})`);
    }
    return { path: workspace.path, name: workspace.name };
  }

  // Auto-detect workspace from current directory
  const cwd = process.cwd();
  const git = new GitRepository(cwd);
  const repoNameResult = await git.getRepoName();

  if (!repoNameResult.success || !repoNameResult.data) {
    throw new Error(`Cannot get repository name: ${repoNameResult.error}`);
  }

  const repoName = repoNameResult.data;

  // Get workspace configuration via repository name (workspace.path is the accurate repoRoot)
  const workspace = await workspaceRepo.findByName(repoName);

  if (!workspace) {
    throw new Error(`Workspace configuration not found (repoName: ${repoName})`);
  }

  return { path: workspace.path, name: repoName };
}

/**
 * Load the PRD generator system prompt
 */
export function loadSystemPrompt(): string {
  // Note: After bundling, all code is in dist/index.js, so __dirname points to dist/
  // Assets are in dist/assets/ after build
  const assetsDir = join(__dirname, "assets");
  const systemPromptPath = join(assetsDir, "prd-generator.md");

  try {
    return readFileSync(systemPromptPath, "utf-8");
  } catch (error) {
    throw new Error(
      `Cannot read system prompt file\n\nFile path: ${systemPromptPath}\n\n${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Build the task content for Claude Code
 */
export function buildTaskContent(systemPrompt: string): string {
  const userMessage = `Please help me create a PRD.

I will describe my requirements in the conversation. Please follow the PRD Generator process in the system prompt:
1. Ask 3-5 key clarification questions (with options A/B/C/D)
2. Generate a structured PRD based on my answers
3. Save the PRD to tasks/prd-[feature-name].md

Let's start!`;

  return `${systemPrompt}\n\n---\n\n${userMessage}`;
}

/**
 * Ensure tasks directory exists
 */
export function ensureTasksDir(repoRoot: string): string {
  const tasksDir = join(repoRoot, "tasks");
  mkdirSync(tasksDir, { recursive: true });
  return tasksDir;
}

/**
 * Options passed to each tool strategy
 */
export interface PrdToolOptions {
  repoRoot: string;
  taskContent: string;
  model?: string;
}

/**
 * Strategy interface for interactive PRD tool execution
 */
export interface PrdToolStrategy {
  displayName: string;
  run(options: PrdToolOptions): Promise<void>;
}

/**
 * Claude Code strategy
 */
const claudeStrategy: PrdToolStrategy = {
  displayName: "Claude Code",
  async run({ repoRoot, taskContent, model }) {
    const { spawn } = await import("child_process");
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
  },
};

/**
 * Cursor Agent strategy
 */
const cursorStrategy: PrdToolStrategy = {
  displayName: "Cursor Agent",
  async run({ repoRoot, taskContent, model }) {
    const { spawn } = await import("child_process");

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
  },
};

/**
 * Registry of all supported PRD tool strategies.
 * Add new tools here without touching prdCommand.
 */
const PRD_TOOL_STRATEGIES: Record<string, PrdToolStrategy> = {
  claude: claudeStrategy,
  cursor: cursorStrategy,
};

export interface PrdCommandOptions {
  workspace?: string;
  tool?: string;
  model?: string;
  session?: string;
  list?: boolean;
  delete?: string;
}

/**
 * List all PRD sessions
 */
export async function listSessions(): Promise<void> {
  const sessionManager = new PrdSessionManager();
  const sessions = sessionManager.listSessions();

  if (sessions.length === 0) {
    console.log("No PRD sessions found.");
    return;
  }

  console.log("PRD Sessions:");
  console.log("");

  for (const session of sessions) {
    const createdDate = new Date(session.createdAt);
    const lastUsedDate = new Date(session.lastUsedAt);
    const workspaceName = session.workspacePath.split("/").pop() || session.workspacePath;

    console.log(`  Session ID: ${session.prdSessionId}`);
    console.log(`  Workspace:  ${workspaceName} (${session.workspacePath})`);
    console.log(`  Created:    ${createdDate.toLocaleString()}`);
    console.log(`  Last Used:  ${lastUsedDate.toLocaleString()}`);
    console.log("");
  }
}

/**
 * Delete a PRD session
 */
export async function deleteSession(prdSessionId: string): Promise<void> {
  const sessionManager = new PrdSessionManager();
  const deleted = sessionManager.deleteSession(prdSessionId);

  if (deleted) {
    console.log(`Session ${prdSessionId} deleted.`);
  } else {
    console.error(`Session ${prdSessionId} not found.`);
    process.exit(1);
  }
}

/**
 * Resume a PRD session
 */
export async function resumeSession(prdSessionId: string, options: PrdCommandOptions = {}): Promise<void> {
  const sessionManager = new PrdSessionManager();
  const session = sessionManager.getSession(prdSessionId);

  if (!session) {
    console.error(`Session ${prdSessionId} not found.`);
    console.log(`Use --list to see all available sessions.`);
    process.exit(1);
  }

  // Verify workspace matches
  const { path: currentWorkspace } = await detectWorkspace();
  if (session.workspacePath !== currentWorkspace) {
    console.error(`Workspace mismatch.`);
    console.error(`Session workspace: ${session.workspacePath}`);
    console.error(`Current workspace: ${currentWorkspace}`);
    console.log(`\nNavigate to the correct workspace and try again.`);
    process.exit(1);
  }

  // Update last used time
  sessionManager.updateLastUsed(prdSessionId);

  const systemPrompt = loadSystemPrompt();
  const taskContent = buildTaskContent(systemPrompt);

  const toolName = options.tool || "claude";
  const strategy = PRD_TOOL_STRATEGIES[toolName];

  if (!strategy) {
    const supported = Object.keys(PRD_TOOL_STRATEGIES).join(", ");
    console.error(`✗ Unsupported tool: "${toolName}". Supported tools: ${supported}`);
    process.exit(1);
  }

  console.log(`Resuming PRD session: ${prdSessionId}`);
  console.log(`Using ${strategy.displayName}...`);
  console.log("");

  // For resume, we use the native tool's resume mechanism
  const { spawn } = await import("child_process");
  const args: string[] = [];

  if (toolName === "claude") {
    args.push("--resume", prdSessionId);
  } else if (toolName === "cursor") {
    // cursor-agent doesn't have resume, start new session
    args.push("--workspace", session.workspacePath);
    if (options.model) args.push("--model", options.model);
    args.push("--", taskContent);
  }

  const proc = spawn(
    toolName === "claude" ? "claude" : "cursor-agent",
    args,
    { cwd: session.workspacePath, stdio: "inherit" }
  );

  return new Promise((resolve, reject) => {
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const toolDisplayName = strategy.displayName;
        console.error(`\n${toolDisplayName} exited with code: ${code ?? 1}`);
        process.exit(code ?? 1);
      }
    });
    proc.on("error", (error) => {
      console.error(ErrorMessages.UNKNOWN_ERROR(error));
      reject(error);
    });
  });
}

/**
 * prd command main function (interactive mode)
 */
export async function prdCommand(options: PrdCommandOptions = {}): Promise<void> {
  // Handle --list option
  if (options.list) {
    return listSessions();
  }

  // Handle --delete option
  if (options.delete) {
    return deleteSession(options.delete);
  }

  // Handle --session option (resume)
  if (options.session) {
    return resumeSession(options.session, options);
  }

  // Create new session
  const { path: repoRoot } = await detectWorkspace(options.workspace);
  ensureTasksDir(repoRoot);

  const sessionManager = new PrdSessionManager();
  const session = sessionManager.createSession(repoRoot);

  const systemPrompt = loadSystemPrompt();
  const taskContent = buildTaskContent(systemPrompt);

  const toolName = options.tool || "claude";
  const strategy = PRD_TOOL_STRATEGIES[toolName];

  if (!strategy) {
    const supported = Object.keys(PRD_TOOL_STRATEGIES).join(", ");
    console.error(`✗ Unsupported tool: "${toolName}". Supported tools: ${supported}`);
    process.exit(1);
  }

  console.log(`Starting ${strategy.displayName} PRD generator...`);
  console.log("");
  console.log(`Session ID: ${session.prdSessionId}`);
  console.log(`To resume this session later, use: talos prd --session ${session.prdSessionId}`);
  console.log("");

  await strategy.run({ repoRoot, taskContent, model: options.model });

  // Update last used time on exit
  sessionManager.updateLastUsed(session.prdSessionId);
}

/**
 * Build task prompt for resumed sessions
 */
function buildTaskPromptForResume(systemPrompt: string): string {
  // For resumed sessions, use a minimal prompt that references the system prompt
  return `${systemPrompt}\n\n(Continuing previous PRD discussion. Use "continue" to proceed.)`;
}

/**
 * Resume a PRD stream session
 * prdSessionId is used directly as Claude's session ID
 */
async function resumeStreamSession(prdSessionId: string, options: PrdCommandOptions = {}): Promise<void> {
  const { path: currentWorkspace } = await detectWorkspace();

  const systemPrompt = loadSystemPrompt();
  const taskContent = buildTaskPromptForResume(systemPrompt);

  const { PrdStreamHandler } = await import("./stream.js");
  const handler = new PrdStreamHandler();

  // Resume with prdSessionId (used directly as Claude session ID)
  await handler.resume(prdSessionId, taskContent, options);
}

/**
 * prd command in stream mode (stdio JSON protocol)
 */
export async function prdStreamCommand(options: PrdCommandOptions = {}): Promise<void> {
  // Handle --session option (resume)
  if (options.session) {
    return resumeStreamSession(options.session, options);
  }

  const { path: repoRoot } = await detectWorkspace(options.workspace);
  ensureTasksDir(repoRoot);

  const systemPrompt = loadSystemPrompt();
  const taskContent = buildTaskContent(systemPrompt);

  const { PrdStreamHandler } = await import("./stream.js");
  const handler = new PrdStreamHandler();
  await handler.start(repoRoot, taskContent, options);
}
