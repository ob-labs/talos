import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, cpSync, rmSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import matter from "gray-matter";
import { PACKAGE_DIR } from "./paths.js";
import type { Manifest, McpEntry, SkillEntry } from "./types.js";

// --- Unified path resolution & file loading ---

function resolveRef(ref: string, workflowDir: string): string {
  if (ref.startsWith("./")) return join(workflowDir, ref);
  return join(PACKAGE_DIR, ref);
}

function loadFile(ref: string, workflowDir: string): string | null {
  const absPath = resolveRef(ref, workflowDir);
  if (!existsSync(absPath)) {
    console.warn(`  WARNING: file not found: ${ref} (${absPath})`);
    return null;
  }
  return readFileSync(absPath, "utf-8");
}

function loadManifest(workflowDir: string): Manifest {
  const jsonPath = join(workflowDir, "manifest.json");
  return JSON.parse(readFileSync(jsonPath, "utf-8"));
}

function loadWorkflowName(workflowDir: string): string {
  const mdPath = join(workflowDir, "workflow.md");
  const raw = readFileSync(mdPath, "utf-8");
  const { data } = matter(raw);
  return (data as any).name || basename(workflowDir);
}

// --- Install handlers per type ---

function installAgent(target: string, ref: string, workflowDir: string) {
  let absPath = resolveRef(ref, workflowDir);
  // Auto-append .md if no extension
  if (!absPath.endsWith(".md")) absPath += ".md";
  if (!existsSync(absPath)) {
    console.warn(`  WARNING: agent not found: ${ref}`);
    return;
  }
  const destDir = join(target, ".claude", "agents");
  mkdirSync(destDir, { recursive: true });
  const fileName = basename(absPath);
  copyFileSync(absPath, join(destDir, fileName));
  console.log(`  synced agent: ${ref} → ${fileName}`);
}

function isGitSource(source: string): boolean {
  return source.includes("://") || source.startsWith("git@");
}

async function installSkill(target: string, entry: SkillEntry) {
  if (isGitSource(entry.source)) {
    await installSkillFromGit(target, entry);
  } else {
    await installSkillFromRegistry(target, entry);
  }
}

async function installSkillFromGit(target: string, entry: SkillEntry) {
  const tmp = join(tmpdir(), `talos-skill-${Date.now()}`);
  try {
    execSync(`git clone --depth 1 ${entry.source} ${tmp}`, { stdio: "pipe" });
    const srcDir = join(tmp, "skills", entry.name);
    if (!existsSync(srcDir)) throw new Error(`skills/${entry.name} not found in repo`);
    const destDir = join(target, ".claude", "skills", entry.name);
    cpSync(srcDir, destDir, { recursive: true });
    console.log(`  installed skill: ${entry.name} (from ${entry.source})`);
  } catch (e) {
    console.warn(`  WARNING: failed to install skill ${entry.name}: ${e}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function installSkillFromRegistry(target: string, entry: SkillEntry) {
  const installName = entry.installName || entry.name;
  const url = `https://skills.sh/api/download/${entry.source}/${installName}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as { files: { path: string; contents: string }[]; hash: string };
    if (!data.files) throw new Error("no files in response");

    const skillDir = join(target, ".claude", "skills", entry.name);
    mkdirSync(skillDir, { recursive: true });
    for (const file of data.files) {
      const filePath = join(skillDir, file.path);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, file.contents);
    }
    console.log(`  installed skill: ${entry.name} (${data.hash.slice(0, 8)}...)`);
  } catch (e) {
    console.warn(`  WARNING: failed to install skill ${entry.name}: ${e}`);
  }
}

function installMcpEntry(target: string, entry: McpEntry | string, workflowDir: string) {
  let mcp: McpEntry;
  if (typeof entry === "string") {
    const content = loadFile(entry, workflowDir);
    if (!content) return;
    mcp = JSON.parse(content);
  } else {
    mcp = entry;
  }

  const argsStr = mcp.args.map((a) => `'${a}'`).join(" ");
  const cmd = `claude mcp add --transport ${mcp.transport || "stdio"} -s project ${mcp.name} -- ${mcp.command} ${argsStr}`;
  try {
    execSync(cmd, { cwd: target, stdio: "pipe" });
    console.log(`  installed MCP: ${mcp.name}`);
  } catch {
    console.log(`  claude mcp add failed, writing to settings.json: ${mcp.name}`);
    writeMcpToSettings(target, mcp);
  }
}

