import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { Socket } from "node:net";
import { discoverAllSessions, DiscoveredSession } from "./session-store.js";
import { CLAUDE_DIR, findSessionFile, parseSessionTranscript, enrichWithSubagents, generateHtml, generateStageHtml, getSessionTitle } from "./graph.js";
import { correlateStages } from "./stage-correlator.js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { workspaceDir } from "./paths.js";
import { esc, truncate } from "./utils.js";
import type { Stage } from "./types.js";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// --- Session List HTML ---

function renderSessionList(sessions: DiscoveredSession[], filter: string, port: number): string {
  const filtered = filter === "all" ? sessions : sessions.filter((s) => s.isWorkflow);
  const workflowCount = sessions.filter((s) => s.isWorkflow).length;
  const activeCount = filtered.filter((s) => s.isActive).length;

  const isMac = process.platform === "darwin";

  const cards = filtered.map((s) => {
    const statusDot = s.isActive
      ? `<span class="dot active"></span>`
      : `<span class="dot idle"></span>`;
    const resumeBtn = (!s.isActive && isMac)
      ? `<button class="resume-btn" onclick="event.preventDefault();event.stopPropagation();resume('${s.sessionId}',this)">Resume</button>`
      : "";
    const workflowTag = s.workflowName
      ? `<span class="sep">&middot;</span><span class="wf-badge">${esc(s.workflowName)}</span>`
      : "";
    const stageInfo = s.stageName
      ? `<span class="sep">&middot;</span><span class="stage-badge">${esc(s.stageName)}</span>`
      : "";
    const lastInput = s.display ? `<div class="card-row2"><span class="last-input">${esc(truncate(s.display, 120))}</span></div>` : "";
    return `<a class="card" href="/session/${s.sessionId}">
  <div class="card-row1">
    ${statusDot}
    <span class="prompt">${esc(truncate(s.title || "", 80))}</span>
    <span class="arrow">&rsaquo;</span>
  </div>
  ${lastInput}
  <div class="card-row3">
    <span class="sid">${esc(s.sessionId.slice(0, 8))}</span>
    <span class="sep">&middot;</span>
    <span class="project">${esc(s.projectName)}</span>${workflowTag}${stageInfo}
    <span class="sep">&middot;</span>
    <span class="time">${relativeTime(s.timestamp)}</span>
    ${resumeBtn}
  </div>
</a>`;
  }).join("\n");

  const emptyState = filtered.length === 0
    ? `<div class="empty">No sessions found. Run <code>talos install</code> in a project to start using workflows.</div>`
    : "";

  const wfActive = filter !== "all" ? "active" : "";
  const allActive = filter === "all" ? "active" : "";

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<title>Talos Workflow Monitor</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#0d1117;--surface:#161b22;--surface2:#1c2128;--border:#30363d;
  --text:#e6edf3;--dim:#8b949e;
  --c-main:#f0883e;--c-agent:#58a6ff;--c-skill:#d2a8ff;--c-mcp:#3fb950;
}
body{font-family:'SF Mono',Menlo,Consolas,monospace;background:var(--bg);color:var(--text);padding:0;line-height:1.5}
.header{padding:24px 32px 16px;border-bottom:1px solid var(--border)}
.header h1{font-size:16px;font-weight:600;display:flex;align-items:center;gap:8px}
.header h1 .port{font-size:10px;color:var(--dim);font-weight:400;background:var(--surface);padding:2px 7px;border-radius:3px}
.meta{font-size:11px;color:var(--dim);margin-top:4px}
.meta b{color:var(--c-mcp);font-weight:600}
.tabs{display:flex;gap:0;margin-top:12px}
.tab{font-size:11px;padding:5px 14px;background:transparent;border:1px solid var(--border);color:var(--dim);
  cursor:pointer;font-family:inherit;text-decoration:none;display:inline-block;border-bottom:none;border-radius:4px 4px 0 0}
