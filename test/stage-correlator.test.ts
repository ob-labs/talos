import { describe, it, expect } from "vitest";
import { correlateStages } from "../src/stage-correlator.js";
import type { ExecutionNode } from "../src/graph.js";
import type { Stage } from "../src/types.js";

function makeAgent(name: string, children: ExecutionNode[] = [], duration?: number): ExecutionNode {
  return { id: `agent-${name}`, type: "agent", name, children, duration };
}

function makeSkill(name: string): ExecutionNode {
  return { id: `skill-${name}`, type: "skill", name, children: [] };
}

function makeMcp(server: string, tool: string): ExecutionNode {
  return { id: `mcp-${server}-${tool}`, type: "mcp", name: tool, server, children: [] };
}

function makeTree(children: ExecutionNode[]): ExecutionNode {
  return { id: "root", type: "root", name: "coordinator", children };
}

describe("correlateStages", () => {
  it("returns empty for no stages", () => {
    const tree = makeTree([]);
    expect(correlateStages([], tree)).toEqual([]);
  });

  it("marks all stages as pending when all are pending", () => {
    const stages: Stage[] = [
      { stage: 0, name: "Plan", desc: "", status: "pending" },
      { stage: 1, name: "Code", desc: "", status: "pending" },
    ];
    const tree = makeTree([]);
    const result = correlateStages(stages, tree);
    expect(result[0].status).toBe("pending");
    expect(result[1].status).toBe("pending");
  });

  it("marks first non-passed stage as running", () => {
    const stages: Stage[] = [
      { stage: 0, name: "Plan", desc: "", status: "completed" },
      { stage: 1, name: "Code", desc: "", status: "running" },
    ];
    const tree = makeTree([]);
    const result = correlateStages(stages, tree);
    expect(result[0].status).toBe("completed");
    expect(result[1].status).toBe("running");
  });

  it("marks all completed when all are completed", () => {
    const stages: Stage[] = [
      { stage: 0, name: "Plan", desc: "", status: "completed" },
      { stage: 1, name: "Code", desc: "", status: "completed" },
    ];
    const tree = makeTree([]);
    const result = correlateStages(stages, tree);
    expect(result[0].status).toBe("completed");
    expect(result[1].status).toBe("completed");
  });

  it("passes through skipped status", () => {
    const stages: Stage[] = [
      { stage: 0, name: "Plan", desc: "", status: "completed" },
      { stage: 1, name: "Review", desc: "", status: "skipped" },
      { stage: 2, name: "Code", desc: "", status: "running" },
    ];
    const tree = makeTree([]);
    const result = correlateStages(stages, tree);
    expect(result[0].status).toBe("completed");
    expect(result[1].status).toBe("skipped");
    expect(result[2].status).toBe("running");
  });

  it("handles reactivated stage (completed → running)", () => {
    const stages: Stage[] = [
      { stage: 0, name: "Code", desc: "", status: "running" },
      { stage: 1, name: "Review", desc: "", status: "completed" },
    ];
    const tree = makeTree([]);
    const result = correlateStages(stages, tree);
    expect(result[0].status).toBe("running");
    expect(result[1].status).toBe("completed");
  });

  it("matches agents to stages with subagent field", () => {
    const stages: Stage[] = [
      { stage: 0, name: "Explore", desc: "", status: "completed", subagent: ["Explore"] },
      { stage: 1, name: "Code", desc: "", status: "running", subagent: ["executor"] },
    ];
    const agent1 = makeAgent("Explore", [makeMcp("chrome", "navigate")]);
    const agent2 = makeAgent("executor", [makeSkill("tdd")]);
    const tree = makeTree([agent1, agent2]);

    const result = correlateStages(stages, tree);
    expect(result[0].status).toBe("completed");
    expect(result[0].agents).toHaveLength(1);
    expect(result[0].agents[0].name).toBe("Explore");
    expect(result[0].agents[0].mcps).toHaveLength(1);

    expect(result[1].status).toBe("running");
    expect(result[1].agents).toHaveLength(1);
    expect(result[1].agents[0].name).toBe("executor");
    expect(result[1].agents[0].skills).toHaveLength(1);
  });

  it("collects direct calls for stages without subagent", () => {
    const stages: Stage[] = [
      { stage: 0, name: "Generate PRD", desc: "", status: "completed" },
      { stage: 1, name: "Code", desc: "", status: "running", subagent: ["executor"] },
    ];
    const mcp1 = makeMcp("skylark", "search");
    const mcp2 = makeMcp("skylark", "create_doc");
    const agent = makeAgent("executor");
    const tree = makeTree([mcp1, mcp2, agent]);

    const result = correlateStages(stages, tree);
    expect(result[0].directCalls).toHaveLength(2);
    expect(result[1].agents).toHaveLength(1);
  });

  it("handles parallel groups by flattening them", () => {
    const stages: Stage[] = [
      { stage: 0, name: "Explore", desc: "", status: "completed", subagent: ["Explore", "Plan"] },
    ];
    const agent1 = makeAgent("Explore");
    const agent2 = makeAgent("Plan");
    const tree = makeTree([{
      id: "pg-1",
      type: "parallel-group",
      name: "parallel",
      children: [agent1, agent2],
    }]);

    const result = correlateStages(stages, tree);
    expect(result[0].agents).toHaveLength(2);
  });

  it("handles empty execution tree gracefully", () => {
    const stages: Stage[] = [
      { stage: 0, name: "Plan", desc: "", status: "completed", subagent: ["Explore"] },
      { stage: 1, name: "Code", desc: "", status: "running", subagent: ["executor"] },
    ];
    const tree = makeTree([]);

    const result = correlateStages(stages, tree);
    expect(result[0].agents).toHaveLength(0);
    expect(result[0].status).toBe("completed");
    expect(result[1].status).toBe("running");
  });

  it("does not consume nodes that belong to later stages in direct call mode", () => {
    const stages: Stage[] = [
      { stage: 0, name: "Direct", desc: "", status: "completed" },
      { stage: 1, name: "Agent", desc: "", status: "running", subagent: ["executor"] },
    ];
    // An agent node should not be consumed by the direct-call stage
    const agent = makeAgent("executor");
    const mcp = makeMcp("skylark", "search");
    const tree = makeTree([mcp, agent]);

    const result = correlateStages(stages, tree);
    expect(result[0].directCalls).toHaveLength(1); // only the mcp
    expect(result[1].agents).toHaveLength(1); // the agent goes to stage 1
  });

  it("includes summary for skipped stages", () => {
    const stages: Stage[] = [
      { stage: 0, name: "Test", desc: "", status: "skipped", summary: "纯后端改动，跳过验证" },
    ];
    const tree = makeTree([]);

    const result = correlateStages(stages, tree);
    expect(result[0].status).toBe("skipped");
    expect(result[0].summary).toBe("纯后端改动，跳过验证");
  });

  it("matches multiple agents with the same name in one stage", () => {
    const stages: Stage[] = [
      { stage: 0, name: "Implement", desc: "", status: "completed", subagent: ["executor"] },
      { stage: 1, name: "Review", desc: "", status: "running", subagent: ["reviewer"] },
    ];
    const agent1 = makeAgent("executor", [], 30);
    const agent2 = makeAgent("executor", [], 45);
    const reviewer = makeAgent("reviewer");
    const tree = makeTree([agent1, agent2, reviewer]);

    const result = correlateStages(stages, tree);
    expect(result[0].agents).toHaveLength(2);
    expect(result[0].agents[0].name).toBe("executor");
    expect(result[0].agents[1].name).toBe("executor");
    expect(result[1].agents).toHaveLength(1);
    expect(result[1].agents[0].name).toBe("reviewer");
  });
});
