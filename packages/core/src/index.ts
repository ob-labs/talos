/**
 * @talos/core - Talos Parent Process Manager
 *
 * Talos 是主进程管理器，负责启动和管理所有 Ralph CLI 子进程。
 * 通过 Unix Socket 实现实时双向通信，无需轮询。
 *
 * 通信架构：
 * - CLI → Talos: 通过 SocketClient 发送请求（stop_task, resume_task 等）
 * - 子进程 → Talos: 通过 SocketClient 通知状态变更（notify_state_change）
 * - Talos → 子进程: 通过状态文件（desiredStatus）执行状态转换
 */

export { Talos } from "./application/talos";
export { SocketServer } from "./application/talos/SocketServer";
export { SocketClient } from "./socket-client";
export { Logger, TaskLogger, LoggerClient } from "./logger/index";
export type { SocketRequest, SocketResponse } from "./application/talos/SocketServer";
export type { SocketClientOptions } from "./socket-client";
export type { LoggerOptions, LoggerClientOptions } from "./logger/index";
export { LogLevel } from "@talos/types";

// Re-export ProcessManager and its types
export { ProcessManager } from "./process/index";
export type {
  ProcessOptions,
  ExitInfo,
  TrackedProcess,
} from "@talos/types";

// Re-export process utilities
export {
  getPidPath,
  getSocketPath,
  cleanupSessionFiles,
  checkClaudeEnvironment,
} from "./process/index";

export type {
  ClaudeEnvironmentCheckResult,
} from "./process/index";

// Re-export Infrastructure
export * from "./infrastructure/index";

// Re-export Domain
export * from "./domain/index";

// Re-export Storage
export * from "./storage/index";

// Re-export Application
export * from "./application/index";

// Re-export TaskManager
// export * from "./task-manager/index";
