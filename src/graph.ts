import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { esc, truncate, formatDuration } from "./utils.js";
import type { StageNode, AgentExecution } from "./stage-correlator.js";

export const CLAUDE_DIR = join(homedir(), ".claude");

// --- Types ---

export interface ExecutionNode {
  id: string;
  type: "root" | "agent" | "skill" | "mcp" | "builtin" | "parallel-group";
  name: string;
  description?: string;
  duration?: number;
  server?: string;
  children: ExecutionNode[];
  timestamp?: string;
}

// --- Session Resolution ---

export function findSessionFile(sessionId: string): { jsonlPath: string; projectDir: string } | null {
  const projectsDir = join(CLAUDE_DIR, "projects");
  if (!existsSync(projectsDir)) return null;

  for (const dir of readdirSync(projectsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const candidate = join(projectsDir, dir.name, `${sessionId}.jsonl`);
    if (existsSync(candidate)) {
      return { jsonlPath: candidate, projectDir: join(projectsDir, dir.name) };
    }
  }
  return null;
}

export function getSessionTitle(sessionId: string): string {
  const historyPath = join(CLAUDE_DIR, "history.jsonl");
  if (existsSync(historyPath)) {
    const lines = readFileSync(historyPath, "utf-8").split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.sessionId === sessionId && entry.display) {
          return entry.display;
        }
      } catch { /* skip */ }
    }
  }
  return sessionId.slice(0, 8);
}

// --- JSONL Parsing ---

function parseJsonl(jsonlPath: string): any[] {
  const raw = readFileSync(jsonlPath, "utf-8");
  const events: any[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch { /* skip */ }
  }
  return events;
}

const BUILTIN_AGENTS = new Set([
  "Explore", "Plan", "general-purpose", "claude-code-guide", "statusline-setup",
]);

function classifyToolUse(block: any): ExecutionNode | null {
  const name = block.name;
  const id = block.id || Math.random().toString(36).slice(2);
  const input = block.input || {};

  if (name === "Agent") {
    const subType = input.subagent_type || "unknown";
    const isBuiltin = BUILTIN_AGENTS.has(subType);
    return {
      id,
      type: isBuiltin ? "builtin" : "agent",
      name: subType,
      description: input.description || "",
      children: [],
    };
  }

  if (name === "Skill") {
    return {
      id,
      type: "skill",
      name: input.skill || "unknown",
      description: input.args ? String(input.args).slice(0, 100) : undefined,
      children: [],
    };
  }

  if (name.startsWith("mcp__")) {
    const parts = name.replace("mcp__", "").split("__");
    const server = parts[0] || "unknown";
    const tool = parts.slice(1).join("__") || "unknown";
    return {
      id,
      type: "mcp",
      name: tool,
      server,
      children: [],
    };
  }

  return null;
}

export function parseSessionTranscript(jsonlPath: string): { tree: ExecutionNode; resultMap: Map<string, any> } {
  const events = parseJsonl(jsonlPath);

  // Pass 1: build tool_use_id -> result map
  const resultMap = new Map<string, any>();
  for (const event of events) {
    if (event.type !== "user") continue;
    const content = event.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type === "tool_result" && block.tool_use_id) {
        resultMap.set(block.tool_use_id, event);
      }
    }
  }

  // Pass 2: build execution tree
  const root: ExecutionNode = { id: "root", type: "root", name: "coordinator", children: [] };

  for (const event of events) {
    if (event.type !== "assistant") continue;
    const content = event.message?.content;
    if (!content) continue;

    const toolUses = (Array.isArray(content) ? content : []).filter((b: any) => b.type === "tool_use");
    const classified = toolUses.map(classifyToolUse).filter(Boolean) as ExecutionNode[];

    if (classified.length === 0) continue;

    for (const node of classified) {
      const result = resultMap.get(node.id);
      if (result?.toolUseResult) {
        const tur = result.toolUseResult;
        if (tur.totalDurationMs) node.duration = tur.totalDurationMs;
        if (tur.agentType) node.name = tur.agentType;
      }
    }

    if (classified.length === 1) {
      root.children.push(classified[0]);
    } else {
      root.children.push({
        id: `parallel-${root.children.length}`,
        type: "parallel-group",
        name: "parallel",
        children: classified,
      });
    }
  }

  return { tree: root, resultMap };
}

