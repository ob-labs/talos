import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import matter from "gray-matter";
import { PACKAGE_DIR } from "./paths.js";

interface SkillEntry {
  name: string;
  source: string;
  installName?: string;
}

interface McpEntry {
  name: string;
  transport: string;
  command: string;
  args: string[];
}

interface PluginEntry {
  ref: string;
}

interface McpManifest {
  mcp: McpEntry[];
  plugins: PluginEntry[];
}

function loadWorkflow(workflowDir: string): { name: string; content: string } {
  const mdPath = join(workflowDir, "workflow.md");
  const raw = readFileSync(mdPath, "utf-8");
  const { data, content } = matter(raw);

  const name = (data as any).name || dirname(workflowDir).split("/").pop() || "workflow";

  return { name, content };
}

function loadSkills(workflowDir: string): SkillEntry[] {
  const jsonPath = join(workflowDir, "skills.json");
  return JSON.parse(readFileSync(jsonPath, "utf-8")).skills;
}

function loadMcp(workflowDir: string): McpManifest {
  const jsonPath = join(workflowDir, "mcp.json");
  return JSON.parse(readFileSync(jsonPath, "utf-8"));
}

// --- Sync steps ---

function syncAgents(target: string, workflowDir: string) {
  const agentsDir = join(workflowDir, "agents");
  const targetAgents = join(target, ".claude", "agents");
  mkdirSync(targetAgents, { recursive: true });

  if (!existsSync(agentsDir)) return;

  for (const file of readdirSync(agentsDir)) {
    if (!file.endsWith(".md")) continue;
    copyFileSync(join(agentsDir, file), join(targetAgents, file));
    console.log(`  synced agent: ${file}`);
  }
}

function installMcp(target: string, manifest: McpManifest) {
  for (const mcp of manifest.mcp || []) {
    const argsStr = mcp.args.map((a) => `'${a}'`).join(" ");
    const cmd = `claude mcp add --transport ${mcp.transport} -s project ${mcp.name} -- ${mcp.command} ${argsStr}`;
    try {
      execSync(cmd, { cwd: target, stdio: "pipe" });
      console.log(`  installed MCP: ${mcp.name}`);
    } catch {
      console.log(`  claude mcp add failed, writing to settings.json: ${mcp.name}`);
      writeMcpToSettings(target, mcp);
    }
  }

  for (const plugin of manifest.plugins || []) {
    try {
      execSync(`claude plugin install ${plugin.ref}`, { cwd: target, stdio: "pipe" });
      console.log(`  installed plugin: ${plugin.ref}`);
    } catch (e: any) {
      console.warn(`  WARNING: failed to install plugin ${plugin.ref}: ${e.message?.trim()}`);
    }
  }
}

function writeMcpToSettings(target: string, mcp: McpEntry) {
  const settingsPath = join(target, ".claude", "settings.json");
  mkdirSync(join(target, ".claude"), { recursive: true });

  let settings: any = {};
  if (existsSync(settingsPath)) {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
  }

  settings.mcpServers = settings.mcpServers || {};
  settings.mcpServers[mcp.name] = {
    command: mcp.command,
    args: mcp.args,
  };

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  console.log(`  wrote MCP to settings.json: ${mcp.name}`);
}


async function installSkills(target: string, allSkills: SkillEntry[]) {
  if (allSkills.length === 0) return;

  console.log("  installing skills from registry...");
  const targetSkills = join(target, ".claude", "skills");

  for (const entry of allSkills) {
    const name = entry.name;

    const installName = entry.installName || entry.name;
    const url = `https://skills.sh/api/download/${entry.source}/${installName}`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as { files: { path: string; contents: string }[]; hash: string };

      if (!data.files) throw new Error("no files in response");

      const skillDir = join(targetSkills, name);
      mkdirSync(skillDir, { recursive: true });

      for (const file of data.files) {
        const filePath = join(skillDir, file.path);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, file.contents);
      }

      console.log(`    installed skill: ${name} (${data.hash.slice(0, 8)}...)`);
    } catch (e) {
      console.warn(`    WARNING: failed to install ${name}: ${e}`);
    }
  }
}

function syncWorkflowMd(target: string, workflowName: string, workflowDir: string) {
  const src = join(workflowDir, "workflow.md");
  const dest = join(target, ".workflows", workflowName, "workflow.md");
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`  wrote .workflows/${workflowName}/workflow.md`);
}

function syncGlobalSkills(target: string) {
  const globalSkillsDir = join(PACKAGE_DIR, "skills");
  if (!existsSync(globalSkillsDir)) return;

  for (const skillName of readdirSync(globalSkillsDir, { withFileTypes: true })) {
    if (!skillName.isDirectory()) continue;
    const src = join(globalSkillsDir, skillName.name);
    const dest = join(target, ".claude", "skills", skillName.name);
    cpSync(src, dest, { recursive: true });
    console.log(`  synced builtin skill: ${skillName.name}`);
  }
}

// --- Main export ---

export async function sync(workflowName: string, workflowDir: string, target: string) {
  console.log(`\nInstalling workflow "${workflowName}"\n`);

  const wf = loadWorkflow(workflowDir);
  const skills = loadSkills(workflowDir);
  const mcp = loadMcp(workflowDir);

  const totalSteps = 4;
  const step = (n: number, label: string) => `[${n}/${totalSteps}] ${label}`;

  console.log(step(1, "Syncing agents..."));
  syncAgents(target, workflowDir);

  console.log(step(2, "Installing skills..."));
  await installSkills(target, skills);

  console.log(step(3, "Installing MCP..."));
  installMcp(target, mcp);

  console.log(step(4, "Finalizing..."));
  syncWorkflowMd(target, workflowName, workflowDir);
  syncGlobalSkills(target);

  console.log(`\nDone! Run /workflow ${wf.name} in Claude Code to start.\n`);
}
