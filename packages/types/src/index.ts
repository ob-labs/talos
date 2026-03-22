/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Talos Type Definitions
 * 
 * TERMINOLOGY CLARIFICATION:
 * 
 * Task (任务): Execution unit, user-facing concept
 *   - Represents a unit of work that gets executed by Claude Code agents
 *   - User interacts with tasks in the terminal and UI
 *   - Examples: "implement user story US-001", "fix bug in login flow"
 * 
 * Story (用户故事): User story from PRD
 *   - Represents a requirement from the Product Requirements Document
 *   - Each story has acceptance criteria that must be met
 *   - Stories are grouped into PRDs
 * 
 * Worktree (工作树): Git branching concept, developer-facing
 *   - A Git worktree is a separate working directory linked to a branch
 *   - Used for parallel development on different branches
 *   - Each worktree can contain multiple stories/tasks from a PRD
 *   - Example: "worktree for feature-branch containing US-001, US-002"
 * 
 * Workspace (工作区): Git repository level
 *   - Represents a complete Git repository
 *   - Can contain multiple worktrees
 *   - Example: "/path/to/project" is a workspace
 * 
 * RELATIONSHIPS:
 * - Workspace contains Worktrees (Git branches)
 * - Worktree contains Stories (PRD user stories)
 * - Story execution creates Tasks (execution units)
 */


// Import value objects
import type { TerminalLog } from "./value-objects/TerminalLog";
// Role configuration for Claude Code agents
export interface Role {
  id: string;
  name: string;
  model: string;
  mcpServers?: MCPServer[];
  skills?: Skill[];
  description?: string;
  isDefault?: boolean;
}

// MCP Server configuration
export interface MCPServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// Skill configuration
export interface Skill {
  name: string;
  path: string;
  triggerWords: string[];
  description?: string;
}

// Standard PRD structure
export interface PRD {
  project: string;
  description: string;
  userStories: UserStory[];
  branchName?: string;
}

// User story in PRD
export interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  passes: boolean;
  notes?: string;
  dependsOn?: string[]; // Array of story IDs this story depends on
}

// Ralph-specific PRD format
export interface RalphPRD {
  project: string;
  branchName: string;
  description: string;
  userStories: RalphUserStory[];
}

// Ralph user story
export interface RalphUserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  passes: boolean;
  notes: string;
  dependsOn?: string[]; // Array of story IDs this story depends on
}

// Ralph task (user story execution unit)
export interface RalphTask {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  conversation: TaskMessage[];
  timestamp: number;
}

// Task message in conversation
export interface TaskMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// Task execution status
export interface Task {
  id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  conversation: TaskMessage[];
  role: string;
  timestamp: number;
}

// Execution history types
export type ExecutionHistoryLevel = "console" | "project";

export interface ExecutionHistory {
  id: string;
  level: ExecutionHistoryLevel;
  timestamp: number;
  prdId: string;
  prdTitle: string;
  role: string;
  tasks: RalphTask[];
  modelsUsed: string[];
  duration?: number; // in seconds
  status: "success" | "failure" | "partial";
}

// Model configuration
export type ModelProvider = "claude" | "glm" | "qwen" | "openai";

export interface ModelConfig {
  id: string;
  provider: ModelProvider;
  apiKey: string;
  endpoint?: string;
  model: string;
  enabled: boolean;
}

// Model provider endpoints
export const MODEL_ENDPOINTS: Record<ModelProvider, string> = {
  claude: "https://api.anthropic.com",
  glm: "https://open.bigmodel.cn/api/paas/v4",
  qwen: "https://dashscope.aliyuncs.com/api/v1",
  openai: "https://api.openai.com/v1",
};

// Task type for model routing
export enum TaskType {
  CODING = "coding",
  REVIEW = "review",
  TRANSLATION = "translation",
  ANALYSIS = "analysis",
  REFACTORING = "refactoring",
  DEBUGGING = "debugging",
  DOCUMENTATION = "documentation",
  TESTING = "testing",
}

// Execution status for API tracking
export type ExecutionStatus = "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";

// Execution state tracked by the API
export interface ExecutionState {
  id: string;
  prdId: string;
  status: ExecutionStatus;
  startedAt: number;
  completedAt?: number;
  currentStoryId?: string;
  currentStoryTitle?: string;
  progress: number; // 0-100
  completedStories: number;
  totalStories: number;
  storyResults: StoryExecutionResult[];
  error?: string;
}