function parseSubagentTree(sessionDir: string, agentId: string): ExecutionNode[] {
  const subagentPath = join(sessionDir, "subagents", `agent-${agentId}.jsonl`);
  if (!existsSync(subagentPath)) return [];

  const events = parseJsonl(subagentPath);
  const children: ExecutionNode[] = [];

  for (const event of events) {
    if (event.type !== "assistant") continue;
    const content = event.message?.content;
    if (!content) continue;

    const toolUses = (Array.isArray(content) ? content : []).filter((b: any) => b.type === "tool_use");
    for (const block of toolUses) {
      const node = classifyToolUse(block);
      if (node) children.push(node);
    }
  }

  return children;
}

export function enrichWithSubagents(tree: ExecutionNode, sessionDir: string, resultMap: Map<string, any>) {
  for (const child of tree.children) {
    if (child.type === "agent" || child.type === "builtin") {
      const result = resultMap.get(child.id);
      const agentId = result?.toolUseResult?.agentId;
      if (agentId) {
        child.children = parseSubagentTree(sessionDir, agentId);
      }
    }
    if (child.type === "parallel-group") {
      enrichWithSubagents(child, sessionDir, resultMap);
    }
  }
}

// --- HTML Generation ---

function countNodes(tree: ExecutionNode): { agents: number; skills: number; mcps: number; builtins: number } {
  let agents = 0, skills = 0, mcps = 0, builtins = 0;
  function walk(node: ExecutionNode) {
    if (node.type === "agent") agents++;
    if (node.type === "skill") skills++;
    if (node.type === "mcp") mcps++;
    if (node.type === "builtin") builtins++;
    for (const c of node.children) walk(c);
  }
  walk(tree);
  return { agents, skills, mcps, builtins };
}

function renderNode(node: ExecutionNode): string {
  if (node.type === "root") {
    const children = node.children.map(renderNode).join("\n");
    return `<div class="node root">
<div class="row"><div class="dot main"></div><span class="badge main">main</span><span class="label"><b>${esc(node.name)}</b></span></div>
${children}
</div>`;
  }

  if (node.type === "parallel-group") {
    const children = node.children.map(renderNode).join("\n");
    return `<div class="parallel"><span class="parallel-tag">PARALLEL</span>${children}</div>`;
  }

  const colorMap: Record<string, string> = { agent: "agent", skill: "skill", mcp: "mcp", builtin: "builtin" };
  const c = colorMap[node.type] || "agent";
  const builtinClass = node.type === "builtin" ? " builtin" : "";

  let label = "";
  if (node.type === "mcp" && node.server) {
    label = `<span class="label srv">${esc(node.server)}</span><span class="sep">&rsaquo;</span><span class="label">${esc(node.name)}</span>`;
  } else {
    label = `<span class="label">${esc(node.name)}</span>`;
  }

  const desc = node.description ? `<span class="desc">${esc(truncate(node.description, 60))}</span>` : "";
  const dur = node.duration ? `<span class="desc">(${formatDuration(node.duration)})</span>` : "";

  const children = node.children.length > 0
    ? "\n" + node.children.map(renderNode).join("\n")
    : "";

  return `<div class="node${builtinClass}"><div class="row"><div class="dot ${c}"></div><span class="badge ${c}">${c === "agent" ? "agent" : c === "skill" ? "skill" : c}</span>${label}${desc}${dur}</div>${children}</div>`;
}

