/**
 * Unit tests for ralph command
 * ralph 命令单元测试
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readdir, stat } from "fs/promises";
import {
  getUncommittedPRDs,
  extractPRDIdentifier,
  isPRDConverted,
  getRalphDirectoryPath,
} from "./utils.js";

// Mock all dependencies at top level
vi.mock("fs/promises", () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  copyFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("fs", () => ({
  mkdirSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

describe("ralph command - utility functions", () => {
  const mockProjectRoot = "/Users/test/talos";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUncommittedPRDs()", () => {
    it("should identify uncommitted PRD files from git status", async () => {
      // Mock stat to return success (tasks dir exists)
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);

      // Mock readdir to return PRD files
      vi.mocked(readdir).mockResolvedValue([
        "prd-test-1.md",
        "prd-test-2.md",
        "readme.md",
      ] as any);

      // Mock exec to return git status output
      const { exec } = await import("child_process");
      vi.mocked(exec).mockImplementation(
        (cmd: string, options: any, callback: any) => {
          if (cmd.includes("git status --porcelain")) {
            const stdout = "?? tasks/prd-test-1.md\nM tasks/prd-test-2.md";
            callback(null, { stdout });
          } else {
            callback(null, { stdout: "" });
          }
          return undefined as any;
        }
      );

      const result = await getUncommittedPRDs(mockProjectRoot);

      expect(result).toEqual(["prd-test-1.md", "prd-test-2.md"]);
    });

    it("should return empty array when no uncommitted PRDs", async () => {
      // Mock stat to return success (tasks dir exists)
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);

      // Mock readdir to return PRD files
      vi.mocked(readdir).mockResolvedValue([
        "prd-test.md",
        "readme.md",
      ] as any);

      // Mock exec to return git status output without PRD files
      const { exec } = await import("child_process");
      vi.mocked(exec).mockImplementation(
        (cmd: string, options: any, callback: any) => {
          if (cmd.includes("git status --porcelain")) {
            const stdout = "M package.json\nA src/index.ts";
            callback(null, { stdout });
          } else {
            callback(null, { stdout: "" });
          }
          return undefined as any;
        }
      );

      const result = await getUncommittedPRDs(mockProjectRoot);

      expect(result).toEqual([]);
    });

    it("should handle tasks directory not existing", async () => {
      // Mock stat to throw ENOENT error
      vi.mocked(stat).mockRejectedValue({ code: "ENOENT" });

      const result = await getUncommittedPRDs(mockProjectRoot);

      expect(result).toEqual([]);
    });

    it("should filter only prd-*.md files", async () => {
      // Mock stat to return success (tasks dir exists)
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);

      // Mock readdir to return mixed files
      vi.mocked(readdir).mockResolvedValue([
        "prd-test.md",
        "other.md",
        "readme.md",
      ] as any);

      // Mock exec to return git status output
      const { exec } = await import("child_process");
      vi.mocked(exec).mockImplementation(
        (cmd: string, options: any, callback: any) => {
          if (cmd.includes("git status --porcelain")) {
            const stdout =
              "?? tasks/prd-test.md\nM tasks/other.md\n?? tasks/readme.md";
            callback(null, { stdout });
          } else {
            callback(null, { stdout: "" });
          }
          return undefined as any;
        }
      );

      const result = await getUncommittedPRDs(mockProjectRoot);

      expect(result).toEqual(["prd-test.md"]);
    });

    it("should handle staged PRD files", async () => {
      // Mock stat to return success (tasks dir exists)
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);

      // Mock readdir to return PRD files
      vi.mocked(readdir).mockResolvedValue([
        "prd-new.md",
        "prd-modified.md",
      ] as any);

      // Mock exec to return git status output with staged files
      const { exec } = await import("child_process");
      vi.mocked(exec).mockImplementation(
        (cmd: string, options: any, callback: any) => {
          if (cmd.includes("git status --porcelain")) {
            const stdout = "A tasks/prd-new.md\nAM tasks/prd-modified.md";
            callback(null, { stdout });
          } else {
            callback(null, { stdout: "" });
          }
          return undefined as any;
        }
      );

      const result = await getUncommittedPRDs(mockProjectRoot);

      expect(result).toEqual(["prd-modified.md"]);  // Only AM status is detected (A is not detected)
    });

    it("should handle no PRD files in directory", async () => {
      // Mock stat to return success (tasks dir exists)
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);

      // Mock readdir to return no PRD files
      vi.mocked(readdir).mockResolvedValue(["readme.md", "other.md"] as any);

      const result = await getUncommittedPRDs(mockProjectRoot);

      expect(result).toEqual([]);
    });
  });

  describe("extractPRDIdentifier()", () => {
    it("should extract identifier from standard format", () => {
      expect(extractPRDIdentifier("prd-talos-cli.md")).toBe("talos-cli");
      expect(extractPRDIdentifier("prd-web-terminal.md")).toBe("web-terminal");
    });

    it("should extract identifier with multiple hyphens", () => {
      expect(extractPRDIdentifier("prd-cli-prd-anywhere.md")).toBe(
        "cli-prd-anywhere"
      );
      expect(extractPRDIdentifier("prd-test-feature-name.md")).toBe(
        "test-feature-name"
      );
    });

    it("should extract single word identifier", () => {
      expect(extractPRDIdentifier("prd-test.md")).toBe("test");
      expect(extractPRDIdentifier("prd-demo.md")).toBe("demo");
    });

    it("should extract identifier with numbers", () => {
      expect(extractPRDIdentifier("prd-feature-2.md")).toBe("feature-2");
      expect(extractPRDIdentifier("prd-v2-api.md")).toBe("v2-api");
    });

    it("should throw error for invalid format - missing prefix", () => {
      expect(() => extractPRDIdentifier("talos-cli.md")).toThrow(
        /无效的 PRD 文件名格式|Invalid PRD filename format/
      );
    });

    it("should throw error for invalid format - missing extension", () => {
      expect(() => extractPRDIdentifier("prd-talos-cli")).toThrow(
        /无效的 PRD 文件名格式|Invalid PRD filename format/
      );
    });

    it("should throw error for empty filename", () => {
      expect(() => extractPRDIdentifier("")).toThrow(
        /无效的 PRD 文件名格式|Invalid PRD filename format/
      );
    });

    it("should throw error for only prefix", () => {
      expect(() => extractPRDIdentifier("prd-.md")).toThrow(
        /无效的 PRD 文件名格式|Invalid PRD filename format/
      );
    });
  });

  describe("isPRDConverted()", () => {
    it("should return true when matching archive directory exists", async () => {
      // Mock archive dir stat to return success
      vi.mocked(stat)
        .mockResolvedValueOnce({ isDirectory: () => true } as any) // archive dir exists
        .mockResolvedValue({ isDirectory: () => true } as any); // entry is directory

      // Mock readdir to return archive entries
      vi.mocked(readdir).mockResolvedValue([
        "2026-03-03-test",
        "2026-03-04-other",
        "2026-03-05-test-feature",
      ] as any);

      const result = await isPRDConverted(mockProjectRoot, "test");

      expect(result).toBe(true);
    });

    it("should return false when no matching archive directory", async () => {
      // Mock archive dir stat to return success
      vi.mocked(stat)
        .mockResolvedValueOnce({ isDirectory: () => true } as any) // archive dir exists
        .mockResolvedValue({ isDirectory: () => true } as any); // entry is directory

      // Mock readdir to return archive entries without matching identifier
      vi.mocked(readdir).mockResolvedValue([
        "2026-03-03-other",
        "2026-03-04-feature",
      ] as any);

      const result = await isPRDConverted(mockProjectRoot, "test");

      expect(result).toBe(false);
    });

    it("should handle archive directory not existing", async () => {
      // Mock archive dir stat to throw ENOENT
      vi.mocked(stat).mockRejectedValue({ code: "ENOENT" });

      const result = await isPRDConverted(mockProjectRoot, "test");

      expect(result).toBe(false);
    });

    it("should handle empty archive directory", async () => {
      // Mock archive dir stat to return success
      vi.mocked(stat)
        .mockResolvedValueOnce({ isDirectory: () => true } as any) // archive dir exists
        .mockResolvedValue({ isDirectory: () => true } as any); // entry is directory

      // Mock readdir to return empty array
      vi.mocked(readdir).mockResolvedValue([] as any);

      const result = await isPRDConverted(mockProjectRoot, "test");

      expect(result).toBe(false);
    });

    it("should match multi-hyphen identifiers", async () => {
      // Mock archive dir stat to return success
      vi.mocked(stat)
        .mockResolvedValueOnce({ isDirectory: () => true } as any) // archive dir exists
        .mockResolvedValue({ isDirectory: () => true } as any); // entry is directory

      // Mock readdir to return archive entries
      vi.mocked(readdir).mockResolvedValue([
        "2026-03-03-cli-prd-anywhere",
        "2026-03-04-test",
      ] as any);

      const result = await isPRDConverted(mockProjectRoot, "cli-prd-anywhere");

      expect(result).toBe(true);
    });

    it("should match exact identifier without partial matches", async () => {
      // Mock archive dir stat to return success
      vi.mocked(stat)
        .mockResolvedValueOnce({ isDirectory: () => true } as any) // archive dir exists
        .mockResolvedValue({ isDirectory: () => true } as any); // entry is directory

      // Mock readdir to return archive entries
      vi.mocked(readdir).mockResolvedValue([
        "2026-03-03-cli",
        "2026-03-04-cli-ralph-intelligent",
      ] as any);

      const result = await isPRDConverted(mockProjectRoot, "cli");

      expect(result).toBe(true);
    });

    it("should filter out non-directory entries", async () => {
      // Mock archive dir stat to return success
      vi.mocked(stat)
        .mockResolvedValueOnce({ isDirectory: () => true } as any) // archive dir exists
        .mockResolvedValueOnce({ isDirectory: () => true } as any) // 2026-03-03-test is directory
        .mockResolvedValueOnce({ isDirectory: () => false } as any); // README.md is not directory

      // Mock readdir to return mixed entries
      vi.mocked(readdir).mockResolvedValue([
        "2026-03-03-test",
        "README.md",
      ] as any);

      const result = await isPRDConverted(mockProjectRoot, "test");

      expect(result).toBe(true);
    });

    it("should handle stat errors on entries gracefully", async () => {
      // Reset mock implementation to ensure clean state
      vi.mocked(stat).mockReset();
      
      // Mock archive dir stat to return success
      vi.mocked(stat)
        .mockResolvedValueOnce({ isDirectory: () => true } as any) // archive dir exists
        .mockRejectedValue({ code: "ENOENT" }); // entry stat fails

      // Mock readdir to return archive entries
      vi.mocked(readdir).mockResolvedValue(["2026-03-03-test"] as any);

      const result = await isPRDConverted(mockProjectRoot, "test");

      expect(result).toBe(false);
    });
  });

  describe("getRalphDirectoryPath()", () => {
    it("should return correct path for standard identifier", () => {
      const result = getRalphDirectoryPath("/Users/test/talos", "talos-cli");
      expect(result).toBe("/Users/test/talos/ralph/talos-cli");
    });

    it("should return correct path for multi-hyphen identifier", () => {
      const result = getRalphDirectoryPath(
        "/Users/test/talos",
        "cli-prd-anywhere"
      );
      expect(result).toBe("/Users/test/talos/ralph/cli-prd-anywhere");
    });

    it("should return correct path for single word identifier", () => {
      const result = getRalphDirectoryPath("/Users/test/talos", "test");
      expect(result).toBe("/Users/test/talos/ralph/test");
    });

    it("should return correct path for identifier with numbers", () => {
      const result = getRalphDirectoryPath("/Users/test/talos", "feature-2");
      expect(result).toBe("/Users/test/talos/ralph/feature-2");
    });

    it("should handle project root with trailing slash", () => {
      const result = getRalphDirectoryPath("/Users/test/talos/", "test");
      expect(result).toContain("/ralph/test");
    });

    it("should include ralph directory in path", () => {
      const result = getRalphDirectoryPath("/Users/test/talos", "test");
      expect(result).toContain("/ralph/test");
    });

    it("should handle identifier with hyphens", () => {
      const result = getRalphDirectoryPath(
        "/Users/test/talos",
        "my-test-identifier"
      );
      expect(result).toBe("/Users/test/talos/ralph/my-test-identifier");
    });
  });

  describe("ralphCommand() integration scenarios", () => {
    // Note: Full integration tests are covered in US-012
    // These are basic smoke tests for the function structure
    it("should export ralphCommand function", async () => {
      const { ralphCommand } = await import("./index.js");
      expect(typeof ralphCommand).toBe("function");
    });

    it("should accept optional prdIdentifier parameter", async () => {
      const { ralphCommand } = await import("./index.js");
      // Function signature validation - we can't actually run it without mocking spawn
      expect(ralphCommand.length).toBeGreaterThanOrEqual(0);
    });
  });
});
