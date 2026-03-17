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
 * prd command main function
 */
export async function prdCommand(): Promise<void> {
  // Get main repository root directory (via GitRepository)
  const cwd = process.cwd();
  const git = new GitRepository(cwd);
  const repoNameResult = await git.getRepoName();

  if (!repoNameResult.success || !repoNameResult.data) {
    console.error('❌ Error: Cannot get repository name');
    console.error(`Error: ${repoNameResult.error}`);
    process.exit(1);
  }

  const repoName = repoNameResult.data;

  // Get workspace configuration via repository name (workspace.path is the accurate repoRoot)
  const workspaceRepo = new WorkspaceRepository();
  const workspace = await workspaceRepo.findByName(repoName);

  if (!workspace) {
    console.error(`❌ Error: Workspace configuration not found (repoName: ${repoName})`);
    console.error("Error: Workspace config not found");
    process.exit(1);
  }

  const repoRoot = workspace.path;

  // 1. Ensure tasks directory exists (in main repository root directory)
  const tasksDir = join(repoRoot, "tasks");
  mkdirSync(tasksDir, { recursive: true });

  // 2. Read system prompt
  // Note: After bundling, all code is in dist/index.js, so __dirname points to dist/
  // Assets are in dist/assets/ after build
  const assetsDir = join(__dirname, "assets");
  const systemPromptPath = join(assetsDir, "prd-generator.md");

  let systemPrompt: string;
  try {
    systemPrompt = readFileSync(systemPromptPath, "utf-8");
  } catch (error) {
    console.error(`Error: Cannot read system prompt file

File path: ${systemPromptPath}

${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // 3. Build user message
  const userMessage = `Please help me create a PRD.

I will describe my requirements in the conversation. Please follow the PRD Generator process in the system prompt:
1. Ask 3-5 key clarification questions (with options A/B/C/D)
2. Generate a structured PRD based on my answers
3. Save the PRD to tasks/prd-[feature-name].md

Let's start!`;

  // 4. Build task content
  const taskContent = `${systemPrompt}\n\n---\n\n${userMessage}`;

  // 5. Start Claude Code conversation
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

  // 6. Wait for Claude Code to complete and return exit code
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
