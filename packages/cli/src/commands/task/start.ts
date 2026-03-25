import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import readline from "readline";
import { TalosClient } from "@/client/TalosClient";
import { GitRepository } from "@talos/git";
import { WorkspaceRepository } from "@talos/core";

export interface TaskStartOptions { prd?: string; tool?: string; debug?: boolean; model?: string; workspace?: string; }

/**
 * Simple arrow key selector for PRD selection
 */
function selectPRD(prds: Array<{ name: string; description: string }>): Promise<string | undefined> {
  return new Promise((resolve) => {
    let selectedIndex = 0;

    const render = () => {
      // Clear screen and redraw
      readline.cursorTo(process.stdout, 0, 0);
      readline.clearScreenDown(process.stdout);

      console.log('Select PRD to start:\n');

      prds.forEach((prd, index) => {
        const prefix = index === selectedIndex ? '❯ ' : '  ';
        const suffix = index === selectedIndex ? '\x1b[4m' : ''; // underline
        const reset = '\x1b[0m';
        console.log(`${prefix}${suffix}${prd.name} - ${prd.description}${reset}`);
      });

      console.log('\n(Use ↑/↓ arrows, Enter to select, Ctrl+C to cancel)');
    };

    // Handle keyboard input
    const stdin = process.stdin;

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    render();

    const onData = (key: string) => {
      if (key === '\u001B\u005B\u0041') { // Up arrow
        selectedIndex = (selectedIndex - 1 + prds.length) % prds.length;
        render();
      } else if (key === '\u001B\u005B\u0042') { // Down arrow
        selectedIndex = (selectedIndex + 1) % prds.length;
        render();
      } else if (key === '\r' || key === '\n') { // Enter
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        console.log(`\n✓ Selected: ${prds[selectedIndex].name}\n`);
        resolve(prds[selectedIndex].name);
      } else if (key === '\u0003') { // Ctrl+C
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        console.log('\nNo PRD selected');
        resolve(undefined);
      }
    };

    stdin.on('data', onData);
  });
}

export async function startTaskCommand(options: TaskStartOptions): Promise<void> {
  const workspaceRepo = new WorkspaceRepository();
  let repoRoot: string;

  if (options.workspace) {
    // Use provided workspace name
    const workspace = await workspaceRepo.findByName(options.workspace);
    if (!workspace) {
      console.error(`❌ Workspace configuration not found (name: ${options.workspace})`);
      process.exit(1);
    }
    repoRoot = workspace.path;
  } else {
    // Auto-detect workspace from current directory
    const cwd = process.cwd();
    const git = new GitRepository(cwd);
    const repoNameResult = await git.getRepoName();

    if (!repoNameResult.success || !repoNameResult.data) {
      console.error(`❌ Failed to get repository name: ${repoNameResult.error}`);
      process.exit(1);
    }

    const repoName = repoNameResult.data;

    // Get workspace configuration via repository name (workspace.path is the accurate repoRoot)
    const workspace = await workspaceRepo.findByName(repoName);

    if (!workspace) {
      console.error(`❌ Workspace configuration not found (repoName: ${repoName})`);
      process.exit(1);
    }

    repoRoot = workspace.path;
  }

  let prdName: string;
  if (options.prd) {
    // User specified PRD via --prd option, use it directly
    prdName = options.prd;
  } else {
    // No PRD specified, show interactive selection
    const prdDir = join(repoRoot, "ralph");
    const prds = existsSync(prdDir) ? readdirSync(prdDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => {
        try {
          const prd = JSON.parse(readFileSync(join(prdDir, e.name, "prd.json"), "utf-8"));
          return { name: e.name, description: prd.description || "" };
        } catch { return null; }
      })
      .filter(Boolean) : [];
    if (prds.length === 0) {
      console.error("No PRD files found\nHint: PRD files should be located in ralph/ directory");
      process.exit(1);
    }

    const selected = await selectPRD(prds);
    if (!selected) {
      return;
    }
    prdName = selected;
  }

  const prdPath = join(repoRoot, "ralph", prdName, "prd.json");
  if (!existsSync(prdPath)) { console.error(`✗ PRD file does not exist: ${prdPath}`); process.exit(1); }

  const client = new TalosClient();
  try {
    await client.connect();
  } catch {
    console.error(`✗ Cannot connect to Talos daemon\nPlease run first: talos start`);
    process.exit(1);
  }

  const tool = options.tool ? ['claude', 'cursor'].includes(options.tool.toLowerCase()) ? options.tool.toLowerCase() : (console.error(`✗ Invalid tool value: "${options.tool}"\nSupported tools: claude, cursor`), process.exit(1)) : undefined;

  try {
    const task = await client.startTask({
      prdId: prdName,
      workingDir: repoRoot,
      options: { debug: options.debug, tool, model: options.model },
    });
    const prdId = task.prd.id;
    console.log(`✓ Task started\n  Task ID: ${task.id}\n  PRD: ${prdId}\n  Log file: ${join(repoRoot, ".talos", "logs", `${task.id}.log`)}\n\nStop task:\n  • talos task stop ${task.id}`);
  } catch (error) {
    console.error(`✗ Start failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}