// Story execution result (same as in execution-loop.ts)
export interface StoryExecutionResult {
  storyId: string;
  storyTitle: string;
  success: boolean;
  attempts: number;
  duration: number;
  error?: string;
  conversation?: string;
  rawOutput?: string;
  commits?: string[]; // Array of commit hashes produced by this story
}

// ============================================
// Terminal-centric Redesign Types
// ============================================


// Story (User Story level) - for terminal-centric redesign
// Note: This interface matches UserStory in PRD, with additional execution metadata
export interface Story {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  passes: boolean;              // 是否通过验收标准 / Whether acceptance criteria are met
  notes?: string;               // 备注 / Notes
  terminal: TerminalLog[];      // 执行日志 / Execution logs (Story-specific)
  commit?: {                    // 提交信息 / Commit info (Story-specific)
    hash: string;
    message: string;
    timestamp: number;
  };
}

// Worktree state (status for terminal-centric redesign)
export type WorktreeState = "default" | "running" | "completed" | "pending";

// Worktree (Git worktree / branch level) - Represents a development branch for a PRD user story
// Note: Worktree is a Git branching concept (developer-facing), while Story/Task are execution units (user-facing)
export interface Worktree {
  id: string;
  name: string;
  title: string;
  branchName: string;
  status: WorktreeState;
  progress: number; // 0-100
  isDefault: boolean;
  terminal: TerminalLog[];
  stories: Story[];
  workspaceId: string;
  path: string; // Worktree filesystem path (for terminal sessions)
}

// Terminal session for Workspace
export interface TerminalSession {
  id: string;
  createdAt: number;
  lastActiveAt: number;
  shellPid: number;
}

// Workspace (Git repository level) - Represents a Git repository
export interface Workspace {
  id: string;
  name: string;
  branch: string;
  path: string;
  worktrees: string[]; // Array of worktree IDs
  terminals: TerminalSession[]; // Terminal session history
  expanded: boolean;
}

// ============================================
// Worktree Sync Types (Ralph PRD System)
// ============================================

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Worktree 用户故事状态（简化版本，仅包含需要展示的字段）
 * Worktree user story status (simplified version with only display fields)
 */
export interface WorktreeUserStory {
  id: string;
  title: string;
  description: string;
  passes: boolean;
  notes?: string;
}

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Worktree 状态信息
 * Worktree status information
 */
export interface WorktreeStatus {
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Worktree 路径 */
  path: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  分支名称 */
  branch: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  提交哈希 */
  commit: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  是否为 detached HEAD 状态 */
  isDetached: boolean;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  PRD 项目名称 */
  project: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  用户故事列表 */
  userStories: WorktreeUserStory[];
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  完成的故事数量 */
  completedCount: number;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  总故事数量 */
  totalCount: number;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  完成进度百分比 (0-100) */
  progress: number;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  所有故事是否都完成 */
  isComplete: boolean;
}

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * 包含 worktree 列表的工作区信息
 * Workspace information with worktree list
 */
export interface WorkspaceWorktrees {
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  工作区 ID */
  id: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  工作区名称 */
  name: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  工作区路径 */
  path: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  当前分支 */
  currentBranch: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Worktree 列表 */
  worktrees: WorktreeStatus[];
}

// ============================================
// Storage & TaskManager Architecture Types
// ============================================

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Workspace configuration for storage
 * Represents a git repository workspace configuration
 */
