import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { LocalStorageEngine } from "./storage";

describe("LocalStorageEngine - JSON Operations", () => {
  let tempDir: string;
  let storage: LocalStorageEngine;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "storage-test-"));
    storage = new LocalStorageEngine(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("readJSON<T>", () => {
    it("should read and parse JSON file correctly", async () => {
      const testData = { name: "Test", value: 42, nested: { key: "value" } };
      const filePath = "test.json";

      // Write test file
      await storage.writeJSON(filePath, testData);

      // Read it back
      const result = await storage.readJSON<typeof testData>(filePath);

      expect(result).toEqual(testData);
      expect(result?.name).toBe("Test");
      expect(result?.value).toBe(42);
      expect(result?.nested.key).toBe("value");
    });

    it("should return null when file does not exist", async () => {
      const result = await storage.readJSON<{ name: string }>("non-existent.json");

      expect(result).toBeNull();
    });

    it("should throw error for invalid JSON content", async () => {
      const filePath = "invalid.json";
      const fullPath = path.join(tempDir, filePath);

      // Write invalid JSON
      await fs.writeFile(fullPath, "{ invalid json }", "utf-8");

      await expect(storage.readJSON(filePath)).rejects.toThrow();
    });

    it("should handle empty JSON object", async () => {
      const filePath = "empty.json";
      await storage.writeJSON(filePath, {});

      const result = await storage.readJSON<{}>(filePath);

      expect(result).toEqual({});
    });

    it("should handle JSON array", async () => {
      const filePath = "array.json";
      const testData = [1, 2, 3, { name: "test" }];
      await storage.writeJSON(filePath, testData);

      const result = await storage.readJSON<typeof testData>(filePath);

      expect(result).toEqual(testData);
      expect(result?.length).toBe(4);
    });
  });

  describe("writeJSON<T>", () => {
    it("should write JSON file with correct formatting", async () => {
      const testData = { name: "Test", value: 42 };
      const filePath = "test.json";
      const fullPath = path.join(tempDir, filePath);

      await storage.writeJSON(filePath, testData);

      // Read file directly to verify formatting
      const content = await fs.readFile(fullPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed).toEqual(testData);
      // Check for pretty-printing (2 spaces)
      expect(content).toBe('{\n  "name": "Test",\n  "value": 42\n}');
    });

    it("should auto-create directory if it does not exist", async () => {
      const testData = { name: "Test" };
      const filePath = "nested/dir/test.json";
      const fullPath = path.join(tempDir, filePath);

      await storage.writeJSON(filePath, testData);

      // Verify file exists
      const exists = await fs.access(fullPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Verify content
      const result = await storage.readJSON<typeof testData>(filePath);
      expect(result).toEqual(testData);
    });

    it("should overwrite existing file", async () => {
      const filePath = "test.json";

      // Write initial data
      await storage.writeJSON(filePath, { name: "Old", value: 1 });

      // Overwrite with new data
      const newData = { name: "New", value: 2 };
      await storage.writeJSON(filePath, newData);

      // Verify it was overwritten
      const result = await storage.readJSON<typeof newData>(filePath);
      expect(result).toEqual(newData);
      expect(result?.name).toBe("New");
      expect(result?.value).toBe(2);
    });

    it("should handle complex nested objects", async () => {
      const testData = {
        level1: {
          level2: {
            level3: {
              value: "deep",
              array: [1, 2, 3]
            }
          }
        }
      };
      const filePath = "nested.json";

      await storage.writeJSON(filePath, testData);

      const result = await storage.readJSON<typeof testData>(filePath);
      expect(result).toEqual(testData);
      expect(result?.level1.level2.level3.value).toBe("deep");
    });

    it("should handle special characters in data", async () => {
      const testData = {
        message: "Hello \"World\"",
        emoji: "🚀",
        newline: "Line 1\nLine 2",
        tab: "Col1\tCol2"
      };
      const filePath = "special.json";

      await storage.writeJSON(filePath, testData);

      const result = await storage.readJSON<typeof testData>(filePath);
      expect(result).toEqual(testData);
    });
  });
});

