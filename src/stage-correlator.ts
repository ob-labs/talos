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
  status: "pending" | "skipped" | "running" | "completed";
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

  const nodes = flattenTopLevel(tree);

  // Build subagent lookup: agentName -> list of stage indices that expect it
  const agentToStages = new Map<string, number[]>();
  for (let i = 0; i < stages.length; i++) {
    if (stages[i].subagent) {
      for (const name of stages[i].subagent!) {
        if (!agentToStages.has(name)) agentToStages.set(name, []);
        agentToStages.get(name)!.push(i);
      }
    }
  }

  // Pass 1: assign each agent/builtin node to a stage index
  // For each node, assign it to the last stage (by index) that expects this agent name
  // and is at or before the current "frontier" for that agent's stages
  const nodeStageAssignments = new Map<number, number>(); // nodeIndex -> stageIndex
  const agentFrontiers = new Map<string, number>(); // agentName -> next unassigned stage index

  for (let ni = 0; ni < nodes.length; ni++) {
    const node = nodes[ni];
    if (node.type !== "agent" && node.type !== "builtin") continue;

    const stageList = agentToStages.get(node.name);
    if (!stageList || stageList.length === 0) continue;

    // Get current frontier for this agent name
    let frontier = agentFrontiers.get(node.name) || 0;

    // Advance frontier to the next stage that expects this agent
    // We assign to the stage at frontier, then increment
    if (frontier < stageList.length) {
      nodeStageAssignments.set(ni, stageList[frontier]);
      agentFrontiers.set(node.name, frontier + 1);
    } else {
      // All expected stages filled; assign to the last one (overflow)
      nodeStageAssignments.set(ni, stageList[stageList.length - 1]);
    }
  }

  // Pass 2: assign non-agent nodes (direct calls) to the nearest preceding stage
  // that doesn't have subagents
  const directCallAssignments = new Map<number, number>();

  // Find last agent-assigned node index before each direct-call node
  let lastAssignedStageIdx = 0;
  for (let ni = 0; ni < nodes.length; ni++) {
    const node = nodes[ni];
    if (nodeStageAssignments.has(ni)) {
      lastAssignedStageIdx = nodeStageAssignments.get(ni)!;
      continue;
    }
    if (isDirectCall(node)) {
      directCallAssignments.set(ni, lastAssignedStageIdx);
    }
  }

  // Pass 3: build stage results
  return stages.map((stage, idx) => {
    const status = stage.status;
    const agents: AgentExecution[] = [];
    const directCalls: ExecutionNode[] = [];

    if (status === "pending" || status === "skipped") {
      return { stage: stage.stage, name: stage.name, status, summary: stage.summary, agents, directCalls };
    }

    // Collect agents assigned to this stage
    for (const [ni, si] of nodeStageAssignments) {
      if (si === idx) {
        agents.push(toAgentExecution(nodes[ni]));
      }
    }

    // Collect direct calls assigned to this stage
    if (!stage.subagent || stage.subagent.length === 0) {
      for (const [ni, si] of directCallAssignments) {
        if (si === idx) {
          directCalls.push(nodes[ni]);
        }
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