export interface WorkspaceConfig {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）

/**
 * UI configuration
 * Contains default settings for the Web UI
 */
export interface UIConfig {
  defaultPort?: number;
}

/**
 * UI process state stored in global configuration
 * Tracks the Web UI server process information
 */
export interface UIProcessState {
  pid: number;
  port: number;
  startTime: number;
}

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Session status for tracking execution state
 */
export type SessionStatus = "running" | "stopped" | "zombie" | "failed";

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Session metadata for persistent storage
 * Contains all information needed to track and manage sessions
 */
export interface SessionMetadata {
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Unique session identifier (format: sess_{hash}) */
  id: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  PRD identifier this session is executing */
  prdId: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Current session status */
  status: SessionStatus;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Process ID of the running session */
  pid: number;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Path to the Unix socket for health checks */
  socketPath: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Command used to start the session */
  command: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Working directory where the session is running */
  cwd: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Timestamp when the session was created */
  createdAt: number;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Timestamp of the last activity/interaction */
  lastActiveAt: number;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Timestamp of the last successful health check */
  lastHealthCheck: number;
}

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Session data for storage
 * Represents a Claude Code execution session (sessions never expire)
 */
export interface SessionData {
  id: string;
  prdId: string;
  roleId: string;
  conversation: TaskMessage[];
  lastUsedAt: number;
}

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Process type for TaskManager process registry
 * Different types of processes tracked by the system
 */
export enum ProcessType {
  CLI_PROCESS = "CLI_PROCESS",
  SSE_CONNECTION = "SSE_CONNECTION",
  BACKGROUND_JOB = "BACKGROUND_JOB",
  ASYNC_WORKFLOW = "ASYNC_WORKFLOW",
}

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Process information (仅用于内存注册表)
 *
 * 注意：
 * - 此接口仅用于 TaskManager 的内存进程注册表
 * - 不再持久化到文件（已废弃 ~/.talos/processes/ 目录）
 * - 所有持久化状态通过 TaskMetadata 存储在 .talos/config.json
 * - ProcessManager 维护内存中的 Map<processId, ManagedProcess>
 *
 * Tracks running processes with metadata for runtime operations only.
 */
export interface ProcessInfo {
  id: string;
  type: ProcessType;
  pid?: number;
  status: "running" | "stopped" | "failed";
  metadata: Record<string, unknown>;
  startedAt: number;
}

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Storage error for IO failures
 * Thrown when storage operations fail due to file system errors
 */
export class StorageError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Git error for Git command failures
 * Thrown when git operations fail
 */
export class GitError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = "GitError";
  }
}

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Storage interface for workspace and session management
 * This is a higher-level interface than StorageService, specifically for
 * managing WorkspaceConfig and SessionData entities
 */
export interface IStorage {
  // Workspace methods
  getWorkspace(id: string): Promise<WorkspaceConfig | null>;
  saveWorkspace(workspace: WorkspaceConfig): Promise<void>;
  getWorkspaces(): Promise<WorkspaceConfig[]>;
  deleteWorkspace(id: string): Promise<void>;

  // Session methods
  getSession(id: string): Promise<SessionData | null>;
  saveSession(session: SessionData): Promise<void>;
  getSessionsByPRD(prdId: string): Promise<SessionData[]>;
  deleteSession(id: string): Promise<void>;
}

// ============================================
// Storage Service Interface
// ============================================

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Storage service interface for file system operations
 * This interface defines the contract for storage implementations
 */
export interface StorageService {
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
   * Read a JSON file and parse its contents
   * @returns Parsed data or null if file doesn't exist
   */
  readJSON<T>(filePath: string): Promise<T | null>;

  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
   * Write data to a JSON file, creating directories as needed
   */
  writeJSON<T>(filePath: string, data: T): Promise<void>;

  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
   * Read a Markdown file
   * @returns File content or null if file doesn't exist
   */
  readMarkdown(filePath: string): Promise<string | null>;

  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
   * Write content to a Markdown file, creating directories as needed
   */
  writeMarkdown(filePath: string, content: string): Promise<void>;

  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
   * Delete a file
   */
  deleteFile(filePath: string): Promise<void>;

  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
   * Check if a file exists
   */
  fileExists(filePath: string): Promise<boolean>;

  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
   * List all files in a directory with a given extension
   */
  listFiles(dirPath: string, extension?: string): Promise<string[]>;

  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
   * Get file stats (mtime, ctime, size)
   */
  getFileStats(filePath: string): Promise<import("fs").Stats | null>;
}

// ============================================
// Story Details Panel Types
// ============================================

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Story execution progress entry extracted from progress.txt
 * Contains implementation details from a completed story
 */
export interface StoryProgressEntry {
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  What was implemented */
  implemented: string[];
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Files changed during implementation */
  filesChanged: string[];
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Learnings for future iterations */
  learnings: string[];
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Whether manual verification was done */
  manualVerification?: boolean;
}

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Story task conversation from HistoryRecord
 * Contains the conversation between user and assistant during story execution
 */
export interface StoryTask {
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Task status */
  status: "pending" | "in_progress" | "completed" | "failed";
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Complete conversation array */
  conversation: TaskMessage[];
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Execution timestamp */
  timestamp: number;
}

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Complete story details for display in Story Details Panel
 * Combines PRD data with optional execution history
 */