describe("LocalStorageEngine - Markdown and Utility Operations", () => {
  let tempDir: string;
  let storage: LocalStorageEngine;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "storage-test-"));
    storage = new LocalStorageEngine(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("readMarkdown", () => {
    it("should read markdown file correctly", async () => {
      const content = "# Title\n\nThis is **markdown** content.";
      const filePath = "test.md";

      await storage.writeMarkdown(filePath, content);
      const result = await storage.readMarkdown(filePath);

      expect(result).toBe(content);
    });

    it("should return null when file does not exist", async () => {
      const result = await storage.readMarkdown("non-existent.md");
      expect(result).toBeNull();
    });

    it("should handle multiline markdown", async () => {
      const content = `# Header

## Subheader

- Item 1
- Item 2

\`\`\`javascript
const x = 42;
\`\`\`
`;
      const filePath = "multiline.md";

      await storage.writeMarkdown(filePath, content);
      const result = await storage.readMarkdown(filePath);

      expect(result).toBe(content);
    });
  });

  describe("writeMarkdown", () => {
    it("should write markdown file correctly", async () => {
      const content = "# Test Markdown\n\nContent here.";
      const filePath = "test.md";
      const fullPath = path.join(tempDir, filePath);

      await storage.writeMarkdown(filePath, content);

      const fileContent = await fs.readFile(fullPath, "utf-8");
      expect(fileContent).toBe(content);
    });

    it("should auto-create directory for markdown file", async () => {
      const content = "# Nested Markdown";
      const filePath = "nested/dir/test.md";
      const fullPath = path.join(tempDir, filePath);

      await storage.writeMarkdown(filePath, content);

      const exists = await fs.access(fullPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it("should overwrite existing markdown file", async () => {
      const filePath = "test.md";

      await storage.writeMarkdown(filePath, "Old content");
      await storage.writeMarkdown(filePath, "New content");

      const result = await storage.readMarkdown(filePath);
      expect(result).toBe("New content");
    });
  });

  describe("deleteFile", () => {
    it("should delete file successfully", async () => {
      const filePath = "to-delete.json";
      await storage.writeJSON(filePath, { test: true });

      const fullPath = path.join(tempDir, filePath);

      // Verify file exists
      let exists = await fs.access(fullPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Delete file
      await storage.deleteFile(filePath);

      // Verify file is deleted
      exists = await fs.access(fullPath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it("should not throw error when deleting non-existent file", async () => {
      await expect(storage.deleteFile("non-existent.json")).resolves.not.toThrow();
    });

    it("should delete markdown file", async () => {
      const filePath = "test.md";
      await storage.writeMarkdown(filePath, "# Test");

      const fullPath = path.join(tempDir, filePath);
      await storage.deleteFile(filePath);

      const exists = await fs.access(fullPath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });
  });

  describe("fileExists", () => {
    it("should return true when file exists", async () => {
      const filePath = "exists.json";
      await storage.writeJSON(filePath, { test: true });

      const exists = await storage.fileExists(filePath);
      expect(exists).toBe(true);
    });

    it("should return false when file does not exist", async () => {
      const exists = await storage.fileExists("non-existent.json");
      expect(exists).toBe(false);
    });

    it("should return true for markdown file", async () => {
      const filePath = "test.md";
      await storage.writeMarkdown(filePath, "# Test");

      const exists = await storage.fileExists(filePath);
      expect(exists).toBe(true);
    });

    it("should return false for deleted file", async () => {
      const filePath = "temp.json";
      await storage.writeJSON(filePath, { temp: true });

      await storage.deleteFile(filePath);

      const exists = await storage.fileExists(filePath);
      expect(exists).toBe(false);
    });
  });

  describe("listFiles", () => {
    it("should list all files in directory", async () => {
      await storage.writeJSON("file1.json", { id: 1 });
      await storage.writeJSON("file2.json", { id: 2 });
      await storage.writeMarkdown("readme.md", "# Readme");

      const files = await storage.listFiles("");

      expect(files).toHaveLength(3);
      expect(files).toContain("file1.json");
      expect(files).toContain("file2.json");
      expect(files).toContain("readme.md");
    });

    it("should filter files by extension", async () => {
      await storage.writeJSON("data1.json", { id: 1 });
      await storage.writeJSON("data2.json", { id: 2 });
      await storage.writeMarkdown("readme.md", "# Readme");
      await storage.writeMarkdown("doc.md", "# Doc");

      const jsonFiles = await storage.listFiles("", ".json");
      const mdFiles = await storage.listFiles("", ".md");

      expect(jsonFiles).toHaveLength(2);
      expect(jsonFiles).toContain("data1.json");
      expect(jsonFiles).toContain("data2.json");

      expect(mdFiles).toHaveLength(2);
      expect(mdFiles).toContain("readme.md");
      expect(mdFiles).toContain("doc.md");
    });

    it("should return empty array when directory does not exist", async () => {
      const files = await storage.listFiles("non-existent");
      expect(files).toEqual([]);
    });

    it("should list files in nested directory", async () => {
      await storage.writeJSON("nested/file1.json", { id: 1 });
      await storage.writeJSON("nested/file2.json", { id: 2 });

      const files = await storage.listFiles("nested");

      expect(files).toHaveLength(2);
      expect(files).toContain("file1.json");
      expect(files).toContain("file2.json");
    });

    it("should filter files in nested directory by extension", async () => {
      await storage.writeJSON("nested/data.json", { id: 1 });
      await storage.writeMarkdown("nested/readme.md", "# Readme");

      const jsonFiles = await storage.listFiles("nested", ".json");

      expect(jsonFiles).toHaveLength(1);
      expect(jsonFiles).toContain("data.json");
    });
  });

  describe("getFileStats", () => {
    it("should return file stats for existing file", async () => {
      const filePath = "test.json";
      await storage.writeJSON(filePath, { test: true });

      const stats = await storage.getFileStats(filePath);

      expect(stats).not.toBeNull();
      expect(stats?.isFile()).toBe(true);
      expect(stats?.size).toBeGreaterThan(0);
      expect(stats?.mtime).toBeDefined();
      expect(stats?.ctime).toBeDefined();
    });

    it("should return null for non-existent file", async () => {
      const stats = await storage.getFileStats("non-existent.json");
      expect(stats).toBeNull();
    });

    it("should return stats for markdown file", async () => {
      const filePath = "test.md";
      const content = "# Test Markdown\n\nSome content.";
      await storage.writeMarkdown(filePath, content);

      const stats = await storage.getFileStats(filePath);

      expect(stats).not.toBeNull();
      expect(stats?.isFile()).toBe(true);
      expect(stats?.size).toBe(content.length);
    });

    it("should return different mtime for modified file", async () => {
      const filePath = "test.json";

      await storage.writeJSON(filePath, { version: 1 });
      const stats1 = await storage.getFileStats(filePath);

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await storage.writeJSON(filePath, { version: 2 });
      const stats2 = await storage.getFileStats(filePath);

      if (stats1 && stats2) {
        expect(stats2.mtime.getTime()).toBeGreaterThan(stats1.mtime.getTime());
      }
    });
  });
});
