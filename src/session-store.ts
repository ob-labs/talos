import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CLAUDE_DIR } from "./graph.js";
import { TALOS_DIR } from "./paths.js";
import type { Stage, WorkflowSession } from "./types.js";

// --- Workflow session discovery (from stages.json) ---

export function discoverWorkflowSessions(): WorkflowSession[] {
  if (!existsSync(TALOS_DIR)) return [];

  const sessions: WorkflowSession[] = [];
  const now = Date.now();

  try {
    for (const wsEntry of readdirSync(TALOS_DIR, { withFileTypes: true })) {
      if (!wsEntry.isDirectory()) continue;
      const wsDir = join(TALOS_DIR, wsEntry.name); // ~/.talos/<workspace>/

      for (const wfEntry of readdirSync(wsDir, { withFileTypes: true })) {
        if (!wfEntry.isDirectory()) continue;
        const wfDir = join(wsDir, wfEntry.name); // ~/.talos/<workspace>/<workflow>/

        for (const sessEntry of readdirSync(wfDir, { withFileTypes: true })) {
          if (!sessEntry.isDirectory()) continue;
          const stagesPath = join(wfDir, sessEntry.name, "stages.json");
          if (!existsSync(stagesPath)) continue;

          try {
            const raw = JSON.parse(readFileSync(stagesPath, "utf-8"));
            const stages: Stage[] = Array.isArray(raw) ? raw : raw.stages;
            const active = stages.find((s) => s.status === "running");
            const mtime = statSync(stagesPath).mtimeMs;

            sessions.push({
              sessionId: sessEntry.name,
              projectName: wsEntry.name,
              workflowName: raw.workflowName || wfEntry.name,
              title: raw.title || null,
              stages,
              currentStage: active?.stage ?? null,
              stageName: active?.name ?? null,
              timestamp: mtime,
              isActive: now - mtime < 180_000 || !!active,
            });
          } catch { /* skip malformed stages.json */ }
        }
      }
    }
  } catch { /* skip */ }

  return sessions.sort((a, b) => b.timestamp - a.timestamp);
}

export function findStagesForSession(sessionId: string): { stages: Stage[]; title: string | null; workflowName: string | null } {
  if (!existsSync(TALOS_DIR)) return { stages: [], title: null, workflowName: null };

  try {
    for (const wsEntry of readdirSync(TALOS_DIR, { withFileTypes: true })) {
      if (!wsEntry.isDirectory()) continue;
      const wsDir = join(TALOS_DIR, wsEntry.name);

      for (const wfEntry of readdirSync(wsDir, { withFileTypes: true })) {
        if (!wfEntry.isDirectory()) continue;
        const stagesPath = join(wsDir, wfEntry.name, sessionId, "stages.json");
        if (!existsSync(stagesPath)) continue;

        const raw = JSON.parse(readFileSync(stagesPath, "utf-8"));
        const stages: Stage[] = Array.isArray(raw) ? raw : raw.stages;
        return { stages, title: raw.title || null, workflowName: raw.workflowName || wfEntry.name };
      }
    }
  } catch { /* skip */ }

  return { stages: [], title: null, workflowName: null };
}

// --- All session discovery (from history.jsonl) ---

export interface DiscoveredSession {
  sessionId: string;
  project: string;
  projectName: string;
  display: string;
  timestamp: number;
  jsonlPath: string;
  projectDir: string;
  isActive: boolean;
  isWorkflow: boolean;
  workflowName: string | null;
  currentStage: number | null;
  stageName: string | null;
  title: string | null;
  stages: Stage[];
}

function projectToDir(projectPath: string): string {
  return projectPath.replace(/\//g, "-");
}

export function discoverAllSessions(): DiscoveredSession[] {
  const historyPath = join(CLAUDE_DIR, "history.jsonl");
  if (!existsSync(historyPath)) return [];

  const wfSessions = discoverWorkflowSessions();
  const workflowIds = new Set(wfSessions.map((s) => s.sessionId));
  const workflowMap = new Map<string, WorkflowSession>();
  for (const ws of wfSessions) {
    workflowMap.set(ws.sessionId, ws);
  }

  const lines = readFileSync(historyPath, "utf-8").split("\n");

  const seen = new Map<string, { sessionId: string; project: string; display: string; timestamp: number }>();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (!entry.sessionId) continue;
      const existing = seen.get(entry.sessionId);
      if (!existing || entry.timestamp > existing.timestamp) {
        seen.set(entry.sessionId, {
          sessionId: entry.sessionId,
          project: entry.project || "",
          display: entry.display || "",
          timestamp: entry.timestamp,
        });
      }
    } catch { /* skip */ }
  }

  const sessions: DiscoveredSession[] = [];
  const now = Date.now();

  for (const entry of seen.values()) {
    const projectDir = join(CLAUDE_DIR, "projects", projectToDir(entry.project));
    const jsonlPath = join(projectDir, `${entry.sessionId}.jsonl`);

    if (!existsSync(jsonlPath)) continue;

    const projectName = entry.project.split("/").pop() || entry.project;
    let isActive = false;
    try {
      isActive = now - statSync(jsonlPath).mtimeMs < 180_000;
    } catch { /* skip */ }

    const wf = workflowMap.get(entry.sessionId);

    sessions.push({
      sessionId: entry.sessionId,
      project: entry.project,
      projectName,
      display: entry.display,
      timestamp: entry.timestamp,
      jsonlPath,
      projectDir,
      isActive,
      isWorkflow: workflowIds.has(entry.sessionId),
      workflowName: wf?.workflowName ?? null,
      currentStage: wf?.currentStage ?? null,
      stageName: wf?.stageName ?? null,
      title: wf?.title ?? null,
      stages: wf?.stages ?? [],
    });
  }

  return sessions.sort((a, b) => b.timestamp - a.timestamp);
}
