/**
 * talos ui start 命令
 * 启动 Web UI
 */

import { ProcessManager, SocketClient } from "@talos/core";
import { getServerPath } from "@talos/web";
let webPackageAvailable = true;
try {
  require("@talos/web");
} catch (e) {
  webPackageAvailable = false;
}
import path from "path";
import os from "os";
import open from "open";

const TALOS_PID_PATH = path.join(os.homedir(), ".talos", "talos.pid");

/**
 * Start UI command
 * 启动 Web UI
 */
export async function startUICommand(port?: number): Promise<void> {
  // 1. 获取 standalone server 路径
  // Get standalone server path
  let serverPath: string;
  try {
    serverPath = getServerPath();
  } catch (error) {
    console.error("❌ Failed to locate Web UI server from @talos/web package");
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error();
    console.error("Please ensure @talos/web is properly built:");
    console.error("   pnpm run build --filter=@talos/web");
    process.exit(1);
  }

  // 2. 检查 Talos 主进程是否运行
  // Check if Talos main process is running
  const processManager = new ProcessManager();
  const pid = await processManager.readPid(TALOS_PID_PATH);

  if (pid === null || !processManager.isAliveSync(pid)) {
    console.error("❌ Talos 主进程未运行");
    console.error("   请先运行: talos start");
    process.exit(1);
  }

  // 3. 发送请求到 Talos 启动 UI
  // Send request to Talos to start UI
  const socketClient = new SocketClient();

  try {
    const result = await socketClient.startUI(port, serverPath);

    if (!result.success) {
      console.error(`❌ 启动失败: ${result.error}`);
      process.exit(1);
    }

    const { pid: uiPid, port: uiPort, url } = result.data;

    console.log(`✓ UI available at ${url}`);
    console.log(`  PID: ${uiPid}`);
    console.log();
    console.log("停止 UI:");
    console.log(`  • talos ui stop`);

    // 自动打开浏览器
    // Auto-open browser
    try {
      await open(url);
    } catch (error) {
      // 浏览器打开失败不影响 Web 服务启动
      // Browser open failure should not affect the web service
      console.log("  Note: Could not open browser automatically");
    }

    process.exit(0);
  } catch (error) {
    console.error(`❌ 启动失败: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
