/**
 * talos ui stop 命令
 * 停止 Web UI
 */

import { ProcessManager, SocketClient } from "@talos/core";
import path from "path";
import os from "os";

const TALOS_PID_PATH = path.join(os.homedir(), ".talos", "talos.pid");

/**
 * Stop UI command
 * 停止 Web UI
 */
export async function stopUICommand(): Promise<void> {
  // 检查 Talos 主进程是否运行
  const processManager = new ProcessManager();
  const pid = await processManager.readPid(TALOS_PID_PATH);

  if (pid === null || !processManager.isAliveSync(pid)) {
    console.error("❌ Talos 主进程未运行");
    console.error("   请先运行: talos start");
    process.exit(1);
  }

  const socketClient = new SocketClient();

  try {
    const result = await socketClient.stopUI();

    if (!result.success) {
      console.error(`❌ 停止失败: ${result.error}`);
      process.exit(1);
    }

    console.log(result.data.message || "✓ Web UI 已停止");
    process.exit(0);
  } catch (error) {
    console.error(`❌ 停止失败: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
