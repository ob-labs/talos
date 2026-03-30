/**
 * Contract for PRD agent implementations (classes use `implements PrdAgent`).
 */

export interface PrdAgentStartOptions {
  repoRoot: string;
  taskContent: string;
  tool?: string;
  model?: string;
  /** Talos PRD session id (Qoder stores native `qoderSessionId` under it). */
  prdSessionId?: string;
}

export interface PrdAgentResumeOptions {
  tool?: string;
  model?: string;
}

export interface PrdAgentStartStreamOptions {
  tool?: string;
  model?: string;
}

export interface PrdAgentResumeStreamOptions {
  tool?: string;
  model?: string;
  cwd?: string;
}

export interface PrdAgent {
  start(options: PrdAgentStartOptions): Promise<void>;
  resume(prdSessionId: string, options?: PrdAgentResumeOptions): Promise<void>;
  startStream(
    cwd: string,
    prompt: string,
    options?: PrdAgentStartStreamOptions
  ): Promise<void>;
  resumeStream(
    sessionId: string,
    prompt: string,
    options?: PrdAgentResumeStreamOptions
  ): Promise<void>;
}
