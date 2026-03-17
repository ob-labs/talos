#!/usr/bin/env node
/**
 * Talos Main Process Entry Point
 *
 * 这是 Talos 主进程的入口点，用于作为后台进程启动。
 * This is the entry point for Talos main process, started as a background process.
 */

import { Talos } from "./application/talos";
import { TaskLifecycleManager } from "./application/talos/TaskLifecycleManager";
import { HealthChecker } from "./application/talos/HealthChecker";
import { SocketServer } from "./application/talos/SocketServer";
import { UIManager } from "./application/talos/UIManager";
import { ProcessManager } from "./process";
import { ProcessRegistry } from "./infrastructure/process/ProcessRegistry";
import { StorageManager } from "./storage/storage-manager";
import { InMemoryEventBus } from "./infrastructure/events";
import { ProtocolManager } from "./infrastructure/communication/socket/ProtocolManager";
import { Logger } from "./logger";
import { WorkspaceRepository } from "./repositories/workspace-repository";
import { homedir } from "os";
import path from "path";

async function main() {
  // Create Talos instance with dependency injection
  const basePath = path.join(homedir(), ".talos");
  const logPath = path.join(basePath, "talos.log");
  const socketPath = path.join(basePath, "talos.sock");

  // Create core dependencies
  const logger = new Logger({ logPath });
  const eventBus = new InMemoryEventBus({ logger });
  const processManager = new ProcessManager(basePath);
  const processRegistry = new ProcessRegistry({ basePath });
  const storageManager = new StorageManager();

  // Create application managers
  const workspaceRepository = new WorkspaceRepository();
  const taskLifecycleManager = new TaskLifecycleManager({
    processManager,
    eventBus,
    logger,
    basePath,
    workspaceRepository,
  });

  const healthChecker = new HealthChecker({
    processManager,
    processRegistry,
    eventBus,
    logger,
  });

  const uiManager = new UIManager({
    processManager,
    storageManager,
    logger,
  });

  const protocolManager = new ProtocolManager();

  // Declare talos variable before socketServer to enable shutdown callback
  let talos: Talos;

  const socketServer = new SocketServer({
    taskLifecycleManager,
    storageManager,
    uiManager,
    protocolManager,
    logger,
    socketPath,
    basePath,
    shutdownCallback: async () => {
      // Gracefully shutdown Talos when requested via Socket
      await talos.stop();
    },
  });

  talos = new Talos({
    taskLifecycleManager,
    healthChecker,
    socketServer,
    processManager,
    storageManager,
    eventBus,
    logger,
    basePath,
  });

  // Set up error handlers
  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled rejection at:", promise, "reason:", reason);
  });

  // Handle shutdown signals
  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(`Received ${signal}, shutting down...`);
    await talos.stop();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Start Talos
  try {
    await talos.start();
  } catch (error) {
    console.error("Failed to start Talos:", error);
    process.exit(1);
  }
}

// Start the main process
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