function installPlugin(target: string, ref: string) {
  try {
    execSync(`claude plugin install ${ref}`, { cwd: target, stdio: "pipe" });
    console.log(`  installed plugin: ${ref}`);
  } catch (e: any) {
    console.warn(`  WARNING: failed to install plugin ${ref}: ${e.message?.trim()}`);
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
  settings.mcpServers[mcp.name] = { command: mcp.command, args: mcp.args };

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}

function syncWorkflowMd(target: string, workflowName: string, workflowDir: string) {
  const dest = join(target, ".workflows", workflowName, "workflow.md");
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(workflowDir, "workflow.md"), dest);
  console.log(`  wrote .workflows/${workflowName}/workflow.md`);
}

function syncBuiltinSkills(target: string) {
  const globalSkillsDir = join(PACKAGE_DIR, "skills");
  if (!existsSync(globalSkillsDir)) return;

  for (const entry of readdirSync(globalSkillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    cpSync(
      join(globalSkillsDir, entry.name),
      join(target, ".claude", "skills", entry.name),
      { recursive: true },
    );
    console.log(`  synced builtin skill: ${entry.name}`);
  }
}

// --- CLAUDE.md memo injection ---

const TALOS_MEMO_SECTION = `<!-- talos-memo-start -->
## Talos Memory

三层记忆系统，在会话开始时读取，为当前任务提供上下文。不存在的文件跳过（首次运行）。

1. \`~/.talos/profile.md\` — 用户偏好（编码风格、协作习惯、工具偏好），≤50 行
2. \`wiki/hot.md\` — 项目热记忆（关键约束、重大坑、强偏好），≤100 行
3. \`wiki/INDEX.md\` — 知识索引，按需深入 \`wiki/<category>/<name>.md\` 页面

完成重要工作后（修 bug、完成功能、架构决策），使用 \`/memorizer\` skill 将有价值的知识写入对应记忆层。只记录非显而易见的知识：架构决策、坑、可复用模式、用户偏好。
<!-- talos-memo-end -->`;

export function injectClaudeMdSection(target: string): void {
  const claudeMdPath = join(target, "CLAUDE.md");

  let content = "";
  if (existsSync(claudeMdPath)) {
    content = readFileSync(claudeMdPath, "utf-8");
  }

  const markerRegex = /<!-- talos-memo-start -->[\s\S]*?<!-- talos-memo-end -->\n*/;
  let newContent: string;

  if (markerRegex.test(content)) {
    newContent = content.replace(markerRegex, TALOS_MEMO_SECTION);
  } else {
    const separator = content.length > 0 && !content.endsWith("\n") ? "\n\n" : "\n";
    newContent = content + separator + TALOS_MEMO_SECTION;
  }

  try {
    writeFileSync(claudeMdPath, newContent, "utf-8");
    console.log("  injected memo reading into CLAUDE.md");
  } catch (e) {
    console.warn(`  WARNING: could not write to CLAUDE.md: ${e}`);
  }
}

// --- Main ---

export async function sync(workflowName: string, workflowDir: string, target: string) {
  console.log(`\nInstalling workflow "${workflowName}"\n`);

  const name = loadWorkflowName(workflowDir);
  const manifest = loadManifest(workflowDir);

  // 1. Agents
  console.log("[1/4] Syncing agents...");
  for (const ref of manifest.agents || []) {
    installAgent(target, ref, workflowDir);
  }

  // 2. Skills
  console.log("[2/4] Installing skills...");
  for (const entry of manifest.skills || []) {
    await installSkill(target, entry);
  }

  // 3. MCP & plugins
  console.log("[3/4] Installing MCP & plugins...");
  for (const entry of manifest.mcp || []) {
    installMcpEntry(target, entry, workflowDir);
  }
  for (const ref of manifest.plugins || []) {
    installPlugin(target, ref);
  }

  // 4. Finalize
  console.log("[4/4] Finalizing...");
  syncWorkflowMd(target, workflowName, workflowDir);
  syncBuiltinSkills(target);
  injectClaudeMdSection(target);

  console.log(`\nDone! Run /workflow ${name} in Claude Code to start.\n`);
}
