/**
 * ui 命令
 * 管理 Talos Web UI
 */

import { Command } from "commander";

/**
 * 注册 UI 管理命令到 program
 * Register UI management commands to program
 *
 * @param program - Commander.js program instance
 */
export function registerUICommands(program: Command): void {
  // Create UI command group
  const uiCmd = program.command("ui").description("Web UI 管理 / Web UI Management");

  // Start command
  uiCmd
    .command("start")
    .description("启动 Talos Web UI / Start Talos Web UI")
    .option("--port <number>", "指定端口号 / Specify port", "3000")
    .action(async (options: { port?: string }) => {
      const { startUICommand } = await import("./start.js");
      await startUICommand(options.port ? parseInt(options.port, 10) : undefined);
    });

  // Stop command
  uiCmd
    .command("stop")
    .description("停止 Talos Web UI / Stop Talos Web UI")
    .action(async () => {
      const { stopUICommand } = await import("./stop.js");
      await stopUICommand();
    });

  // Status command
  uiCmd
    .command("status")
    .description("查看 Web UI 运行状态 / Check Web UI status")
    .action(async () => {
      const { statusUICommand } = await import("./status.js");
      await statusUICommand();
    });

  // Logs command
  uiCmd
    .command("logs")
    .description("查看 Web UI 日志 / Show Web UI logs")
    .option("-f, --follow", "持续监控日志（类似 tail -f） / Follow log output")
    .option("-n, --lines <number>", "显示行数 / Number of lines to show", "50")
    .action(async (options: { follow?: boolean; lines?: string }) => {
      const { logsUICommand } = await import("./logs.js");
      await logsUICommand(options.follow, parseInt(options.lines || "50", 10));
    });
}
