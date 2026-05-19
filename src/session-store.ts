import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CLAUDE_DIR } from "./graph.js";
import { workspaceDir } from "./paths.js";
import type { Stage } from "./types.js";

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
  stages: Stage[];
}

function projectToDir(projectPath: string): string {
  return projectPath.replace(/\//g, "-");
}

function readWorkflowProgress(projectPath: string, sessionId: string): {
  isWorkflow: boolean;
  workflowName: string | null;
  currentStage: number | null;
  stageName: string | null;
  stages: Stage[];
} {
  const wsDir = workspaceDir(projectPath);
  const empty = { isWorkflow: false, workflowName: null, currentStage: null, stageName: null, stages: [] as Stage[] };
  if (!existsSync(wsDir)) return empty;

  try {
    for (const wfEntry of readdirSync(wsDir, { withFileTypes: true })) {
      if (!wfEntry.isDirectory()) continue;
      const wfDir = join(wsDir, wfEntry.name);

      for (const runEntry of readdirSync(wfDir, { withFileTypes: true })) {
        if (!runEntry.isDirectory()) continue;
        const stagesPath = join(wfDir, runEntry.name, "stages.json");
        if (!existsSync(stagesPath)) continue;

        const raw = JSON.parse(readFileSync(stagesPath, "utf-8"));
        const sessions: string[] = raw.sessions || [];
        if (!sessions.includes(sessionId)) continue;

        const stages: Stage[] = Array.isArray(raw) ? raw : raw.stages;
        const active = stages.find((s) => !s.passes);
        return {
          isWorkflow: true,
          workflowName: wfEntry.name,
          currentStage: active?.stage ?? null,
          stageName: active?.name ?? null,
          stages,
        };
      }
    }
  } catch { /* skip */ }

  return empty;
}

export function discoverAllSessions(): DiscoveredSession[] {
  const historyPath = join(CLAUDE_DIR, "history.jsonl");
  if (!existsSync(historyPath)) return [];

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

    const progress = readWorkflowProgress(entry.project, entry.sessionId);

    sessions.push({
      sessionId: entry.sessionId,
      project: entry.project,
      projectName,
      display: entry.display,
      timestamp: entry.timestamp,
      jsonlPath,
      projectDir,
      isActive,
      ...progress,
    });
  }

  return sessions.sort((a, b) => b.timestamp - a.timestamp);
}
