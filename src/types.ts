export interface Stage {
  stage: number;
  name: string;
  desc: string;
  passes: boolean;
  subagent?: string[];
  skill?: string;
  parameters?: string[];
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
