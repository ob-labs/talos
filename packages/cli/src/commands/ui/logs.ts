/**
 * talos ui logs 命令
 * 查看 Web UI 日志
 */

import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";

/**
 * UI log file path
 */
const UI_LOG_PATH = path.join(os.homedir(), ".talos", "ui.log");

/**
 * Logs UI command
 *
 * @param follow - Follow log output (tail -f)
 * @param lines - Number of lines to show (default: 50)
 */
export async function logsUICommand(
  follow: boolean = false,
  lines: number = 50
): Promise<void> {
  try {
    // Check if log file exists
    try {
      await fs.access(UI_LOG_PATH);
    } catch {
      console.log("❌ UI 日志不存在");
      console.log();
      console.log("请确认 UI 是否正在运行:");
      console.log("  talos ui status");
      console.log();
      console.log("启动 UI:");
      console.log("  talos ui start");
      process.exit(1);
    }

    // Use tail to show logs
    const args = ["-n", lines.toString()];
    if (follow) {
      args.push("-f");
    }
    args.push(UI_LOG_PATH);

    const tail = spawn("tail", args, { stdio: "inherit" });

    tail.on("error", (error) => {
      console.error("❌ 无法读取日志:", error.message);
      console.log(`日志路径: ${UI_LOG_PATH}`);
      process.exit(1);
    });

    // Handle Ctrl+C
    process.on("SIGINT", () => {
      tail.kill();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ 读取日志时出错:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
