import type { ExecutionNode } from "./graph.js";
import type { Stage } from "./types.js";

// --- Types ---

export interface AgentExecution {
  name: string;
  description?: string;
  duration?: number;
  skills: ExecutionNode[];
  mcps: ExecutionNode[];
}

export interface StageNode {
  stage: number;
  name: string;
  status: "completed" | "executing" | "pending";
  summary?: string;
  agents: AgentExecution[];
  directCalls: ExecutionNode[];
}

// --- Correlation ---

function flattenTopLevel(tree: ExecutionNode): ExecutionNode[] {
  const nodes: ExecutionNode[] = [];
  for (const child of tree.children) {
    if (child.type === "parallel-group") {
      nodes.push(...child.children);
    } else {
      nodes.push(child);
    }
  }
  return nodes;
}

function toAgentExecution(node: ExecutionNode): AgentExecution {
  const skills = node.children.filter((c) => c.type === "skill");
  const mcps = node.children.filter((c) => c.type === "mcp");
  return {
    name: node.name,
    description: node.description,
    duration: node.duration,
    skills,
    mcps,
  };
}

function isDirectCall(node: ExecutionNode): boolean {
  return node.type === "skill" || node.type === "mcp" || node.type === "builtin";
}

export function correlateStages(stages: Stage[], tree: ExecutionNode): StageNode[] {
  if (stages.length === 0) return [];

  const executingIdx = stages.findIndex((s) => !s.passes);
  const nodes = flattenTopLevel(tree);
  let cursor = 0;

  return stages.map((stage, idx) => {
    const status: StageNode["status"] =
      executingIdx === -1
        ? "completed"
        : idx < executingIdx
          ? "completed"
          : idx === executingIdx
            ? "executing"
            : "pending";

    const hasSubagents = stage.subagent && stage.subagent.length > 0;

    const agents: AgentExecution[] = [];
    const directCalls: ExecutionNode[] = [];

    if (status === "pending") {
      // No execution data for pending stages
      return { stage: stage.stage, name: stage.name, status, agents, directCalls };
    }

    if (hasSubagents) {
      // Match agent nodes by name
      const expected = new Set(stage.subagent!);
      const consumed: number[] = [];

      for (let i = cursor; i < nodes.length; i++) {
        const node = nodes[i];
        if ((node.type === "agent" || node.type === "builtin") && expected.has(node.name)) {
          agents.push(toAgentExecution(node));
          consumed.push(i);
        }
        // Stop looking once we've matched all expected agents or hit a node
        // that belongs to a later stage
        if (consumed.length === expected.size) break;
      }
      cursor = consumed.length > 0 ? Math.max(...consumed) + 1 : cursor;
    } else {
      // Direct execution stage: collect contiguous direct-call nodes
      while (cursor < nodes.length && isDirectCall(nodes[cursor])) {
        // Stop if this node looks like it belongs to a later stage
        // (heuristic: if a later stage expects this agent, don't consume it)
        const laterAgentStage = stages.slice(idx + 1).find(
          (s) => s.subagent && (s.subagent.includes(nodes[cursor].name))
        );
        if (laterAgentStage) break;

        directCalls.push(nodes[cursor]);
        cursor++;
      }
    }

    return {
      stage: stage.stage,
      name: stage.name,
      status,
      summary: stage.summary,
      agents,
      directCalls,
    };
  });
}
