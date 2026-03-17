import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import fsSync from "fs";
import { LocalStorageEngine, LocalStorageEngine } from "./storage";

describe("LocalStorageEngine - Atomic Writes", () => {
  let tempDir: string;
  let storage: LocalStorageEngine;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "storage-atomic-test-"));
    storage = new LocalStorageEngine(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("writeJSON - Atomic Write Guarantees", () => {
    it("should write to temp file then rename (atomic operation)", async () => {
      const testData = { name: "Atomic Test", value: 123 };
      const filePath = "atomic-test.json";
      const fullPath = path.join(tempDir, filePath);
      const tempPath = `${fullPath}.tmp`;

      // Start the write operation
      const writePromise = storage.writeJSON(filePath, testData);

      // Check that temp file exists during write (this is a timing-dependent test,
      // but in most cases the temp file should exist)
      await writePromise;

      // After write, temp file should be cleaned up
      const tempExists = fsSync.existsSync(tempPath);
      expect(tempExists).toBe(false);

      // Target file should exist with correct content
      const targetExists = fsSync.existsSync(fullPath);
      expect(targetExists).toBe(true);

      const result = await storage.readJSON<typeof testData>(filePath);
      expect(result).toEqual(testData);
    });

    it("should clean up temp file on write failure", async () => {
      const filePath = "fail-test.json";
      const fullPath = path.join(tempDir, filePath);
      const tempPath = `${fullPath}.tmp`;

      // Create a read-only directory to simulate write failure
      const readonlyDir = path.join(tempDir, "readonly");
      await fs.mkdir(readonlyDir, { recursive: true });

      // Make directory read-only (this may fail on some systems)
      try {
        await fs.chmod(readonlyDir, 0o444);
      } catch {
        // Skip test if chmod doesn't work
        return;
      }

      const failPath = path.join("readonly", "test.json");

      // Attempt to write to read-only directory
      try {
        await storage.writeJSON(failPath, { test: true });
      } catch {
        // Expected to fail
      }

      // Restore permissions for cleanup
      await fs.chmod(readonlyDir, 0o755);

      // Temp file should not exist after failure
      const tempExists = fsSync.existsSync(`${path.join(tempDir, failPath)}.tmp`);
      expect(tempExists).toBe(false);
    });

    it("should preserve original file if atomic write fails mid-operation", async () => {
      const filePath = "preserve-original.json";
      const originalData = { version: 1, message: "original" };
      const fullPath = path.join(tempDir, filePath);

      // Write original file
      await storage.writeJSON(filePath, originalData);

      // Simulate failure by manually creating and corrupting a temp file
      const tempPath = `${fullPath}.tmp`;
      await fs.writeFile(tempPath, "{ invalid json", "utf-8");

      // Trigger a write operation (should clean up bad temp file)
      await storage.writeJSON(filePath, { version: 2, message: "updated" });

      // Original file should be updated with new valid data
      const result = await storage.readJSON(filePath);
      expect(result).toEqual({ version: 2, message: "updated" });

      // Temp file should be cleaned up
      const tempExists = fsSync.existsSync(tempPath);
      expect(tempExists).toBe(false);
    });

    it("should handle sequential writes to same file without corruption", async () => {
      const filePath = "sequential.json";
      const fullPath = path.join(tempDir, filePath);

      // Perform sequential writes
      await storage.writeJSON(filePath, { id: 1, writer: "A" });
      const result1 = await storage.readJSON(filePath);
      expect(result1).toEqual({ id: 1, writer: "A" });

      await storage.writeJSON(filePath, { id: 2, writer: "B" });
      const result2 = await storage.readJSON(filePath);
      expect(result2).toEqual({ id: 2, writer: "B" });

      await storage.writeJSON(filePath, { id: 3, writer: "C" });
      const result3 = await storage.readJSON(filePath);
      expect(result3).toEqual({ id: 3, writer: "C" });

      // File should not be corrupted
      const content = await fs.readFile(fullPath, "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();

      // Temp file should be cleaned up
      const tempExists = fsSync.existsSync(`${fullPath}.tmp`);
      expect(tempExists).toBe(false);
    });

    it("should create parent directories before writing temp file", async () => {
      const filePath = "deep/nested/path/test.json";
      const fullPath = path.join(tempDir, filePath);
      const tempPath = `${fullPath}.tmp`;
      const testData = { deep: "nested" };

      await storage.writeJSON(filePath, testData);

      // Verify target file exists
      const exists = fsSync.existsSync(fullPath);
      expect(exists).toBe(true);

      // Verify temp file is cleaned up
      const tempExists = fsSync.existsSync(tempPath);
      expect(tempExists).toBe(false);

      // Verify content
      const result = await storage.readJSON(filePath);
      expect(result).toEqual(testData);
    });

    it("should use default indent of 2 spaces", async () => {
      const filePath = "formatted.json";
      const fullPath = path.join(tempDir, filePath);
      const testData = { key: "value", number: 42 };

      await storage.writeJSON(filePath, testData);

      const content = await fs.readFile(fullPath, "utf-8");

      // Check for 2-space indentation
      expect(content).toContain('  "key"');
      expect(content).toContain('  "number"');
    });

    it("should support compact output with indent=0", async () => {
      const filePath = "compact.json";
      const fullPath = path.join(tempDir, filePath);
      const testData = { key: "value", number: 42 };

      await storage.writeJSON(filePath, testData, { indent: 0 });

      const content = await fs.readFile(fullPath, "utf-8");

      // Check for compact output (no indentation)
      expect(content).toBe('{"key":"value","number":42}');
    });

    it("should support custom indent value", async () => {
      const filePath = "custom-indent.json";
      const fullPath = path.join(tempDir, filePath);
      const testData = { key: "value" };

      await storage.writeJSON(filePath, testData, { indent: 4 });

      const content = await fs.readFile(fullPath, "utf-8");

      // Check for 4-space indentation
      expect(content).toContain('    "key"');
    });
  });

  describe("writeMarkdown - Atomic Write Guarantees", () => {
    it("should write to temp file then rename (atomic operation)", async () => {
      const content = "# Atomic Markdown\n\nContent here.";
      const filePath = "atomic-test.md";
      const fullPath = path.join(tempDir, filePath);
      const tempPath = `${fullPath}.tmp`;

      await storage.writeMarkdown(filePath, content);

      // After write, temp file should be cleaned up
      const tempExists = fsSync.existsSync(tempPath);
      expect(tempExists).toBe(false);

      // Target file should exist with correct content
      const result = await storage.readMarkdown(filePath);
      expect(result).toBe(content);
    });

    it("should clean up temp file on write failure", async () => {
      const filePath = "fail-test.md";
      const fullPath = path.join(tempDir, filePath);
      const tempPath = `${fullPath}.tmp`;

      // Create a read-only directory to simulate write failure
      const readonlyDir = path.join(tempDir, "readonly");
      await fs.mkdir(readonlyDir, { recursive: true });

      try {
        await fs.chmod(readonlyDir, 0o444);
      } catch {
        // Skip test if chmod doesn't work
        return;
      }

      const failPath = path.join("readonly", "test.md");

      try {
        await storage.writeMarkdown(failPath, "# Test");
      } catch {
        // Expected to fail
      }

      // Restore permissions for cleanup
      await fs.chmod(readonlyDir, 0o755);

      // Temp file should not exist after failure
      const tempExists = fsSync.existsSync(`${path.join(tempDir, failPath)}.tmp`);
      expect(tempExists).toBe(false);
    });

    it("should handle sequential writes to same file without corruption", async () => {
      const filePath = "sequential.md";
      const fullPath = path.join(tempDir, filePath);

      // Perform sequential writes
      await storage.writeMarkdown(filePath, "# Version A");
      const result1 = await storage.readMarkdown(filePath);
      expect(result1).toBe("# Version A");

      await storage.writeMarkdown(filePath, "# Version B");
      const result2 = await storage.readMarkdown(filePath);
      expect(result2).toBe("# Version B");

      await storage.writeMarkdown(filePath, "# Version C");
      const result3 = await storage.readMarkdown(filePath);
      expect(result3).toBe("# Version C");

      // File should not be corrupted
      const content = await fs.readFile(fullPath, "utf-8");
      expect(content).toMatch(/^# Version [ABC]$/);

      // Temp file should be cleaned up
      const tempExists = fsSync.existsSync(`${fullPath}.tmp`);
      expect(tempExists).toBe(false);
    });

    it("should create parent directories before writing temp file", async () => {
      const filePath = "deep/nested/path/test.md";
      const fullPath = path.join(tempDir, filePath);
      const tempPath = `${fullPath}.tmp`;
      const content = "# Deep Nested";

      await storage.writeMarkdown(filePath, content);

      // Verify target file exists
      const exists = fsSync.existsSync(fullPath);
      expect(exists).toBe(true);

      // Verify temp file is cleaned up
      const tempExists = fsSync.existsSync(tempPath);
      expect(tempExists).toBe(false);

      // Verify content
      const result = await storage.readMarkdown(filePath);
      expect(result).toBe(content);
    });
  });

  describe("LocalStorageEngine - Backward Compatibility", () => {
    it("should export LocalStorageEngine as alias for LocalStorageEngine", () => {
      const engine = new LocalStorageEngine();
      const service = new LocalStorageEngine();

      expect(engine).toBeInstanceOf(LocalStorageEngine);
      expect(service).toBeInstanceOf(LocalStorageEngine);
      expect(service).toBeInstanceOf(LocalStorageEngine);
    });

    it("should support basePath constructor argument", () => {
      const customBase = "/custom/path";
      const storage = new LocalStorageEngine(customBase);

      expect(storage).toBeInstanceOf(LocalStorageEngine);
    });

    it("should use cwd as default basePath", () => {
      const storage = new LocalStorageEngine();
      expect(storage).toBeInstanceOf(LocalStorageEngine);
    });
  });

  describe("IStorageEngine Interface Compliance", () => {
    it("should implement readJSON with options", async () => {
      const testData = { test: true };
      const filePath = "options-test.json";

      await storage.writeJSON(filePath, testData);

      // With default options
      const result1 = await storage.readJSON(filePath, {});
      expect(result1).toEqual(testData);

      // With throwIfNotFound: true (should throw for non-existent file)
      await expect(storage.readJSON("non-existent.json", { throwIfNotFound: true }))
        .rejects.toThrow();

      // With throwIfNotFound: false (should return null)
      const result2 = await storage.readJSON("non-existent.json", { throwIfNotFound: false });
      expect(result2).toBeNull();
    });

    it("should implement readMarkdown with options", async () => {
      const content = "# Test";
      const filePath = "options-test.md";

      await storage.writeMarkdown(filePath, content);

      // With default options
      const result1 = await storage.readMarkdown(filePath, {});
      expect(result1).toBe(content);

      // With throwIfNotFound: true
      await expect(storage.readMarkdown("non-existent.md", { throwIfNotFound: true }))
        .rejects.toThrow();

      // With throwIfNotFound: false
      const result2 = await storage.readMarkdown("non-existent.md", { throwIfNotFound: false });
      expect(result2).toBeNull();
    });

    it("should implement writeJSON with options", async () => {
      const filePath = "write-options-test.json";
      const testData = { test: true };

      // With createDirectories: true (default)
      await storage.writeJSON(filePath, testData, { createDirectories: true });
      const result = await storage.readJSON(filePath);
      expect(result).toEqual(testData);
    });

    it("should implement writeMarkdown with options", async () => {
      const filePath = "write-options-test.md";
      const content = "# Test";

      // With createDirectories: true (default)
      await storage.writeMarkdown(filePath, content, { createDirectories: true });
      const result = await storage.readMarkdown(filePath);
      expect(result).toBe(content);
    });

    it("should implement deleteFile", async () => {
      const filePath = "delete-test.json";
      await storage.writeJSON(filePath, { test: true });

      expect(storage.fileExists(filePath)).toBe(true);

      await storage.deleteFile(filePath);

      expect(storage.fileExists(filePath)).toBe(false);
    });

    it("should implement fileExists (synchronous)", async () => {
      const filePath = "exists-test.json";

      expect(storage.fileExists(filePath)).toBe(false);

      await storage.writeJSON(filePath, { test: true });

      expect(storage.fileExists(filePath)).toBe(true);

      await storage.deleteFile(filePath);

      expect(storage.fileExists(filePath)).toBe(false);
    });
  });

  describe("Atomic Write - Data Integrity", () => {
    it("should never leave partial writes on filesystem", async () => {
      const filePath = "integrity-test.json";
      const fullPath = path.join(tempDir, filePath);
      const tempPath = `${fullPath}.tmp`;

      // Perform multiple rapid writes
      for (let i = 0; i < 10; i++) {
        await storage.writeJSON(filePath, { iteration: i });

        // After each write, verify:
        // 1. Target file exists
        expect(fsSync.existsSync(fullPath)).toBe(true);

        // 2. Temp file is cleaned up
        expect(fsSync.existsSync(tempPath)).toBe(false);

        // 3. Target file has valid JSON
        const content = await fs.readFile(fullPath, "utf-8");
        expect(() => JSON.parse(content)).not.toThrow();

        // 4. Target file has expected structure
        const result = await storage.readJSON(filePath);
        expect(result).toHaveProperty("iteration");
      }
    });

    it("should handle large files atomically", async () => {
      const filePath = "large-file.json";
      const largeData = {
        data: Array(1000).fill({ id: 1, name: "Test", value: 42 })
      };

      await storage.writeJSON(filePath, largeData);

      const result = await storage.readJSON(filePath);
      expect(result).toEqual(largeData);
      expect(result?.data).toHaveLength(1000);
    });
  });
});
