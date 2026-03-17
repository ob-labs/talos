/**
 * talos commands
 * Manage Talos main process
 */

import { Command } from "commander";

/**
 * Register Talos main process management commands to program
 *
 * @param program - Commander.js program instance
 */
export function registerTalosCommands(program: Command): void {
  // Start command
  program
    .command("start")
    .description("Start Talos main process")
    .option("--silent", "Silent start")
    .action(async (options: { silent?: boolean }) => {
      const { startTalosCommand } = await import("./start.js");
      await startTalosCommand(options.silent);
    });

  // Stop command
  program
    .command("stop")
    .description("Stop Talos main process")
    .action(async () => {
      const { stopTalosCommand } = await import("./stop.js");
      await stopTalosCommand();
    });

  // Status command
  program
    .command("status")
    .description("Check Talos main process status")
    .action(async () => {
      const { statusTalosCommand } = await import("./status.js");
      await statusTalosCommand();
    });

  // Logs command
  program
    .command("logs")
    .description("Show Talos logs")
    .option("-f, --follow", "Follow log output (like tail -f)")
    .option("-n, --lines <number>", "Number of lines to show", "50")
    .action(async (options: { follow?: boolean; lines?: string }) => {
      const { logsTalosCommand } = await import("./logs.js");
      await logsTalosCommand(options.follow, parseInt(options.lines || "50", 10));
    });

  // Restart command
  program
    .command("restart")
    .description("Restart Talos main process")
    .action(async () => {
      const { restartTalosCommand } = await import("./restart.js");
      await restartTalosCommand();
    });
}
