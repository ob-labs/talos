/**
 * Task DTO Types
 *
 * Data Transfer Objects for Task entity serialization/deserialization.
 * These types are used by TaskRepository to persist task state to .talos/config.json.
 */

import { ToolType } from "@talos/types";

/**
 * Task progress information
 * 任务进度信息
 */
export interface TaskProgress {
  /** Total number of user stories / 用户故事总数 */
  total: number;
  /** Number of passing stories / 通过的故事数 */
  passing: number;
  /** Number of incomplete stories / 未完成的故事数 */
  incomplete: number;
}

/**
 * Task status
 * 任务状态
 */
export type TaskStatus = "pending" | "running" | "stopped" | "failed" | "completed";

/**
 * Task metadata stored in local config
 * 本地配置中存储的任务元数据
 */
export interface TaskMetadata {
  /** Unique task ID / 唯一任务 ID */
  id: string;
  /** Command to execute / 要执行的命令 */
  command: string;
  /** Task status / 任务状态 */
  status: TaskStatus;
  /** Tool to use for task execution / 用于任务执行的工具 */
  tool?: ToolType;
  /** Workspace name (e.g., "talos") / 工作空间名称 */
  workspace: string;
  /** PRD name / PRD 名称 */
  prd: string;
  /** Git branch name / Git 分支名（如 ralph/simple-task-manager） */
  branch: string;
  /** Worktree directory name / Worktree 目录名（如 ralph-simple-task-manager） */
  worktree?: string;
  /** Working directory for task execution / 任务执行的工作目录 */
  workingDir?: string;
  /** Main process PID (legacy: ralph.sh wrapper script) / 主进程 PID（旧版：ralph.sh 包装脚本） */
  pid?: number;
  /** TaskManager process ID (new: Ralph Executor) / TaskManager 进程 ID（新版：Ralph Executor） */
  processId?: string;
  /** Child process PIDs (claude code, etc.) / 子进程 PID 列表（claude code 等） */
  childPids?: number[];
  /** Creation timestamp / 创建时间戳 */
  createdAt: number;
  /** Task start timestamp / 任务启动时间戳 */
  startedAt?: number;
  /** Exit code (null if running, undefined if not available) / 退出码（运行中为 null，不可用时为 undefined） */
  exitCode?: number;
  /** Unix Socket path for session health checks / Unix Socket 路径用于 Session 健康检查（必需） */
  socketPath?: string;
  /** Last health check timestamp / 最后健康检查时间戳 */
  lastHealthCheck?: number;
  /** Process type for classification / 进程类型用于分类 */
  type?: "ASYNC_WORKFLOW" | "CLI_PROCESS" | "SSE_CONNECTION" | "BACKGROUND_JOB";
  /** Task progress / 任务进度 */
  progress?: TaskProgress;
  /** Additional metadata / 其他元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * Project tasks configuration structure
 * 项目任务配置结构
 *
 * Defines the format of .talos/config.json file
 * 定义 .talos/config.json 文件的格式
 */
export interface ProjectTasksConfig {
  /** Version of config format / 配置格式版本 */
  version: 1;
  /** List of tasks / 任务列表 */
  tasks: TaskMetadata[];
}
