/**
 * talos ui status 命令
 * 查看 Web UI 运行状态
 */

import { ProcessManager, SocketClient } from "@talos/core";
import path from "path";
import os from "os";

const TALOS_PID_PATH = path.join(os.homedir(), ".talos", "talos.pid");

/**
 * Status UI command
 * 查看 Web UI 运行状态
 */
export async function statusUICommand(): Promise<void> {
  // 检查 Talos 主进程是否运行
  const processManager = new ProcessManager();
  const pid = await processManager.readPid(TALOS_PID_PATH);

  if (pid === null || !processManager.isAliveSync(pid)) {
    console.error("❌ Talos 主进程未运行");
    process.exit(1);
  }

  const socketClient = new SocketClient();

  try {
    const result = await socketClient.getUIStatus();

    if (!result.success) {
      console.error(`❌ 获取状态失败: ${result.error}`);
      process.exit(1);
    }

    const { running, pid: uiPid, port, url } = result.data;

    if (!running) {
      console.log("状态: 未运行 / Not running");
      process.exit(0);
    }

    console.log("状态: 运行中 / Running");
    console.log(`  PID: ${uiPid}`);
    console.log(`  Port: ${port}`);
    console.log(`  URL: ${url}`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ 获取状态失败: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
