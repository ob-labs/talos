#!/usr/bin/env node
/**
 * talos prd command
 * Create PRD through Claude Code conversation
 */

import { fileURLToPath } from 'url';
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { GitRepository } from '@talos/git';
import { WorkspaceRepository } from '@talos/core';
import type { PrdAgent } from "./agents/PrdAgent.js";
import { PrdSessionManager } from "./session-manager.js";
import { PrdAgentFactory } from "./PrdAgentFactory.js";

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

function createPrdAgentOrExit(tool?: string): { factory: PrdAgentFactory; agent: PrdAgent } {
  const factory = new PrdAgentFactory();
  try {
    return { factory, agent: factory.create(tool) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`✗ ${msg}`);
    process.exit(1);
  }
}

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
  const { agent } = createPrdAgentOrExit(options.tool);
  await agent.resume(prdSessionId, { model: options.model });
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

  const { factory, agent } = createPrdAgentOrExit(options.tool);

  console.log(`Starting ${factory.getDisplayName(options.tool ?? "")} PRD generator...`);
  console.log("");
  console.log(`Session ID: ${session.prdSessionId}`);
  console.log(`To resume this session later, use: talos prd --session ${session.prdSessionId}`);
  console.log("");

  await agent.start({
    repoRoot,
    taskContent,
    model: options.model,
    prdSessionId: session.prdSessionId,
  });

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

  const { agent } = createPrdAgentOrExit(options.tool);
  await agent.resumeStream(prdSessionId, taskContent, {
    cwd: currentWorkspace,
    model: options.model,
  });
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

  const { agent } = createPrdAgentOrExit(options.tool);
  await agent.startStream(repoRoot, taskContent, { model: options.model });
}
