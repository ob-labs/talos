#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));

const program = new Command();

program
  .name("talos")
  .description("Talos CLI - AI 辅助开发工作流管理工具")
  .version(pkg.version);

// ralph 命令 - 通过 Claude Code 对话转换 PRD 为 Ralph 格式（懒加载）
program
  .command("ralph")
  .description("无头模式的 PRD 转换器")
  .option("--prd <prdFiles...>", "PRD 文件路径（支持多个，支持通配符）")
  .option("--force", "跳过确认")
  .option("--tool <tool>", "指定工具 (claude 或 cursor)")
  .option("--model <model>", "指定 AI 模型 (cursor: composer-1.5, sonnet-4, auto | claude: sonnet-4, opus)")
  .action(async (options) => {
    const { ralphCommand } = await import("./commands/ralph/index.js");
    return ralphCommand(options);
  });

// prd 命令 - 通过 Claude Code 对话创建 PRD（懒加载）
program
  .command("prd")
  .description("通过 Claude Code 对话创建 PRD")
  .option("--stream", "启用流式模式（stdio JSON 协议）")
  .option("--tool <tool>", "指定工具 (claude 或 cursor，stream 模式下有效)")
  .option("--model <model>", "指定 AI 模型 (cursor: composer-1.5, sonnet-4, auto | claude: sonnet-4, opus)")
  .action(async (options: { stream?: boolean; tool?: string; model?: string }) => {
    const { prdCommand, prdStreamCommand } = await import("./commands/prd/index.js");
    if (options.stream) {
      return prdStreamCommand({ tool: options.tool, model: options.model });
    }
    return prdCommand({ tool: options.tool, model: options.model });
  });

// health 命令 - 系统健康检查（懒加载）
program
  .command("health")
  .description("检查系统健康状态")
  .action(async () => {
    const { healthCommand } = await import("./commands/health/index.js");
    return healthCommand();
  });


// archive 命令 - 归档已完成的 PRD（懒加载）
program
  .command("archive [identifier]")
  .description("归档已完成的 PRD")
  .option("--all", "归档所有 PRD")
  .option("--force", "跳过确认提示")
  .action(async (identifier, options) => {
    const { archiveCommand } = await import("./commands/archive/index.js");
    // 合并 identifier 和 options 到一个对象中
    const archiveOptions: any = { ...options };
    if (identifier) {
      archiveOptions.identifier = identifier;
    }
    return archiveCommand(archiveOptions);
  });

// help 命令 - 显示帮助信息（懒加载）
program
  .command("help")
  .description("显示帮助信息")
  .action(async () => {
    const { helpCommand } = await import("./commands/help/index.js");
    return helpCommand();
  });

// task 命令 - 任务管理
const taskCmd = program.command("task").description("任务管理");

taskCmd
  .command("start")
  .description("启动任务（所有未执行的 PRD，或指定的 PRD）")
  .option("--prd <path>", "指定 PRD 路径")
  .option("--tool <tool>", "指定工具 (claude 或 cursor)")
  .option("--debug", "启用调试模式（捕获完整输出）")
  .option("--model <model>", "指定 AI 模型 (cursor: composer-1.5, sonnet-4, auto | claude: sonnet-4, opus)")
  .action(async (options: { prd?: string; tool?: string; debug?: boolean; model?: string }) => {
    const { startTaskCommand } = await import("./commands/task/start.js");
    return startTaskCommand(options);
  });

taskCmd
  .command("monitor")
  .description("实时监控任务状态（默认持续监控，使用 --once 单次显示）")
  .option("--workspace <name>", "工作区名称")
  .option("--once", "单次显示模式（禁用持续监控）")
  .option("--all", "显示所有 workspace 的任务（不需要在 git 仓库下）")
  .action(async (options: {
    workspace?: string;
    once?: boolean;
    all?: boolean;
  }) => {
    const { monitorTaskCommand } = await import("./commands/task/monitor.js");
    return monitorTaskCommand({
      workspace: options.workspace,
      once: options.once,
      all: options.all,
    });
  });

taskCmd
  .command("list")
  .description("列出所有 Task")
  .option("--json", "JSON 格式输出")
  .option("--all", "显示所有 workspace 的任务")
  .action(async (options: { json?: boolean; all?: boolean }) => {
    const { listTaskCommand } = await import("./commands/task/list.js");
    return listTaskCommand(options);
  });

taskCmd
  .command("stop <taskId>")
  .description("停止 Task")
  .option("--reason <reason>", "停止原因")
  .action(async (taskId: string, options: { reason?: string }) => {
    const { stopTaskCommand } = await import("./commands/task/stop.js");
    return stopTaskCommand(taskId, options);
  });
taskCmd
  .command("resume <taskId>")
  .description("恢复 Task")
  .option("--tool <tool>", "指定工具 (claude 或 cursor)")
  .option("--debug", "启用调试模式（捕获完整输出）")
  .option("--model <model>", "指定 AI 模型 (cursor: composer-1.5, sonnet-4, auto | claude: sonnet-4, opus)")
  .action(async (taskId: string, options: { tool?: string; debug?: boolean; model?: string }) => {
    const { resumeTaskCommand } = await import("./commands/task/resume.js");
    return resumeTaskCommand(taskId, options);
  });