export function generateHtml(tree: ExecutionNode, title: string, sessionId: string): string {
  const counts = countNodes(tree);
  const totalAgents = counts.agents + counts.builtins;
  const date = new Date().toISOString().slice(0, 10);
  const treeHtml = renderNode(tree);

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<title>Talos Workflow - ${esc(title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#0d1117;--surface:#161b22;--surface2:#1c2128;--border:#30363d;
  --text:#e6edf3;--dim:#8b949e;
  --c-main:#f0883e;--c-agent:#58a6ff;--c-skill:#d2a8ff;--c-mcp:#3fb950;--c-builtin:#484f58;
}
body{font-family:'SF Mono',Menlo,Consolas,monospace;background:var(--bg);color:var(--text);padding:36px 24px;line-height:1.5}
.wrap{max-width:880px;margin:0 auto}
h1{font-size:18px;font-weight:600;margin-bottom:3px}
.sub{color:var(--dim);font-size:11px;margin-bottom:4px}
.tag{display:inline-block;background:rgba(63,185,80,.12);color:var(--c-mcp);font-size:9px;padding:2px 7px;border-radius:3px;margin-bottom:16px;font-weight:500}
.toolbar{display:flex;gap:10px;align-items:center;margin-bottom:20px}
.toggle-btn{
  background:var(--surface);border:1px solid var(--border);color:var(--dim);
  font-size:10px;padding:3px 10px;border-radius:4px;cursor:pointer;
  font-family:inherit;transition:all .15s;
}
.toggle-btn:hover{border-color:var(--c-agent);color:var(--c-agent)}
.toggle-btn.active{border-color:var(--c-agent);color:var(--c-agent);background:rgba(88,166,255,.08)}
.toggle-btn .count{
  background:rgba(255,255,255,.06);padding:1px 5px;border-radius:3px;margin-left:4px;
  font-weight:600;
}
.legend{display:flex;gap:16px;font-size:10px;color:var(--dim)}
.legend i{display:inline-block;width:6px;height:6px;border-radius:2px;margin-right:3px;vertical-align:middle}

.tree{font-size:12px;margin-top:16px}
.node{position:relative;padding-left:22px}
.node::before{content:'';position:absolute;left:7px;top:0;bottom:0;width:1px;background:var(--border)}
.node:last-child::before{bottom:calc(100% - 14px)}
.node:only-child::before{display:none}
.root{padding-left:0}.root::before{display:none}.root>.row::before{display:none}.root>.row .dot{width:8px;height:8px}

.node.builtin{display:none}
.node.builtin .dot.agent{background:var(--c-builtin)}
.node.builtin .badge.agent{color:var(--c-builtin);background:rgba(72,79,88,.1)}
.node.builtin .label{color:var(--dim)}
.show-builtin .node.builtin{display:block}

.row{position:relative;display:flex;align-items:center;gap:5px;padding:2px 0;min-height:24px;flex-wrap:nowrap}
.row::before{content:'';position:absolute;left:-14px;top:50%;width:12px;height:1px;background:var(--border)}
.row:hover .label{background:var(--surface2)}

.badge{font-size:8px;padding:1px 4px;border-radius:2px;font-weight:600;letter-spacing:.3px;flex-shrink:0;text-transform:uppercase}
.badge.main{background:rgba(240,136,62,.12);color:var(--c-main)}
.badge.agent{background:rgba(88,166,255,.1);color:var(--c-agent)}
.badge.skill{background:rgba(210,168,255,.1);color:var(--c-skill)}
.badge.mcp{background:rgba(63,185,80,.1);color:var(--c-mcp)}

.dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.dot.main{background:var(--c-main)}.dot.agent{background:var(--c-agent)}
.dot.skill{background:var(--c-skill)}.dot.mcp{background:var(--c-mcp)}

.label{padding:1px 5px;border-radius:3px;white-space:nowrap;font-weight:500}
.label.srv{color:var(--dim);font-weight:400;font-style:italic}
.sep{color:var(--border);font-size:10px;flex-shrink:0}
.desc{color:var(--dim);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px}

.parallel{position:relative;border:1px dashed rgba(88,166,255,.2);border-radius:6px;padding:8px 12px 8px 34px;margin:3px 0 3px 22px}
.parallel::before{display:none}
.parallel>.node{padding-left:0}
.parallel>.node::before{display:none}
.parallel>.node>.row::before{display:none}
.parallel-tag{position:absolute;top:-7px;left:10px;background:var(--bg);padding:0 4px;font-size:8px;color:var(--c-agent)}

.summary{margin-top:24px;display:flex;gap:14px;padding:12px 18px;background:var(--surface);border-radius:6px;border:1px solid var(--border)}
.stat{text-align:center;flex:1}
.stat b{display:block;font-size:20px;font-weight:700}
.stat b.c1{color:var(--c-agent)}.stat b.c2{color:var(--c-skill)}.stat b.c3{color:var(--c-mcp)}
.stat span{font-size:9px;color:var(--dim)}
</style></head>
<body><div class="wrap">

<h1>Talos Workflow : ${esc(title)}</h1>
<p class="sub">session ${esc(sessionId.slice(0, 8))} &mdash; ${date}</p>
<div class="tag">PARSED FROM SESSION TRANSCRIPT</div>

<div class="toolbar">
  <div class="legend">
    <span><i style="background:var(--c-main)"></i>Main</span>
    <span><i style="background:var(--c-agent)"></i>Subagent (${totalAgents})</span>
    <span><i style="background:var(--c-skill)"></i>Skill (${counts.skills})</span>
    <span><i style="background:var(--c-mcp)"></i>MCP (${counts.mcps})</span>
  </div>
  ${counts.builtins > 0 ? `<button class="toggle-btn" id="toggleBuiltin" onclick="toggleBuiltin()">
    Show builtin agents<span class="count">${counts.builtins}</span>
  </button>` : ""}
</div>

<div class="tree" id="tree">
${treeHtml}
</div>

<div class="summary">
  <div class="stat"><b class="c1">${totalAgents}</b><span>Subagent</span></div>
  <div class="stat"><b class="c2">${counts.skills}</b><span>Skill</span></div>
  <div class="stat"><b class="c3">${counts.mcps}</b><span>MCP</span></div>
</div>

</div>
<script>
function toggleBuiltin(){
  var t=document.getElementById("tree");
  var b=document.getElementById("toggleBuiltin");
  t.classList.toggle("show-builtin");
  b.classList.toggle("active");
  b.innerHTML=t.classList.contains("show-builtin")
    ?'Hide builtin agents<span class="count">${counts.builtins}</span>'
    :'Show builtin agents<span class="count">${counts.builtins}</span>';
}
</script>
</body></html>`;
}

// --- Stage-Aware HTML Generation ---

const STAGE_CSS = `
.stage-layout{display:flex;gap:0;overflow-x:auto;padding:16px 0;align-items:stretch}
.stage-card{
  flex:0 0 220px;display:flex;flex-direction:column;border:1px solid var(--border);
  border-radius:8px;overflow:hidden;position:relative;transition:border-color .2s;
}
.stage-card.completed{border-color:rgba(63,185,80,.3)}
.stage-card.executing{border-color:var(--c-main);animation:stage-breathe 2s ease-in-out infinite}
.stage-card.pending{opacity:.45;border-style:dashed}

@keyframes stage-breathe{
  0%,100%{border-color:var(--c-main);box-shadow:0 0 0 0 rgba(240,136,62,0)}
  50%{border-color:var(--c-main);box-shadow:0 0 12px 2px rgba(240,136,62,.15)}
}

.stage-connector{
  flex:0 0 32px;display:flex;align-items:center;justify-content:center;
  color:var(--border);font-size:16px;
}
.stage-connector.done{color:var(--c-mcp)}

.stage-header{padding:12px 14px;border-bottom:1px solid var(--border)}
.stage-header .stage-num{font-size:9px;color:var(--dim);font-weight:600;letter-spacing:.5px;text-transform:uppercase;margin-bottom:2px}
.stage-header .stage-title{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stage-status{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:500;margin-top:4px}
.stage-status .dot{width:6px;height:6px;border-radius:50%}
.stage-status.completed .dot{background:var(--c-mcp)}
.stage-status.completed{color:var(--c-mcp)}
.stage-status.executing .dot{background:var(--c-main);animation:pulse 2s infinite}
.stage-status.executing{color:var(--c-main)}
.stage-status.pending .dot{background:var(--dim)}
.stage-status.pending{color:var(--dim)}

.stage-body{padding:10px 14px;flex:1;overflow-y:auto;font-size:11px}

.agent-entry{margin-bottom:8px}
.agent-row{
  display:flex;align-items:center;gap:5px;padding:3px 0;cursor:pointer;
  border-radius:3px;
}
.agent-row:hover{background:var(--surface2)}
.agent-row .badge{font-size:7px;padding:1px 4px;border-radius:2px;font-weight:600;letter-spacing:.3px;text-transform:uppercase;flex-shrink:0}
.agent-row .badge.agent{background:rgba(88,166,255,.1);color:var(--c-agent)}
.agent-row .name{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.agent-row .dur{color:var(--dim);font-size:10px;flex-shrink:0}
.agent-row .expand{color:var(--dim);font-size:8px;transition:transform .15s;flex-shrink:0}
.agent-row.expanded .expand{transform:rotate(90deg)}

.agent-children{display:none;padding-left:16px;border-left:1px solid var(--border);margin:2px 0 6px 4px}
.agent-children.visible{display:block}
.agent-children .child-row{display:flex;align-items:center;gap:4px;padding:2px 0}
.agent-children .child-row .badge{font-size:7px;padding:1px 3px;border-radius:2px;font-weight:600;letter-spacing:.2px;text-transform:uppercase}
.agent-children .child-row .badge.skill{background:rgba(210,168,255,.1);color:var(--c-skill)}
.agent-children .child-row .badge.mcp{background:rgba(63,185,80,.1);color:var(--c-mcp)}
.agent-children .child-row .name{color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.agent-children .child-row .dur{color:var(--dim);font-size:9px}

.direct-call{display:flex;align-items:center;gap:5px;padding:2px 0}
.direct-call .badge{font-size:7px;padding:1px 3px;border-radius:2px;font-weight:600;letter-spacing:.2px;text-transform:uppercase}
.direct-call .badge.skill{background:rgba(210,168,255,.1);color:var(--c-skill)}
.direct-call .badge.mcp{background:rgba(63,185,80,.1);color:var(--c-mcp)}
.direct-call .name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.direct-call .dur{color:var(--dim);font-size:9px}

.stage-empty{color:var(--dim);font-size:10px;font-style:italic;padding:4px 0}
`;

function renderAgentEntry(agent: AgentExecution, idx: number): string {
  const id = `agent-${idx}`;
  const hasChildren = agent.skills.length > 0 || agent.mcps.length > 0;
  const dur = agent.duration ? `<span class="dur">${formatDuration(agent.duration)}</span>` : "";
  const expand = hasChildren ? `<span class="expand">&#9654;</span>` : "";

  const children = hasChildren
    ? `<div class="agent-children" id="${id}">
  ${agent.skills.map((s) => `<div class="child-row"><span class="badge skill">skill</span><span class="name">${esc(s.name)}</span></div>`).join("\n")}
  ${agent.mcps.map((m) => `<div class="child-row"><span class="badge mcp">mcp</span><span class="name">${esc(m.server ? m.server + " › " : "")}${esc(m.name)}</span></div>`).join("\n")}
</div>`
    : "";

  return `<div class="agent-entry">
<div class="agent-row${hasChildren ? " clickable" : ""}" ${hasChildren ? `onclick="toggleAgent('${id}',this)"` : ""}>
  <span class="badge agent">agent</span><span class="name">${esc(agent.name)}</span>${dur}${expand}
</div>
${children}
</div>`;
}

function renderDirectCall(node: ExecutionNode): string {
  const badge = node.type === "skill" ? "skill" : "mcp";
  const label = node.type === "mcp" && node.server ? `${node.server} › ${node.name}` : node.name;
  const dur = node.duration ? `<span class="dur">${formatDuration(node.duration)}</span>` : "";
  return `<div class="direct-call"><span class="badge ${badge}">${badge}</span><span class="name">${esc(label)}</span>${dur}</div>`;
}

function renderStageCard(s: StageNode, isLast: boolean): string {
  const connector = isLast ? "" : `<div class="stage-connector${s.status === "completed" ? " done" : ""}">&#8250;</div>`;

  const statusLabel = s.status === "completed" ? "Completed" : s.status === "executing" ? "Executing..." : "Pending";
  const statusHtml = `<div class="stage-status ${s.status}"><span class="dot"></span>${statusLabel}</div>`;

  const hasContent = s.agents.length > 0 || s.directCalls.length > 0;
  const body = hasContent
    ? s.agents.map((a, i) => renderAgentEntry(a, s.stage * 100 + i)).join("\n")
      + s.directCalls.map(renderDirectCall).join("\n")
    : `<div class="stage-empty">${s.status === "pending" ? "Not started" : "No calls recorded"}</div>`;

  return `<div class="stage-card ${s.status}">
<div class="stage-header">
  <div class="stage-num">Stage ${s.stage}</div>
  <div class="stage-title">${esc(s.name)}</div>
  ${statusHtml}
</div>
<div class="stage-body">
  ${body}
</div>
</div>${connector}`;
}

export function generateStageHtml(stages: StageNode[], title: string, sessionId: string): string {
  const completedCount = stages.filter((s) => s.status === "completed").length;
  const executingCount = stages.filter((s) => s.status === "executing").length;
  const date = new Date().toISOString().slice(0, 10);
  const cards = stages.map((s, i) => renderStageCard(s, i === stages.length - 1)).join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<title>Talos Workflow - ${esc(title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#0d1117;--surface:#161b22;--surface2:#1c2128;--border:#30363d;
  --text:#e6edf3;--dim:#8b949e;
  --c-main:#f0883e;--c-agent:#58a6ff;--c-skill:#d2a8ff;--c-mcp:#3fb950;
}
body{font-family:'SF Mono',Menlo,Consolas,monospace;background:var(--bg);color:var(--text);padding:36px 24px;line-height:1.5}
.wrap{max-width:100%;margin:0 auto}
h1{font-size:18px;font-weight:600;margin-bottom:3px}
.sub{color:var(--dim);font-size:11px;margin-bottom:4px}
.tag{display:inline-block;background:rgba(240,136,62,.12);color:var(--c-main);font-size:9px;padding:2px 7px;border-radius:3px;margin-bottom:16px;font-weight:500}
.progress{display:flex;gap:10px;align-items:center;margin-bottom:12px;font-size:11px;color:var(--dim)}
.progress b.done{color:var(--c-mcp)}.progress b.active{color:var(--c-main)}
.legend{display:flex;gap:16px;font-size:10px;color:var(--dim);margin-bottom:16px}
.legend i{display:inline-block;width:6px;height:6px;border-radius:2px;margin-right:3px;vertical-align:middle}
${STAGE_CSS}
</style></head>
<body><div class="wrap">

<h1>Talos Workflow : ${esc(title)}</h1>
<p class="sub">session ${esc(sessionId.slice(0, 8))} &mdash; ${date}</p>
<div class="tag">STAGE VIEW</div>

<div class="progress">
  <span><b class="done">${completedCount}</b> completed</span>
  ${executingCount > 0 ? `<span>&middot;</span><span><b class="active">${executingCount}</b> executing</span>` : ""}
  <span>&middot;</span><span>${stages.length} total</span>
</div>

<div class="legend">
  <span><i style="background:var(--c-agent)"></i>Agent</span>
  <span><i style="background:var(--c-skill)"></i>Skill</span>
  <span><i style="background:var(--c-mcp)"></i>MCP</span>
</div>

<div class="stage-layout">
${cards}
</div>

</div>
<script>
function toggleAgent(id, row) {
  var el = document.getElementById(id);
  el.classList.toggle('visible');
  row.classList.toggle('expanded');
}
</script>
</body></html>`;
}
