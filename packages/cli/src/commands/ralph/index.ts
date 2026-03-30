#!/usr/bin/env node
/**
 * talos ralph command (headless mode)
 *
 * Convert markdown PRDs from tasks/ directory to JSON format in ralph/ directory
 * Call ralph-converter.md prompt via Claude Code headless mode
 */

import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { GitRepository } from '@talos/git';
import { WorkspaceRepository } from '@talos/core';
import { Command } from 'commander';

// Import utility functions
import {
  getRalphDirectoryPath,
  ensureRalphDirectories,
  Spinner,
} from './utils';
import type { RalphAgent } from './agents/RalphAgent';
import { RalphAgentFactory } from './RalphAgentFactory';

// ESM __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface RalphOptions {
  prd?: string[];
  force?: boolean;
  tool?: string;
  model?: string;
  workspace?: string;
}

export type { RalphToolContext, RalphAgent } from './agents/RalphAgent.js';

function createRalphAgentOrExit(tool?: string): RalphAgent {
  const factory = new RalphAgentFactory();
  try {
    return factory.create(tool);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`❌ ${msg}`);
    process.exit(1);
  }
}

/**
 * ralph command main function (headless mode)
 *
 * Convert markdown PRDs from tasks/ directory to JSON format in ralph/ directory
 * Call ralph-converter.md prompt via Claude Code headless mode
 */
export async function ralphCommand(options: RalphOptions = {}): Promise<void> {
  const workspaceRepo = new WorkspaceRepository();
  let projectRoot: string;

  if (options.workspace) {
    // Use provided workspace name
    const workspace = await workspaceRepo.findByName(options.workspace);
    if (!workspace) {
      console.error(`❌ Error: Workspace configuration not found (name: ${options.workspace})`);
      console.error("Error: Workspace config not found");
      process.exit(1);
    }
    projectRoot = workspace.path;
  } else {
    // Auto-detect workspace from current directory
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
    const workspace = await workspaceRepo.findByName(repoName);

    if (!workspace) {
      console.error(`❌ Error: Workspace configuration not found (repoName: ${repoName})`);
      console.error("Error: Workspace config not found");
      process.exit(1);
    }

    projectRoot = workspace.path;
  }

  // Check if PRD files are provided
  if (!options.prd || options.prd.length === 0) {
    console.error('❌ Error: PRD files are required');
    console.error("Error: PRD files are required");
    console.error('');
    console.error('Usage:');
    console.error('  talos ralph --prd <prd-file.md>           # Convert single PRD');
    console.error('  talos ralph --prd prd-*.md              # Support wildcards');
    console.error('');
    console.error('Examples:');
    console.error('  talos ralph --prd cli-enhancement');
    console.error('  talos ralph --prd prd-*.md              # Merge multiple PRDs');
    console.error('');
    console.error('Tip: PRD files are located in tasks/ directory, e.g., tasks/prd-cli-enhancement.md');
    process.exit(1);
  }

  // Determine PRD identifier to convert
  let identifier: string;

  if (options.prd.length === 1 && !options.prd[0].includes('*')) {
    // Single PRD, extract identifier from filename
    const fileName = options.prd[0].replace(/^prd-/, '').replace(/\.md$/, '');
    identifier = fileName;
  } else {
    // Multiple PRDs or using wildcard, use timestamp
    const timestamp = (() => {
      const d = new Date();
      const y = String(d.getFullYear());
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      return `${y}${m}${day}-${h}${min}`;
    })();
    identifier = timestamp;
  }

  // Build PRD file path
  const prdPath = join(projectRoot, 'tasks', `prd-${identifier}.md`);

  // Check if PRD file exists
  if (!existsSync(prdPath)) {
    console.error(`❌ Error: PRD file not found: tasks/prd-${identifier}.md`);
    console.error("Error: PRD file not found");
    process.exit(1);
  }

  // Read PRD content
  const prdContent = readFileSync(prdPath, 'utf-8');

  // Create Ralph directory
  const ralphDir = getRalphDirectoryPath(projectRoot, identifier);
  ensureRalphDirectories(ralphDir);

  const prdJsonPath = join(ralphDir, 'prd.json');
  const relativePrdJsonPath = join('ralph', identifier, 'prd.json');

  console.log(`📋 PRD Conversion`);
  console.log(`   Input: tasks/prd-${identifier}.md`);
  console.log(`   Output: ${relativePrdJsonPath}`);
  console.log('');

  // Read system prompt
  const assetsDir = join(__dirname, 'assets');
  const systemPromptPath = join(assetsDir, 'ralph-converter.md');

  const systemPrompt = readFileSync(systemPromptPath, 'utf-8');

  // Build user message
  const userMessage = `Please convert the following PRD to Ralph format prd.json:

\`\`\`
${prdContent}
\`\`\`

**Directory Structure**

Please create complete directory structure: ralph/${identifier}/

**File Path Requirements**

Please save prd.json to (relative path): ${relativePrdJsonPath}

**Notes**:

- Do not create progress.txt file
- Each user story must include "Typecheck passes" as acceptance criteria
- UI-related stories need to include "Verify in browser using dev-browser skill"
- All story passes fields should initially be false
- Stories ordered by dependency (schema -> backend -> UI)
`;

  // Build task content
  const taskContent = `${systemPrompt}\n\n---\n\n${userMessage}`;

  const agent = createRalphAgentOrExit(options.tool);

  const spinner = new Spinner(`${agent.displayName} is converting your PRD...`);
  spinner.start();

  await agent.run({
    projectRoot,
    taskContent,
    model: options.model,
    spinner,
    identifier,
    ralphDir,
  });
}

/**
 * Create ralph command
 */
export function createRalphCommand() {
  const cmd = new Command('ralph')
    .description('Convert markdown PRDs from tasks/ directory to JSON format in ralph/ directory')
    .option('--prd <prdFiles...>', 'PRD file name (without prd- prefix and .md suffix, supports multiple or wildcards)')
    .option('--force', 'Skip confirmation')
    .action(async (options: RalphOptions) => {
      return ralphCommand(options);
    });

  return cmd;
}