taskCmd
  .command("attach <taskId>")
  .description("进入正在运行的任务会话")
  .option("--follow", "实时跟踪日志输出")
  .action(async (taskId: string, options: { follow?: boolean }) => {
    const { attachTaskCommand } = await import("./commands/task/attach.js");
    return attachTaskCommand(taskId, options);
  });

taskCmd
  .command("health <taskId>")
  .description("检查任务健康状态")
  .option("--json", "JSON 格式输出")
  .action(async (taskId: string, options: { json?: boolean }) => {
    const { taskHealthCommand } = await import("./commands/task/health.js");
    return taskHealthCommand(taskId, options);
  });

taskCmd
  .command("remove <taskId>")
  .description("删除 Task 及其资源（worktree、分支等）")
  .option("--force", "强制删除任务分支 / Force delete task branch")
  .action(async (taskId: string, options: { force?: boolean }) => {
    const { removeTaskCommand } = await import("./commands/task/remove.js");
    return removeTaskCommand(taskId, options);
  });

taskCmd
  .command("clear")
  .description("清除所有失败状态的 Task")
  .option("--force", "跳过确认直接清除 / Skip confirmation")
  .action(async (options: { force?: boolean }) => {
    const { clearTaskCommand } = await import("./commands/task/clear.js");
    return clearTaskCommand(options);
  });


// Talos 主进程管理命令（start, stop, status, logs, restart）
const { registerTalosCommands } = await import("./commands/talos/index.js");
registerTalosCommands(program);

// Daemon 命令 - 守护进程管理（start, stop, restart, status, logs, health）
// Lazy load to avoid require.resolve issues in bundled code
const daemonCmd = program.command("daemon").description("Manage Talos daemon");
daemonCmd
  .command("start")
  .description("Start Talos daemon")
  .action(async () => {
    const { startCommand } = await import("./commands/daemon.js");
    return startCommand();
  });

daemonCmd
  .command("stop")
  .description("Stop Talos daemon")
  .action(async () => {
    const { stopCommand } = await import("./commands/daemon.js");
    return stopCommand();
  });

daemonCmd
  .command("restart")
  .description("Restart Talos daemon")
  .action(async () => {
    const { restartCommand } = await import("./commands/daemon.js");
    return restartCommand();
  });

daemonCmd
  .command("status")
  .description("Check daemon status")
  .action(async () => {
    const { statusCommand } = await import("./commands/daemon.js");
    return statusCommand();
  });

daemonCmd
  .command("logs")
  .description("Show daemon logs")
  .option("-f, --follow", "Follow log output")
  .option("-n, --lines <number>", "Number of lines to show", "50")
  .action(async (options: { follow?: boolean; lines?: string }) => {
    const { logsCommand } = await import("./commands/daemon.js");
    return logsCommand(options.follow, parseInt(options.lines || "50", 10));
  });

daemonCmd
  .command("health")
  .description("Health check")
  .action(async () => {
    const { healthCommand } = await import("./commands/daemon.js");
    return healthCommand();
  });

// UI 命令 - Web UI 管理（start, stop, status, logs）
const { registerUICommands } = await import("./commands/ui/index.js");
registerUICommands(program);

// workspace 命令 - Workspace 管理（包含 add, list 子命令）
const workspaceCmd = program.command("workspace").description("Workspace 管理");

workspaceCmd
  .command("add")
  .description("添加 workspace 到全局配置")
  .option("--path <path>", "Workspace 路径")
  .option("--name <name>", "Workspace 名称")
  .action(async (options: { path?: string; name?: string }) => {
    const { addWorkspaceCommand } = await import("./commands/workspace/add.js");
    await addWorkspaceCommand(options);
  });

workspaceCmd
  .command("list")
  .description("列出所有 workspace")
  .option("--json", "JSON 格式输出")
  .action(async (options: { json?: boolean }) => {
    const { listWorkspaceCommand } = await import("./commands/workspace/list.js");
    await listWorkspaceCommand({ json: options.json });
  });

// Parse arguments
program.parse();

// Export TalosClient for programmatic use
export { TalosClient } from "./client/TalosClient";
export type { TalosClientOptions } from "./client/TalosClient";

// Export UI components for programmatic use
export {
  // React/Ink components
  TaskMonitor,
  TaskListTable,
  TaskLogPanel,
  ErrorBoundary,
  renderInk,
  // CLI components (non-React)
  Table,
  CLIProgressBar,
  TaskProgressBar,
  getStatusIcon,
  getStatusColor,
  formatStatus,
  renderTable,
  createProgressBar,
} from "./ui/index.js";
export type {
  TaskData,
  ColumnConfig,
  TableRow,
  TableOptions,
  ProgressBarOptions,
  TaskProgressOptions,
  TaskStatus,
  StatusConfig,
} from "./ui/index.js";