export interface StoryDetails {
  // PRD original fields
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Story ID (e.g., US-001) */
  id: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Story title */
  title: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Story description */
  description: string;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Acceptance criteria list */
  acceptanceCriteria: string[];
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Priority (lower = higher priority) */
  priority: number;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Dependency story IDs */
  dependsOn?: string[];
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Completion status */
  passes: boolean;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Optional notes */
  notes?: string;

  // Optional execution history fields (only for completed stories)
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Progress entry from progress.txt (only if passes=true) */
  progressEntry?: StoryProgressEntry;
  /**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 *  Task conversation from HistoryRecord (only if passes=true) */
  task?: StoryTask;
}

// ============================================
// Parent-Child Process Architecture Types
// ============================================

/**
 * @deprecated
 * 此接口已废弃 - 不再使用 ~/.talos/processes/{processId}.json 状态文件
 * 
 * 新架构（单数据源原则）：
 * - 所有任务状态通过 LocalTaskConfig 存储在 .talos/config.json
 * - ProcessManager 维护内存进程注册表（不持久化）
 * - Socket API 使用新的 getProcessState() 实现
 *
 * 保留此接口仅为向后兼容，不应再使用。
 * 
 * 
 * Process state file for parent-child process architecture
 * 进程状态文件，用于父子进程架构
 *
 * This file represents the state of a child process managed by Talos.
 * The child process writes desiredStatus, Talos validates and executes the transition.
 * 此文件表示由 Talos 管理的子进程状态。
 * 子进程写入 desiredStatus，Talos 验证并执行状态转换。
 */
export interface ProcessStateFile {
  /** Unique process identifier (格式: proc-{timestamp}-{random}) */
  processId: string;
  /** Current actual status (only updated by Talos) */
  currentStatus: "running" | "stopped" | "completed" | "failed";
  /** Desired status (set by child process, cleared by Talos after execution) */
  desiredStatus?: "running" | "stopped" | "completed" | "failed";
  /** Process metadata */
  metadata: {
    /** PRD identifier */
    prdId: string;
    /** Working directory */
    workingDir: string;
    /** Process start timestamp */
    startedAt: number;
    /** Process completion timestamp (optional) */
    completedAt?: number;
    /** Process result (optional) */
    result?: any;
    /** Error message (if failed) */
    error?: string;
    /** Process ID (optional, for tracking active processes) */
    pid?: number;
  };
  /** Health check information */
  healthCheck: {
    /** Last heartbeat timestamp (written by child process every 5 seconds) */
    lastPing: number;
    /** Last health check timestamp (written by Talos every 10 seconds) */
    lastHealthCheck: number;
  };
  /** State transition history for auditing */
  stateTransitions: Array<{
    /** Previous status */
    from: string;
    /** New status */
    to: string;
    /** Transition timestamp */
    at: number;
    /** Reason for transition */
    reason: string;
    /** Who triggered the transition */
    triggeredBy: "parent" | "child" | "healthcheck";
  }>;
}

/**
 * Talos configuration for global settings
 * Talos 全局配置
 */
export interface TalosConfig {
  /** Health check interval in milliseconds (default: 10000 = 10 seconds) */
  healthCheckInterval: number;
  /** Heartbeat timeout in milliseconds (default: 30000 = 30 seconds) */
  heartbeatTimeout: number;
  /** Process stop timeout before SIGKILL (default: 5000 = 5 seconds) */
  stopTimeout: number;
  /** Log level */
  logLevel: "debug" | "info" | "warn" | "error";
  /** Enable zombie process cleanup */
  zombieCleanupEnabled: boolean;
}

/**
 * Default Talos configuration values
 */
export const DEFAULT_TALOS_CONFIG: TalosConfig = {
  healthCheckInterval: 10000,
  heartbeatTimeout: 30000,
  stopTimeout: 5000,
  logLevel: "info",
  zombieCleanupEnabled: true,
};

/**
 * ============================================================================
 * ProcessManager Types - Process Management
 * ============================================================================
 */

/**
 * Process spawn options
 */
export interface ProcessOptions {
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Run process in detached mode */
  detached?: boolean;
  /** Standard IO configuration */
  stdio?: any;
  /** Create new process group */
  createGroup?: boolean;
}

/**
 * Process handle returned by spawn()
 */

/**
 * Process exit information
 */
export interface ExitInfo {
  /** Exit code (null if process hasn't exited or exit code unknown) */
  exitCode: number | null;
  /** Exit signal (null if not killed by signal) */
  signal: NodeJS.Signals | null;
  /** Whether process was killed */
  killed: boolean;
}

