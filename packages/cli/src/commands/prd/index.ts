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

// ESM __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Detect and return workspace info
 */
export async function detectWorkspace(): Promise<{ path: string; name: string }> {
  const cwd = process.cwd();
  const git = new GitRepository(cwd);
  const repoNameResult = await git.getRepoName();

  if (!repoNameResult.success || !repoNameResult.data) {
    throw new Error(`Cannot get repository name: ${repoNameResult.error}`);
  }

  const repoName = repoNameResult.data;

  // Get workspace configuration via repository name (workspace.path is the accurate repoRoot)
  const workspaceRepo = new WorkspaceRepository();
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
 * prd command main function (interactive mode)
 */
export async function prdCommand(): Promise<void> {
  const { path: repoRoot } = await detectWorkspace();
  ensureTasksDir(repoRoot);

  const systemPrompt = loadSystemPrompt();
  const taskContent = buildTaskContent(systemPrompt);

  // Start Claude Code conversation
  const { spawn } = await import("child_process");

  console.log("Starting Claude Code PRD generator...");
  console.log("");

  const claudeProcess = spawn(
    "claude",
    ["--", taskContent],
    {
      cwd: repoRoot,
      stdio: "inherit",
    }
  );

  // Wait for Claude Code to complete and return exit code
  return new Promise((resolve, reject) => {
    claudeProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error(`\nClaude Code exited with code: ${code ?? 1}`);
        process.exit(code ?? 1);
      }
    });

    claudeProcess.on("error", (error) => {
      console.error(ErrorMessages.UNKNOWN_ERROR(error));
      reject(error);
    });
  });
}

/**
 * prd command in stream mode (stdio JSON protocol)
 */
export async function prdStreamCommand(): Promise<void> {
  const { path: repoRoot } = await detectWorkspace();
  ensureTasksDir(repoRoot);

  const systemPrompt = loadSystemPrompt();
  const taskContent = buildTaskContent(systemPrompt);

  const { PrdStreamHandler } = await import("./stream.js");
  const handler = new PrdStreamHandler();
  await handler.start(repoRoot, taskContent);
}
