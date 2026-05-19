export interface Stage {
  stage: number;
  name: string;
  desc: string;
  passes: boolean;
  subagent?: string[];
  skill?: string;
  parameters?: string[];
}