/**
 * Tracked process metadata (persisted to disk)
 */
export interface TrackedProcess {
  /** Unique process ID */
  processId: string;
  /** Process ID */
  pid: number;
  /** Start timestamp */
  startedAt: number;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Process status */
  status: 'running' | 'stopped' | 'failed';
}

/**
 * Simple Task Manager - Task Type
 * 简单任务管理器 - 任务类型
 *
 * A lightweight task structure for managing personal todo items
 * 用于管理个人待办事项的轻量级任务结构
 */
export interface SimpleTask {
  /** Unique task identifier (format: task-{timestamp}-{random}) / 唯一任务标识符 */
  id: string;
  /** Task description / 任务描述 */
  description: string;
  /** Task status / 任务状态 */
  status: 'pending' | 'completed';
  /** Creation timestamp in ISO 8601 format / ISO 8601 格式的创建时间戳 */
  createdAt: string;
}

/**
 * Stream-JSON message types
 */
export type StreamJSONMessageType =
  | "assistant"
  | "user"
  | "tool_result"
  | "result"
  | "system";

/**
 * Stream-JSON message content block types
 */
export type StreamJSONContentType =
  | "thinking"
  | "text"
  | "tool_use"
  | "tool_result";

/**
 * Thinking content block
 */
export interface ThinkingContent {
  type: "thinking";
  thinking: string;
}

/**
 * Text content block
 */
export interface TextContent {
  type: "text";
  text: string;
}

/**
 * Tool use content block
 */
export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result content block
 */
export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content?: string;
  is_error?: boolean;
}

/**
 * Stream-JSON content block union
 */
export type StreamJSONContentBlock =
  | ThinkingContent
  | TextContent
  | ToolUseContent
  | ToolResultContent;

/**
 * Stream-JSON message from Claude Code
 */
export interface StreamJSONMessage {
  type: StreamJSONMessageType;
  message?: {
    role: string;
    content: StreamJSONContentBlock[];
  };
  result?: {
    type: "success";
    message?: string;
  };
}

/**
 * Debug mode options
 */
export interface DebugOptions {
  /** Enable debug mode (capture full output) */
  enabled: boolean;
}

// ============================================================================
// PRD Stream Protocol Types
// ============================================================================

/**
 * PRD Stream Protocol - Message types for talos prd --stream command
 * For stdio JSON protocol between external apps and talos prd
 */
export type PrdStreamMessageType =
  | "thinking"
  | "question"
  | "prd"
  | "done"
  | "error"
  | "cancel";

/**
 * PRD Stream Protocol - Output message (Talos -> Client)
 * Each line is a JSON object of this type
 */
export interface PrdStreamMessage {
  type: PrdStreamMessageType;
  timestamp: string;
  /** Content for thinking, prd, error message types */
  content?: string;
  /** Question ID for question type */
  questionId?: string;
  /** Question text for question type */
  question?: string;
  /** Options for question type */
  options?: string[];
  /** PRD file path for done type */
  path?: string;
  /** Additional message for error/cancel types */
  message?: string;
}

/**
 * PRD Stream Protocol - Input message (Client -> Talos)
 * Client sends JSON lines of this type via stdin
 */
export interface PrdStreamInput {
  type: "input" | "cancel";
  /** User response content for input type */
  content?: string;
}

// Re-export tool types
export type { ToolType } from "./task";

// ============================================================================
// Infrastructure Layer Interfaces
// ============================================================================

// Process Manager
export type { IProcessManager, ProcessSpwanOptions, ProcessExitInfo } from "./infrastructure/IProcessManager";


export type { ProcessRuntimeInfo } from "./infrastructure/ProcessRuntimeInfo";
export type { ProcessStartOptions } from "./infrastructure/ProcessStartOptions";
export type { ProcessEventType, ProcessEvent, ProcessStartEvent, ProcessExitEvent } from "./infrastructure/ProcessEventType";
export type { ProcessExitResult, ProcessExitStatus } from "./infrastructure/ProcessExitResult";
export type { SuccessProcessExitResult } from "./infrastructure/SuccessProcessExitResult";
export { FailedProcessExitResult } from "./infrastructure/FailedProcessExitResult";
export type { KilledProcessExitResult } from "./infrastructure/KilledProcessExitResult";
// Storage Engine
export type { IStorageEngine } from "./infrastructure/IStorageEngine";
export type { ReadJSONOptions, WriteJSONOptions, ReadMarkdownOptions, WriteMarkdownOptions } from "./infrastructure/IStorageEngine";