.tab:hover{color:var(--text)}
.tab.active{background:var(--surface);color:var(--text);border-bottom:1px solid var(--surface);margin-bottom:-1px;z-index:1}
.content{padding:16px 32px 32px}
.card{display:block;text-decoration:none;color:var(--text);padding:10px 14px;border:1px solid var(--border);border-radius:6px;margin-bottom:8px;transition:background .1s,border-color .15s}
.card:hover{background:var(--surface2);border-color:rgba(88,166,255,.3)}
.card-row1{display:flex;align-items:center;gap:8px}
.card-row2{margin-top:2px;font-size:11px}
.last-input{color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-row3{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:11px}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dot.active{background:var(--c-mcp);animation:pulse 2s infinite}
.dot.idle{background:var(--border)}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
.prompt{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px}
.arrow{color:var(--border);font-size:14px;flex-shrink:0}
.sid{color:var(--dim)}
.project{color:var(--dim)}
.sep{color:var(--border);font-size:8px}
.wf-badge{background:rgba(240,136,62,.1);color:var(--c-main);font-size:9px;padding:1px 6px;border-radius:3px;font-weight:500}
.stage-badge{background:rgba(210,168,255,.1);color:var(--c-skill);font-size:9px;padding:1px 6px;border-radius:3px;font-weight:500}
.time{color:var(--dim)}
.resume-btn{
  font-size:9px;padding:2px 8px;border-radius:3px;cursor:pointer;
  background:rgba(88,166,255,.08);border:1px solid rgba(88,166,255,.3);color:var(--c-agent);
  font-family:inherit;transition:all .15s;vertical-align:middle;margin-left:auto;
}
.resume-btn:hover{background:rgba(88,166,255,.15);border-color:var(--c-agent)}
.resume-btn.done{color:var(--c-mcp);border-color:rgba(63,185,80,.3);background:rgba(63,185,80,.08)}
.empty{text-align:center;color:var(--dim);padding:40px 0;font-size:12px}
.empty code{background:var(--surface);padding:2px 6px;border-radius:3px;color:var(--c-agent)}
</style></head>
<body>

<div class="header">
  <h1>Talos Workflow Monitor <span class="port">port ${port}</span></h1>
  <div class="meta"><b>${activeCount}</b> active &middot; ${filtered.length} sessions</div>
  <div class="tabs">
    <a class="tab ${wfActive}" href="/?filter=workflow">Workflow Sessions</a>
    <a class="tab ${allActive}" href="/?filter=all">All Sessions</a>
  </div>
</div>

<div class="content">
${cards}${emptyState}
</div>

<script>
async function resume(id, btn) {
  btn.textContent = 'Opening...';
  btn.disabled = true;
  try {
    const r = await fetch('/api/resume/' + id, { method: 'POST' });
    const data = await r.json();
    if (data.ok) {
      btn.textContent = 'Opened';
      btn.classList.add('done');
    } else {
      btn.textContent = 'Failed';
    }
  } catch (e) {
    btn.textContent = 'Failed';
  }
}
</script>
</body></html>`;
}

// --- Session Graph with nav bar ---

function renderSessionGraphPage(sessionId: string): string | null {
  const found = findSessionFile(sessionId);
  if (!found) return null;

  const { tree, resultMap } = parseSessionTranscript(found.jsonlPath);
  enrichWithSubagents(tree, join(found.projectDir, sessionId), resultMap);

  // Check if this session has workflow stages
  const { stages, title: stageTitle } = readStagesForSession(sessionId);
  const isWorkflow = stages.length > 0;
  const title = isWorkflow ? (stageTitle || "") : getSessionTitle(sessionId);

  const html = isWorkflow
    ? generateStageHtml(correlateStages(stages, tree), title, sessionId)
    : generateHtml(tree, title, sessionId);

  // Inject back navigation
  const navBar = `<div style="padding:8px 24px;background:var(--surface);border-bottom:1px solid var(--border);margin:-36px -24px 20px;display:flex;align-items:center;gap:12px">
  <a href="/" style="color:var(--c-agent);text-decoration:none;font-size:11px">&larr; Back to sessions</a>
  <span style="color:var(--dim);font-size:10px">${esc(sessionId.slice(0, 8))}</span>
</div>`;

  return html.replace('<div class="wrap">', navBar + '\n<div class="wrap">');
}

function readStagesForSession(sessionId: string): { stages: Stage[]; title: string | null } {
  const historyPath = join(CLAUDE_DIR, "history.jsonl");
  if (!existsSync(historyPath)) return { stages: [], title: null };

  const lines = readFileSync(historyPath, "utf-8").split("\n");
  let projectPath = "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.sessionId === sessionId && entry.project) {
        projectPath = entry.project;
      }
    } catch { /* skip */ }
  }
  if (!projectPath) return { stages: [], title: null };

  // Reuse the same logic as session-store
  const wsDir = workspaceDir(projectPath);
  if (!existsSync(wsDir)) return { stages: [], title: null };

  try {
    for (const wfEntry of readdirSync(wsDir, { withFileTypes: true })) {
      if (!wfEntry.isDirectory()) continue;
      const wfDir = join(wsDir, wfEntry.name);

      // Directory name IS the sessionId
      const stagesPath = join(wfDir, sessionId, "stages.json");
      if (!existsSync(stagesPath)) continue;

      const raw = JSON.parse(readFileSync(stagesPath, "utf-8"));
      const stages: Stage[] = Array.isArray(raw) ? raw : raw.stages;
      return { stages, title: raw.title || null };
    }
  } catch { /* skip */ }

  return { stages: [], title: null };
}

// --- Resume handler ---

function handleResume(sessionId: string, res: ServerResponse) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Invalid session ID" }));
    return;
  }

  // Find project path for this session
  let projectPath = "";
  const historyPath = join(CLAUDE_DIR, "history.jsonl");
  if (existsSync(historyPath)) {
    const lines = readFileSync(historyPath, "utf-8").split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.sessionId === sessionId && entry.project) {
          projectPath = entry.project;
        }
      } catch { /* skip */ }
    }
  }

  const cdCmd = projectPath ? `cd '${projectPath.replace(/'/g, "'\\''")}' && ` : "";

  const script = `tell application "Terminal"
  reopen
  activate
  do script "${cdCmd}claude --resume ${sessionId}"
end tell`;

  try {
    execSync("osascript", { input: script, timeout: 5000 });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  } catch (e: any) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
}

