import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalStorageEngine } from "./index";
import fs from "fs/promises";
import path from "path";
import { tmpdir } from "os";

describe("LocalStorageEngine", () => {
  let tempDir: string;
  let storage: LocalStorageEngine;

  beforeEach(async () => {
    // Create a temporary directory for tests
    tempDir = path.join(tmpdir(), "talos-test-" + Math.random().toString(36).slice(2));
    await fs.mkdir(tempDir, { recursive: true });
    storage = new LocalStorageEngine(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("readJSON", () => {
    it("should read and parse JSON file", async () => {
      const testData = { name: "test", value: 42 };
      const filePath = "test.json";
      await fs.writeFile(path.join(tempDir, filePath), JSON.stringify(testData));

      const result = await storage.readJSON(filePath);
      expect(result).toEqual(testData);
    });

    it("should return null for non-existent file", async () => {
      const result = await storage.readJSON("non-existent.json");
      expect(result).toBeNull();
    });
  });

  describe("writeJSON", () => {
    it("should write JSON file and create directories", async () => {
      const testData = { name: "test", value: 42 };
      const filePath = "nested/dir/test.json";

      await storage.writeJSON(filePath, testData);

      const fullPath = path.join(tempDir, filePath);
      const content = await fs.readFile(fullPath, "utf-8");
      expect(JSON.parse(content)).toEqual(testData);
    });

    it("should overwrite existing file", async () => {
      const filePath = "test.json";
      await storage.writeJSON(filePath, { value: 1 });
      await storage.writeJSON(filePath, { value: 2 });

      const result = await storage.readJSON(filePath);
      expect(result).toEqual({ value: 2 });
    });
  });

  describe("readMarkdown", () => {
    it("should read markdown file content", async () => {
      const content = "# Test Markdown\n\nThis is a test.";
      const filePath = "test.md";
      await fs.writeFile(path.join(tempDir, filePath), content);

      const result = await storage.readMarkdown(filePath);
      expect(result).toBe(content);
    });

    it("should return null for non-existent file", async () => {
      const result = await storage.readMarkdown("non-existent.md");
      expect(result).toBeNull();
    });
  });

  describe("writeMarkdown", () => {
    it("should write markdown file", async () => {
      const content = "# Test\n\nContent";
      const filePath = "nested/test.md";

      await storage.writeMarkdown(filePath, content);

      const fullPath = path.join(tempDir, filePath);
      const result = await fs.readFile(fullPath, "utf-8");
      expect(result).toBe(content);
    });
  });

  describe("deleteFile", () => {
    it("should delete existing file", async () => {
      const filePath = "test.txt";
      const fullPath = path.join(tempDir, filePath);
      await fs.writeFile(fullPath, "content");

      await storage.deleteFile(filePath);

      const exists = await storage.fileExists(filePath);
      expect(exists).toBe(false);
    });

    it("should not throw for non-existent file", async () => {
      await expect(storage.deleteFile("non-existent.txt")).resolves.toBeUndefined();
    });
  });

  describe("fileExists", () => {
    it("should return true for existing file", async () => {
      const filePath = "test.txt";
      await fs.writeFile(path.join(tempDir, filePath), "content");

      const exists = await storage.fileExists(filePath);
      expect(exists).toBe(true);
    });

    it("should return false for non-existent file", async () => {
      const exists = await storage.fileExists("non-existent.txt");
      expect(exists).toBe(false);
    });
  });

  describe("listFiles", () => {
    it("should list all files in directory", async () => {
      const dirPath = "test-dir";
      await fs.mkdir(path.join(tempDir, dirPath));
      await fs.writeFile(path.join(tempDir, dirPath, "file1.txt"), "content1");
      await fs.writeFile(path.join(tempDir, dirPath, "file2.txt"), "content2");
      await fs.writeFile(path.join(tempDir, dirPath, "file3.md"), "content3");

      const files = await storage.listFiles(dirPath);
      expect(files).toHaveLength(3);
      expect(files).toContain("file1.txt");
      expect(files).toContain("file2.txt");
      expect(files).toContain("file3.md");
    });

    it("should filter files by extension", async () => {
      const dirPath = "test-dir";
      await fs.mkdir(path.join(tempDir, dirPath));
      await fs.writeFile(path.join(tempDir, dirPath, "file1.txt"), "content1");
      await fs.writeFile(path.join(tempDir, dirPath, "file2.md"), "content2");

      const txtFiles = await storage.listFiles(dirPath, ".txt");
      expect(txtFiles).toHaveLength(1);
      expect(txtFiles[0]).toBe("file1.txt");

      const mdFiles = await storage.listFiles(dirPath, ".md");
      expect(mdFiles).toHaveLength(1);
      expect(mdFiles[0]).toBe("file2.md");
    });

    it("should return empty array for non-existent directory", async () => {
      const files = await storage.listFiles("non-existent");
      expect(files).toEqual([]);
    });
  });
});
