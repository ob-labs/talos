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
import { spawn } from 'child_process';
import { Command } from 'commander';

// Import utility functions
import {
  getRalphDirectoryPath,
  ensureRalphDirectories,
  Spinner,
} from './utils.js';
import { extractIdentifierFromPath } from './headless-convert.js';

// ESM __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface RalphOptions {
  prd?: string[];
  force?: boolean;
}

/**
 * ralph command main function (headless mode)
 *
 * Convert markdown PRDs from tasks/ directory to JSON format in ralph/ directory
 * Call ralph-converter.md prompt via Claude Code headless mode
 */
export async function ralphCommand(options: RalphOptions = {}): Promise<void> {
  const cwd = process.cwd();

  // Get main repository root directory (via GitRepository)
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

  const projectRoot = workspace.path;

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

  // Start spinner
  const spinner = new Spinner('Claude Code is converting your PRD...');
  spinner.start();

  // Clean environment to avoid nested sessions
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  const claudeProcess = spawn(
    'claude',
    ['--dangerously-skip-permissions', '--print'],
    {
      cwd: projectRoot,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );

  // Track if there's any output
  let hasOutput = false;

  // Pass task content via stdin
  if (claudeProcess.stdin) {
    claudeProcess.stdin.write(taskContent);
    claudeProcess.stdin.end();
  }

  // Stop spinner and show output when data arrives
  const stopSpinnerAndShow = () => {
    if (!hasOutput) {
      hasOutput = true;
      spinner.stop();
      console.log('🤖 Claude Code PRD conversion in progress...\n');
    }
  };

  // Stream Claude Code response in real-time
  if (claudeProcess.stdout) {
    claudeProcess.stdout.on('data', (data) => {
      stopSpinnerAndShow();
      process.stdout.write(data);
    });
  }

  if (claudeProcess.stderr) {
    claudeProcess.stderr.on('data', (data) => {
      stopSpinnerAndShow();
      process.stderr.write(data);
    });
  }

  // Wait for Claude Code to complete
  return new Promise((resolve, reject) => {
    claudeProcess.on('close', (code) => {
      if (code === 0) {
        spinner.stop();
        console.log('');
        console.log('✅ PRD conversion completed');
        console.log('');
        console.log('📋 Usage:');
        console.log(`   cd ${ralphDir}`);
        console.log(`   claude prd.json`);
        resolve();
      } else {
        spinner.stop();
        console.error(`\n❌ Claude Code exited with code: ${code ?? 1}`);
        process.exit(code ?? 1);
      }
    });

    claudeProcess.on('error', (error) => {
      spinner.stop();
      reject(error);
    });
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