// --- Request router ---

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://localhost`);

  try {
    // Session list
    if (url.pathname === "/" || url.pathname === "") {
      const filter = url.searchParams.get("filter") || "workflow";
      const sessions = discoverAllSessions();
      const port = (req.socket.localPort as number) || 3456;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderSessionList(sessions, filter, port));
      return;
    }

    // Session graph
    const sessionMatch = url.pathname.match(/^\/session\/([0-9a-f-]+)$/);
    if (sessionMatch) {
      const html = renderSessionGraphPage(sessionMatch[1]);
      if (!html) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h2>Session not found</h2><a href='/'>Back to sessions</a>");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    // Resume
    const resumeMatch = url.pathname.match(/^\/api\/resume\/([0-9a-f-]+)$/);
    if (resumeMatch && req.method === "POST") {
      handleResume(resumeMatch[1], res);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  } catch (e: any) {
    console.error("Request error:", e);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(e.message || "Internal error");
  }
}

// --- Server startup ---

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();
    socket.setTimeout(300);
    socket.on("connect", () => { socket.destroy(); resolve(true); });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
    socket.connect(port, "localhost");
  });
}

export async function startServer(options?: { port?: number }): Promise<void> {
  const basePort = options?.port || 3456;

  // Reuse existing server if already running
  if (await isPortInUse(basePort)) {
    const url = `http://localhost:${basePort}`;
    console.log(`Server already running: ${url}`);
    try { execSync(`open "${url}"`, { stdio: "ignore" }); } catch { /* not macOS */ }
    return;
  }

  for (let port = basePort; port < basePort + 10; port++) {
    const server = createServer(handleRequest);

    try {
      await new Promise<void>((resolve, reject) => {
        server.on("error", reject);
        server.listen(port, () => {
          server.removeListener("error", reject);
          resolve();
        });
      });

      const url = `http://localhost:${port}`;
      console.log(`Talos Workflow Monitor: ${url}`);

      try {
        execSync(`open "${url}"`, { stdio: "ignore" });
      } catch { /* not macOS */ }

      // Graceful shutdown
      const shutdown = () => {
        console.log("\nShutting down.");
        server.close();
        process.exit(0);
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);

      return;
    } catch {
      continue;
    }
  }

  console.error(`Could not find an available port (${basePort}-${basePort + 9})`);
  process.exit(1);
}
