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
  tool?: string;
  model?: string;
  workspace?: string;
}

/**
 * Context passed to each Ralph tool strategy
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
 * Strategy interface for headless PRD conversion tool execution
 */
export interface RalphToolStrategy {
  displayName: string;
  run(ctx: RalphToolContext): Promise<void>;
}

/**
 * Claude Code strategy (stdin pipe mode)
 */
const claudeRalphStrategy: RalphToolStrategy = {
  displayName: 'Claude Code',
  async run({ projectRoot, taskContent, model, spinner, identifier, ralphDir }) {
    const args = ['--dangerously-skip-permissions', '--print'];
    if (model) args.push('--model', model);

    const env = { ...process.env };
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;

    const proc = spawn('claude', args, {
      cwd: projectRoot,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let hasOutput = false;
    const stopSpinnerAndShow = () => {
      if (!hasOutput) {
        hasOutput = true;
        spinner.stop();
        console.log(`\U0001f916 Claude Code PRD conversion in progress...\n`);
      }
    };

    if (proc.stdin) {
      proc.stdin.write(taskContent);
      proc.stdin.end();
    }
    if (proc.stdout) proc.stdout.on('data', (data) => { stopSpinnerAndShow(); process.stdout.write(data); });
    if (proc.stderr) proc.stderr.on('data', (data) => { stopSpinnerAndShow(); process.stderr.write(data); });

    return new Promise((resolve, reject) => {
      proc.on('close', (code) => {
        spinner.stop();
        if (code === 0) {
          console.log('');
          console.log('\u2705 PRD conversion completed');
          console.log('');
          console.log('\U0001f4cb Usage:');
          console.log(`   cd ${ralphDir}`);
          console.log(`   talos task start --prd ${identifier}`);
          resolve();
        } else {
          console.error(`\n\u274c Claude Code exited with code: ${code ?? 1}`);
          process.exit(code ?? 1);
        }
      });
      proc.on('error', (error) => { spinner.stop(); reject(error); });
    });
  },
};

/**
 * Cursor Agent strategy (temp file + pipe mode)
 */
const cursorRalphStrategy: RalphToolStrategy = {
  displayName: 'Cursor Agent',
  async run({ projectRoot, taskContent, model, spinner, identifier, ralphDir }) {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join: pathJoin } = await import('node:path');

    const tempDir = await mkdtemp(pathJoin(tmpdir(), 'talos-ralph-cursor-'));
    const tempFile = pathJoin(tempDir, 'prompt.txt');
    await writeFile(tempFile, taskContent, 'utf-8');

    const args = ['--print', '--trust', '--force'];
    if (model) args.push('--model', model);

    const shellCommand = `cat "${tempFile}" | cursor-agent ${args.join(' ')}`;

    let hasOutput = false;
    const stopSpinnerAndShow = () => {
      if (!hasOutput) {
        hasOutput = true;
        spinner.stop();
        console.log(`\U0001f916 Cursor Agent PRD conversion in progress...\n`);
      }
    };

    const proc = spawn('sh', ['-c', shellCommand], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (proc.stdout) proc.stdout.on('data', (data) => { stopSpinnerAndShow(); process.stdout.write(data); });
    if (proc.stderr) proc.stderr.on('data', (data) => { stopSpinnerAndShow(); process.stderr.write(data); });

    return new Promise((resolve, reject) => {
      proc.on('close', async (code) => {
        try { await rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
        spinner.stop();
        if (code === 0) {
          console.log('');
          console.log('\u2705 PRD conversion completed');
          console.log('');
          console.log('\U0001f4cb Usage:');
          console.log(`   cd ${ralphDir}`);
          console.log(`   talos task start --prd ${identifier}`);
          resolve();
        } else {
          console.error(`\n\u274c Cursor Agent exited with code: ${code ?? 1}`);
          console.error('Tip: ensure CURSOR_API_KEY is set, or run `cursor-agent login`.');
          process.exit(code ?? 1);
        }
      });
      proc.on('error', async (error) => {
        try { await rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
        spinner.stop();
        reject(error);
      });
    });
  },
};

/**
 * Registry of all supported Ralph tool strategies.
 * Add new tools here without touching ralphCommand.
 */
const RALPH_TOOL_STRATEGIES: Record<string, RalphToolStrategy> = {
  claude: claudeRalphStrategy,
  cursor: cursorRalphStrategy,
};

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

  // Start spinner
  const toolName = options.tool || 'claude';
  const strategy = RALPH_TOOL_STRATEGIES[toolName];

  if (!strategy) {
    const supported = Object.keys(RALPH_TOOL_STRATEGIES).join(', ');
    console.error(`❌ Unsupported tool: "${toolName}". Supported tools: ${supported}`);
    process.exit(1);
  }

  const spinner = new Spinner(`${strategy.displayName} is converting your PRD...`);
  spinner.start();

  await strategy.run({
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
