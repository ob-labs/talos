/**
 * Unit tests for ProcessRegistry
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { ProcessRegistry, ProcessType } from "./ProcessRegistry";

describe("ProcessRegistry", () => {
  let registry: ProcessRegistry;
  let tempDir: string;
  let registryPath: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = path.join(
      os.tmpdir(),
      `talos-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(tempDir, { recursive: true });

    registryPath = path.join(tempDir, "processes", "registry.json");

    // Create registry instance
    registry = new ProcessRegistry({
      basePath: tempDir,
    });

    // Initialize registry
    await registry.init();
  });

  afterEach(async () => {
    // Stop auto-cleanup if running
    registry.stopAutoCleanup();

    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("register", () => {
    it("should register a process successfully", async () => {
      await registry.register(12345, -12345, {
        type: "task",
        metadata: { taskId: "task-123", prdId: "prd-456" },
      });

      const process = await registry.get(12345);
      expect(process).toBeDefined();
      expect(process?.pid).toBe(12345);
      expect(process?.pgid).toBe(-12345);
      expect(process?.type).toBe("task");
      expect(process?.metadata.taskId).toBe("task-123");
      expect(process?.metadata.prdId).toBe("prd-456");
      expect(process?.isZombie).toBe(false);
      expect(process?.startedAt).toBeDefined();
    });

    it("should save registry to disk after registration", async () => {
      await registry.register(12345, -12345, {
        type: "task",
        metadata: { taskId: "task-123" },
      });

      // Verify file exists
      const exists = await fs
        .access(registryPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Load and verify content
      const content = await fs.readFile(registryPath, "utf-8");
      const data = JSON.parse(content);
      expect(data.processes[12345]).toBeDefined();
      expect(data.processes[12345].type).toBe("task");
    });

    it("should register multiple processes", async () => {
      await registry.register(11111, -11111, {
        type: "task",
        metadata: { taskId: "task-111" },
      });
      await registry.register(22222, -22222, {
        type: "daemon",
        metadata: { name: "talos-daemon" },
      });

      const all = await registry.listAll();
      expect(all).toHaveLength(2);
    });
  });

  describe("unregister", () => {
    it("should unregister a process successfully", async () => {
      await registry.register(12345, -12345, {
        type: "task",
        metadata: { taskId: "task-123" },
      });

      await registry.unregister(12345);

      const process = await registry.get(12345);
      expect(process).toBeUndefined();
    });

    it("should save registry to disk after unregistration", async () => {
      await registry.register(12345, -12345, {
        type: "task",
        metadata: { taskId: "task-123" },
      });

      await registry.unregister(12345);

      // Load and verify content
      const content = await fs.readFile(registryPath, "utf-8");
      const data = JSON.parse(content);
      expect(data.processes[12345]).toBeUndefined();
    });

    it("should handle unregistering non-existent process", async () => {
      // Should not throw
      await registry.unregister(99999);
    });
  });

  describe("get", () => {
    it("should return undefined for non-existent process", async () => {
      const process = await registry.get(99999);
      expect(process).toBeUndefined();
    });

    it("should return process metadata for existing process", async () => {
      await registry.register(12345, -12345, {
        type: "task",
        metadata: { taskId: "task-123" },
      });

      const process = await registry.get(12345);
      expect(process).toBeDefined();
      expect(process?.pid).toBe(12345);
    });
  });

  describe("findByType", () => {
    beforeEach(async () => {
      // Register multiple processes of different types
      await registry.register(11111, -11111, {
        type: "task",
        metadata: { taskId: "task-111" },
      });
      await registry.register(22222, -22222, {
        type: "task",
        metadata: { taskId: "task-222" },
      });
      await registry.register(33333, -33333, {
        type: "daemon",
        metadata: { name: "talos-daemon" },
      });
      await registry.register(44444, -44444, {
        type: "ui",
        metadata: { sessionId: "session-123" },
      });
    });

    it("should find processes by type", async () => {
      const tasks = await registry.findByType("task");
      expect(tasks).toHaveLength(2);
      expect(tasks.every((p) => p.type === "task")).toBe(true);
    });

    it("should return empty array for non-existent type", async () => {
      const ralph = await registry.findByType("ralph");
      expect(ralph).toHaveLength(0);
    });
  });

  describe("listAll", () => {
    it("should return empty array when no processes registered", async () => {
      const all = await registry.listAll();
      expect(all).toHaveLength(0);
    });

    it("should return all registered processes", async () => {
      await registry.register(11111, -11111, {
        type: "task",
        metadata: { taskId: "task-111" },
      });
      await registry.register(22222, -22222, {
        type: "daemon",
        metadata: { name: "talos-daemon" },
      });

      const all = await registry.listAll();
      expect(all).toHaveLength(2);
    });
  });

  describe("cleanupZombieProcesses", () => {
    beforeEach(async () => {
      // Register some processes
      await registry.register(11111, -11111, {
        type: "task",
        metadata: { taskId: "task-111" },
      });
      await registry.register(22222, -22222, {
        type: "daemon",
        metadata: { name: "talos-daemon" },
      });
      await registry.register(33333, -33333, {
        type: "ui",
        metadata: { sessionId: "session-123" },
      });
    });

    it("should mark dead processes as zombies", async () => {
      // Mock callback - process 11111 is alive, 22222 and 33333 are dead
      const aliveCallback = (pid: number) => pid === 11111;

      const zombiesMarked = await registry.cleanupZombieProcesses(aliveCallback);
      expect(zombiesMarked).toBe(2);

      const process22222 = await registry.get(22222);
      expect(process22222?.isZombie).toBe(true);
      expect(process22222?.exitedAt).toBeDefined();

      const process33333 = await registry.get(33333);
      expect(process33333?.isZombie).toBe(true);

      const process11111 = await registry.get(11111);
      expect(process11111?.isZombie).toBe(false);
    });

    it("should not mark already zombie processes", async () => {
      // Manually mark one as zombie
      await registry.register(44444, -44444, {
        type: "task",
        metadata: { taskId: "task-444" },
      });
      const process = await registry.get(44444);
      if (process) {
        process.isZombie = true;
      }

      // Mock callback - all processes are dead
      const aliveCallback = () => false;

      const zombiesMarked = await registry.cleanupZombieProcesses(aliveCallback);
      // Should only mark 3 new zombies (11111, 22222, 33333), not 44444
      expect(zombiesMarked).toBe(3);
    });

    it("should save registry after marking zombies", async () => {
      const aliveCallback = () => false;
      await registry.cleanupZombieProcesses(aliveCallback);

      const content = await fs.readFile(registryPath, "utf-8");
      const data = JSON.parse(content);
      expect(data.processes[11111].isZombie).toBe(true);
    });
  });

  describe("removeZombies", () => {
    beforeEach(async () => {
      await registry.register(11111, -11111, {
        type: "task",
        metadata: { taskId: "task-111" },
      });
      await registry.register(22222, -22222, {
        type: "daemon",
        metadata: { name: "talos-daemon" },
      });

      // Mark one as zombie
      const process = await registry.get(11111);
      if (process) {
        process.isZombie = true;
      }
    });

    it("should remove all zombie processes", async () => {
      const removed = await registry.removeZombies();
      expect(removed).toBe(1);

      const process11111 = await registry.get(11111);
      expect(process11111).toBeUndefined();

      const process22222 = await registry.get(22222);
      expect(process22222).toBeDefined();
    });

    it("should return 0 when no zombies", async () => {
      // Remove the zombie we just created
      await registry.removeZombies();

      const removed = await registry.removeZombies();
      expect(removed).toBe(0);
    });
  });

  describe("getZombies", () => {
    beforeEach(async () => {
      await registry.register(11111, -11111, {
        type: "task",
        metadata: { taskId: "task-111" },
      });
      await registry.register(22222, -22222, {
        type: "daemon",
        metadata: { name: "talos-daemon" },
      });

      // Mark one as zombie
      const process = await registry.get(11111);
      if (process) {
        process.isZombie = true;
      }
    });

    it("should return only zombie processes", async () => {
      const zombies = await registry.getZombies();
      expect(zombies).toHaveLength(1);
      expect(zombies[0].pid).toBe(11111);
    });
  });

  describe("countByType", () => {
    beforeEach(async () => {
      await registry.register(11111, -11111, {
        type: "task",
        metadata: { taskId: "task-111" },
      });
      await registry.register(22222, -22222, {
        type: "task",
        metadata: { taskId: "task-222" },
      });
      await registry.register(33333, -33333, {
        type: "daemon",
        metadata: { name: "talos-daemon" },
      });
    });

    it("should count processes by type", async () => {
      const taskCount = await registry.countByType("task");
      expect(taskCount).toBe(2);

      const daemonCount = await registry.countByType("daemon");
      expect(daemonCount).toBe(1);

      const uiCount = await registry.countByType("ui");
      expect(uiCount).toBe(0);
    });
  });

  describe("totalCount", () => {
    it("should return 0 when no processes", async () => {
      const count = await registry.totalCount();
      expect(count).toBe(0);
    });

    it("should return total process count", async () => {
      await registry.register(11111, -11111, {
        type: "task",
        metadata: { taskId: "task-111" },
      });
      await registry.register(22222, -22222, {
        type: "daemon",
        metadata: { name: "talos-daemon" },
      });

      const count = await registry.totalCount();
      expect(count).toBe(2);
    });
  });

  describe("clear", () => {
    it("should clear all processes", async () => {
      await registry.register(11111, -11111, {
        type: "task",
        metadata: { taskId: "task-111" },
      });
      await registry.register(22222, -22222, {
        type: "daemon",
        metadata: { name: "talos-daemon" },
      });

      await registry.clear();

      const count = await registry.totalCount();
      expect(count).toBe(0);

      const content = await fs.readFile(registryPath, "utf-8");
      const data = JSON.parse(content);
      expect(Object.keys(data.processes)).toHaveLength(0);
    });
  });

  describe("getStats", () => {
    beforeEach(async () => {
      await registry.register(11111, -11111, {
        type: "task",
        metadata: { taskId: "task-111" },
      });
      await registry.register(22222, -22222, {
        type: "task",
        metadata: { taskId: "task-222" },
      });
      await registry.register(33333, -33333, {
        type: "daemon",
        metadata: { name: "talos-daemon" },
      });

      // Mark one as zombie
      const process = await registry.get(11111);
      if (process) {
        process.isZombie = true;
      }
    });

    it("should return registry statistics", async () => {
      const stats = await registry.getStats();
      expect(stats.totalCount).toBe(3);
      expect(stats.zombieCount).toBe(1);
      expect(stats.countsByType.task).toBe(2);
      expect(stats.countsByType.daemon).toBe(1);
      expect(stats.countsByType.ui).toBe(0);
      expect(stats.countsByType.ralph).toBe(0);
    });
  });

  describe("persistence", () => {
    it("should load existing registry from disk", async () => {
      // Create a registry and add a process
      await registry.register(12345, -12345, {
        type: "task",
        metadata: { taskId: "task-123" },
      });

      // Create a new registry instance (should load from disk)
      const registry2 = new ProcessRegistry({
        basePath: tempDir,
      });
      await registry2.init();

      const process = await registry2.get(12345);
      expect(process).toBeDefined();
      expect(process?.pid).toBe(12345);
      expect(process?.type).toBe("task");
    });

    it("should handle missing registry file gracefully", async () => {
      // Delete registry file
      await fs.unlink(registryPath).catch(() => {});

      // Create new registry (should start with empty state)
      const registry2 = new ProcessRegistry({
        basePath: tempDir,
      });
      await registry2.init();

      const count = await registry2.totalCount();
      expect(count).toBe(0);
    });

    it("should use atomic writes", async () => {
      // Register a process
      await registry.register(12345, -12345, {
        type: "task",
        metadata: { taskId: "task-123" },
      });

      // Verify the temp file was cleaned up (atomic write)
      const tempPath = `${registryPath}.tmp`;
      const tempExists = await fs
        .access(tempPath)
        .then(() => true)
        .catch(() => false);
      expect(tempExists).toBe(false);

      // Verify the main file exists
      const mainExists = await fs
        .access(registryPath)
        .then(() => true)
        .catch(() => false);
      expect(mainExists).toBe(true);
    });
  });
});
