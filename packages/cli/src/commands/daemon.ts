/**
 * talos daemon commands
 *
 * Refactored daemon management commands using TalosClient.
 * All commands communicate with the daemon via Socket protocol.
 */

import { Command } from "commander";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { TalosClient } from "../client/TalosClient";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TALOS_DIR = ".talos";
const DAEMON_PID_PATH = path.join(os.homedir(), TALOS_DIR, "talos.pid");
const DAEMON_LOG_PATH = path.join(os.homedir(), TALOS_DIR, "talos.log");
const DAEMON_SOCK_PATH = path.join(os.homedir(), TALOS_DIR, "talos.sock");

/**
 * Start Talos daemon
 */
export async function startCommand(): Promise<void> {
  // daemon-entry.js is copied to dist/ during build
  // In bundled mode, __dirname is dist/, same as daemon-entry.js
  const daemonEntryPath = path.join(__dirname, 'daemon-entry.js');

  const logStream = await fs.open(DAEMON_LOG_PATH, "a");
  const daemonProcess = spawn(process.execPath, [daemonEntryPath], {
    detached: true,
    stdio: ["ignore", logStream.fd, logStream.fd],
    cwd: process.cwd(),
  });

  daemonProcess.unref();
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (!daemonProcess.pid) {
    console.error("Failed to start daemon");
    process.exit(1);
  }

  await fs.writeFile(DAEMON_PID_PATH, String(daemonProcess.pid));
  console.log(`✓ Daemon started with PID: ${daemonProcess.pid}`);
  console.log(`  Log: ${DAEMON_LOG_PATH}`);
  console.log(`  Socket: ${DAEMON_SOCK_PATH}`);
}

/**
 * Stop Talos daemon
 */
export async function stopCommand(): Promise<void> {
  const client = new TalosClient();

  try {
    await client.connect();
    await client.shutdownDaemon();

    // Wait for graceful shutdown
    const pidData = await fs.readFile(DAEMON_PID_PATH, "utf-8");
    const pid = parseInt(pidData.trim(), 10);
    let stopped = false;

    for (let i = 0; i < 50; i++) {
      try {
        process.kill(pid, 0); // Check if process exists
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch {
        stopped = true;
        break;
      }
    }

    if (!stopped) {
      process.kill(pid, "SIGKILL");
    }

    await fs.unlink(DAEMON_PID_PATH);
    console.log("✓ Daemon stopped");
  } catch (error) {
    if ((error as any).code === "ECONNREFUSED") {
      console.log("Daemon is not running");
    } else {
      console.error("Error stopping daemon:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}

/**
 * Restart Talos daemon
 */
export async function restartCommand(): Promise<void> {
  await stopCommand();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await startCommand();
}

/**
 * Check daemon status
 */
export async function statusCommand(): Promise<void> {
  const client = new TalosClient();

  try {
    await client.connect();
    const pidData = await fs.readFile(DAEMON_PID_PATH, "utf-8");
    const pid = parseInt(pidData.trim(), 10);

    console.log(`Daemon PID: ${pid}`);
    console.log(`Status: Running ✓`);
    console.log(`Log: ${DAEMON_LOG_PATH}`);
    console.log(`Socket: ${DAEMON_SOCK_PATH}`);
  } catch (error) {
    if ((error as any).code === "ECONNREFUSED" || (error as any).code === "ENOENT") {
      console.log("Daemon is not running");
      console.log("\nStart daemon with: talos daemon start");
    } else {
      console.error("Error checking status:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}

/**
 * Show daemon logs
 */
export async function logsCommand(follow: boolean = false, lines: number = 50): Promise<void> {
  try {
    await fs.access(DAEMON_LOG_PATH);
  } catch {
    console.log("Log file not found");
    console.log(`Log path: ${DAEMON_LOG_PATH}`);
    console.log("\nStart daemon with: talos daemon start");
    return;
  }

  const args = ["-n", String(lines)];
  if (follow) args.push("-f");
  args.push(DAEMON_LOG_PATH);

  const tail = spawn("tail", args, { stdio: "inherit" });

  tail.on("error", (error) => {
    console.error("Failed to show logs:", error.message);
    process.exit(1);
  });

  process.on("SIGINT", () => {
    tail.kill();
    process.exit(0);
  });
}

/**
 * Health check
 */
export async function healthCommand(): Promise<void> {
  const client = new TalosClient();

  try {
    await client.connect();
    console.log("✓ Daemon is healthy");
    console.log(`  Socket: ${DAEMON_SOCK_PATH}`);
  } catch (error) {
    if ((error as any).code === "ECONNREFUSED") {
      console.log("✗ Daemon is unhealthy");
      console.log("  Error: Cannot connect to daemon socket");
      console.log("\nStart daemon with: talos daemon start");
      process.exit(1);
    } else {
      console.error("Error checking health:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}

/**
 * Register daemon commands
 */
export function registerDaemonCommands(program: Command): void {
  const daemonCmd = program.command("daemon").description("Manage Talos daemon");

  daemonCmd
    .command("start")
    .description("Start Talos daemon")
    .action(startCommand);

  daemonCmd
    .command("stop")
    .description("Stop Talos daemon")
    .action(stopCommand);

  daemonCmd
    .command("restart")
    .description("Restart Talos daemon")
    .action(restartCommand);

  daemonCmd
    .command("status")
    .description("Check daemon status")
    .action(statusCommand);

  daemonCmd
    .command("logs")
    .description("Show daemon logs")
    .option("-f, --follow", "Follow log output")
    .option("-n, --lines <number>", "Number of lines to show", "50")
    .action((options: { follow?: boolean; lines?: string }) => {
      return logsCommand(options.follow, parseInt(options.lines || "50", 10));
    });

  daemonCmd
    .command("health")
    .description("Health check")
    .action(healthCommand);
}
