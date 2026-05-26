export type StageStatus = "pending" | "skipped" | "running" | "completed";

export interface Stage {
  stage: number;
  name: string;
  desc: string;
  status: StageStatus;
  summary?: string;
  subagent?: string[];
  parameters?: string[];
}

export interface StagesFile {
  workflowName: string;
  title?: string;
  stages: Stage[];
  [key: string]: unknown;
}

export interface WorkflowSession {
  sessionId: string;
  projectName: string;
  workflowName: string;
  title: string | null;
  stages: Stage[];
  currentStage: number | null;
  stageName: string | null;
  timestamp: number;
  isActive: boolean;
}

export interface SkillEntry {
  name: string;
  source: string;
  installName?: string;
}

export interface McpEntry {
  name: string;
  transport?: string;
  command: string;
  args: string[];
}

export interface Manifest {
  memorize?: boolean;
  agents?: string[];
  skills?: SkillEntry[];
  mcp?: (McpEntry | string)[];
  plugins?: string[];
}
