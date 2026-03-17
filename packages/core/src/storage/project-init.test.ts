import fs from "fs/promises";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initializeTalosProject } from "./project-init";

describe("project-init", () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temp directory for testing
    testDir = `${os.tmpdir()}/project-init-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("initializeTalosProject", () => {
    it("should create .talos directory", async () => {
      await initializeTalosProject(testDir);

      // Check that .talos directory exists
      const talosDir = path.join(testDir, ".talos");
      const talosExists = await fs.access(talosDir).then(() => true).catch(() => false);
      expect(talosExists).toBe(true);
    });

    it("should create initial config file with correct structure", async () => {
      await initializeTalosProject(testDir);

      const configPath = path.join(testDir, ".talos", "config.json");
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);
      expect(configExists).toBe(true);

      const configContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configContent);

      expect(config).toHaveProperty("tasks");
      expect(config).toHaveProperty("version");
      expect(config.tasks).toEqual([]);
      expect(config.version).toBe("1.0");
    });

    it("should be idempotent - multiple calls should not error", async () => {
      // First call
      await initializeTalosProject(testDir);

      // Second call should not throw
      await expect(initializeTalosProject(testDir)).resolves.not.toThrow();

      // Config should still exist and not be overwritten
      const configPath = path.join(testDir, ".talos", "config.json");
      const configContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configContent);
      expect(config.tasks).toEqual([]);
      expect(config.version).toBe("1.0");
    });

    it("should not overwrite existing config file", async () => {
      // First initialization
      await initializeTalosProject(testDir);

      // Modify the config
      const configPath = path.join(testDir, ".talos", "config.json");
      const modifiedConfig = {
        tasks: [{ id: "task-1", name: "Test Task" }],
        version: "2.0",
      };
      await fs.writeFile(configPath, JSON.stringify(modifiedConfig, null, 2));

      // Second initialization should not overwrite
      await initializeTalosProject(testDir);

      const configContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configContent);

      // Config should remain as modified
      expect(config.tasks).toEqual([{ id: "task-1", name: "Test Task" }]);
      expect(config.version).toBe("2.0");
    });

    it("should handle directory already existing gracefully", async () => {
      // Create .talos directory beforehand
      const talosDir = path.join(testDir, ".talos");
      await fs.mkdir(talosDir, { recursive: true });

      // Should not throw
      await expect(initializeTalosProject(testDir)).resolves.not.toThrow();
    });

    it("should throw error if directory creation fails", async () => {
      // Create a file instead of directory to cause failure
      const talosDir = path.join(testDir, ".talos");
      await fs.writeFile(talosDir, "this is a file, not a directory");

      // Should throw an error
      await expect(initializeTalosProject(testDir)).rejects.toThrow();
    });
  });
});
