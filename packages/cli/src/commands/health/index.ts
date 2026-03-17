#!/usr/bin/env node
/**
 * Health Check Command
 * System health check command
 */

import { ProcessManager } from "@talos/core";
import path from "path";
import os from "os";
import { connect } from "net";
import { existsSync } from "fs";

export interface HealthCheckResult {
  name: string;
  status: "healthy" | "unhealthy" | "warning";
  message: string;
  suggestion?: string;
}

export async function healthCommand(): Promise<void> {
  const results: HealthCheckResult[] = [];
  const TALOS_PID_PATH = path.join(os.homedir(), ".talos", "talos.pid");
  const TALOS_SOCKET = path.join(os.homedir(), ".talos", "talos.sock");
  const processManager = new ProcessManager();

  // 1. Check Talos main process
  const talosPid = await processManager.readPid(TALOS_PID_PATH);
  const talosRunning = talosPid !== null && processManager.isAliveSync(talosPid);

  if (talosRunning) {
    results.push({
      name: "Talos Main Process",
      status: "healthy",
      message: `Running (PID: ${talosPid})`,
    });
  } else {
    results.push({
      name: "Talos Main Process",
      status: "unhealthy",
      message: talosPid === null ? "Not running" : `PID file exists but process is dead (PID: ${talosPid})`,
      suggestion: "Run 'talos start' to start Talos",
    });
  }

  // 2. Check Talos Socket (if Talos is running)
  if (talosRunning) {
    const socketExists = existsSync(TALOS_SOCKET);
    let socketHealthy = false;

    if (socketExists) {
      socketHealthy = await new Promise<boolean>((resolve) => {
        const socket = connect(TALOS_SOCKET, () => {
          socket.end();
          resolve(true);
        });
        socket.on("error", () => resolve(false));
        setTimeout(() => {
          socket.destroy();
          resolve(false);
        }, 1000);
      });
    }

    if (socketHealthy) {
      results.push({
        name: "Talos Socket",
        status: "healthy",
        message: `Healthy (${TALOS_SOCKET})`,
      });
    } else {
      results.push({
        name: "Talos Socket",
        status: socketExists ? "unhealthy" : "warning",
        message: socketExists ? "Socket file exists but cannot connect" : "Socket file does not exist",
        suggestion: "Talos main process will automatically create socket",
      });
    }
  }

  // 3. Display results
  console.log("\nSystem Health Check");
  console.log("=".repeat(60));

  let hasUnhealthy = false;
  let hasWarning = false;

  for (const result of results) {
    const icon = result.status === "healthy" ? "✓" : result.status === "warning" ? "⚠" : "✗";
    const statusText =
      result.status === "healthy" ? "Healthy" :
      result.status === "warning" ? "Warning" :
      "Unhealthy";

    console.log(`\n${icon} ${result.name}`);
    console.log(`  Status: ${statusText}`);
    console.log(`  Message: ${result.message}`);

    if (result.suggestion) {
      console.log(`  Suggestion: ${result.suggestion}`);
    }

    if (result.status === "unhealthy") hasUnhealthy = true;
    if (result.status === "warning") hasWarning = true;
  }

  console.log("\n" + "=".repeat(60));

  // 4. Summary and suggestions
  if (!hasUnhealthy && !hasWarning) {
    console.log("\n✓ All components are healthy\n");
  } else if (hasUnhealthy) {
    console.log("\n✗ Issues found, please follow suggestions to fix\n");
    process.exit(1);
  } else {
    console.log("\n⚠ Warnings found, please monitor\n");
  }
}