// Communication Channel
export type { ICommunicationChannel } from "./infrastructure/ICommunicationChannel";
export type { Message, MessagePayload, MessageHandler, ConnectionState } from "./infrastructure/ICommunicationChannel";

// Logger
export type { ILogger } from "./infrastructure/ILogger";
export type { LogMetadata, LogEntry } from "./infrastructure/ILogger";
export { LogLevel } from "./infrastructure/ILogger";
// ============================================================================
// Domain Layer Interfaces
// ============================================================================

// Entities
export type { ITask } from "./entities/ITask";
export type { TaskStatus, VALID_TASK_TRANSITIONS } from "./entities/ITask";

export type { IWorkspace } from "./entities/IWorkspace";
export type { IWorktree } from "./entities/IWorktree";

export type { IStory } from "./entities/IStory";
export type { StoryStatus, StoryResult } from "./entities/IStory";

export type { IPRD } from "./entities/IPRD";
export type { PRDStatus } from "./entities/IPRD";

// Repositories
export type { ITaskRepository } from "./repositories/ITaskRepository";
export type { TaskFilter } from "./repositories/ITaskRepository";

export type { IPRDRepository } from "./repositories/IPRDRepository";
export type { PRDFilter } from "./repositories/IPRDRepository";

export type { IWorkspaceRepository } from "./repositories/IWorkspaceRepository";
export type { WorkspaceFilter } from "./repositories/IWorkspaceRepository";

// Domain Services
export type { IStoryExecutionService } from "./domain-services/IStoryExecutionService";
export type { ExecutionOptions, StoryExecutionStatus } from "./domain-services/IStoryExecutionService";

export type { IWorktreeService } from "./domain-services/IWorktreeService";
export type { CreateWorktreeOptions, DeleteWorktreeOptions, SyncOptions, WorktreeInfo, WorktreeStatusInfo } from "./domain-services/IWorktreeService";

export type { EventHandler, UnsubscribeFunction } from "./domain-services/IEventBus";
export type { IEventBus } from "./domain-services/IEventBus";
export type { DomainEvent, TaskEventPayload, StoryEventPayload, PRDEventPayload } from "./domain-services/IEventBus";

// ============================================================================
// Application Layer Interfaces
// ============================================================================

// Task Lifecycle Manager
export type { ITaskLifecycleManager } from "./application/ITaskLifecycleManager";

// Health Checker
export type { IHealthChecker } from "./application/IHealthChecker";

// Socket Server
export type { ISocketServer } from "./application/ISocketServer";

// Task Orchestrator
export type { ITaskOrchestrator } from "./application/ITaskOrchestrator";

// Progress Tracker
export type { IProgressTracker } from "./application/IProgressTracker";

// Session Manager
export type { ISessionManager } from "./application/ISessionManager";

// UI Notifier
export type { IUINotifier } from "./application/IUINotifier";

// Metrics Collector
export type { IMetricsCollector } from "./application/IMetricsCollector";

// Audit Logger
export type { IAuditLogger } from "./application/IAuditLogger";

// ============================================================================
// Tool Executor Interfaces (Anti-Corruption Layer)
// ============================================================================

// Tool Executor
export type { IToolExecutor } from "./executor/IToolExecutor";

// Tool Executor Factory
export type { IToolExecutorFactory } from "./executor/IToolExecutorFactory";

// Tool Execution Types
export type { ToolExecutionRequest } from "./executor/ToolExecutionRequest";
export type { ToolExecutionResult } from "./executor/ToolExecutionResult";
export type { ToolConfig } from "./executor/ToolConfig";

// ============================================================================
// Value Objects
// ============================================================================

// Task Progress
export type {
  TaskProgress,
} from "./value-objects/TaskProgress";

// Terminal Log
export type {
  TerminalLog,
} from "./value-objects/TerminalLog";

// Note: TaskStatus is exported above from entities/ITask.ts

// ============================================
// Entry Layer Types
// ============================================

export type { ITalosClient } from "./entry/ITalosClient";
export type {
  HealthCheckResult,
  TaskFilters,
  StartTaskRequest,
  StopTaskRequest,
  ResumeTaskRequest,
  EventCallback,
} from "./entry/ITalosClient";

export type { ISocketProtocol } from "./entry/ISocketProtocol";

export type { SocketMessage } from "./entry/SocketMessage";
