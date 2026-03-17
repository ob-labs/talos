import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { ProgressManager, ProgressLogError } from "./progress-manager";
import { LocalStorageEngine } from "./storage";
import os from "os";

describe("ProgressManager", () => {
  let testManager: ProgressManager;
  let tempDir: string;
  let testStorage: LocalStorageEngine;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = `${os.tmpdir()}/progress-manager-test-${Date.now()}`;
    await fs.mkdir(tempDir, { recursive: true });

    // Create a custom storage instance with temp directory as base path
    testStorage = new LocalStorageEngine(tempDir);

    // Create test manager with custom storage
    testManager = new ProgressManager(testStorage);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // Helper function to write test content directly to file
  async function writeTestContent(content: string) {
    const fullPath = path.join(tempDir, "progress.txt");
    await fs.writeFile(fullPath, content, "utf-8");
  }

  // Helper function to read test content directly from file
  async function readTestContent(): Promise<string> {
    const fullPath = path.join(tempDir, "progress.txt");
    return await fs.readFile(fullPath, "utf-8");
  }

  describe("parse", () => {
    it("should return empty result for non-existent file", async () => {
      const result = await testManager.parse();
      expect(result.codebasePatterns).toEqual([]);
      expect(result.executionHistory).toEqual([]);
    });

    it("should parse codebase patterns section", async () => {
      const content = `## Codebase Patterns
- Pattern: Use TypeScript strict mode
- Gotcha: Don't forget to update Z when changing W
- Example: Always use IF NOT EXISTS for migrations

## Execution History
`;
      await writeTestContent(content);

      const result = await testManager.parse();
      expect(result.codebasePatterns).toEqual([
        "Pattern: Use TypeScript strict mode",
        "Gotcha: Don't forget to update Z when changing W",
        "Example: Always use IF NOT EXISTS for migrations",
      ]);
    });

    it("should parse execution history entries", async () => {
      const content = `## Codebase Patterns
- Pattern: Test pattern

## Execution History

## 2026-02-16 - US-001
- Created new feature
- Added tests
**Learnings for future iterations:**
- Learning 1
- Learning 2
---

## 2026-02-16 - US-002
- Fixed bug
`;
      await writeTestContent(content);

      const result = await testManager.parse();
      expect(result.executionHistory).toHaveLength(2);

      expect(result.executionHistory[0]).toEqual({
        timestamp: "2026-02-16",
        storyId: "US-001",
        status: "success",
        changes: ["Created new feature", "Added tests"],
        learnings: ["Learning 1", "Learning 2"],
      });

      expect(result.executionHistory[1]).toEqual({
        timestamp: "2026-02-16",
        storyId: "US-002",
        status: "success",
        changes: ["Fixed bug"],
        learnings: undefined,
      });
    });

    it("should parse entries with timestamp including time", async () => {
      const content = `## Execution History

## 2026-02-16 14:30:45 - US-001
- Created feature
---
`;
      await writeTestContent(content);

      const result = await testManager.parse();
      expect(result.executionHistory).toHaveLength(1);
      expect(result.executionHistory[0].timestamp).toBe("2026-02-16 14:30:45");
    });

    it("should handle entries without learnings section", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created feature
- Added tests
---
`;
      await writeTestContent(content);

      const result = await testManager.parse();
      expect(result.executionHistory[0].learnings).toBeUndefined();
    });

    it("should handle multiline learnings", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created feature
**Learnings for future iterations:**
- Learning 1: detail
- Learning 2: another detail
---
`;
      await writeTestContent(content);

      const result = await testManager.parse();
      expect(result.executionHistory[0].learnings).toEqual([
        "Learning 1: detail",
        "Learning 2: another detail",
      ]);
    });

    it("should parse both patterns and history sections", async () => {
      const content = `## Codebase Patterns
- Pattern: Use TypeScript strict mode

## Execution History

## 2026-02-16 - US-001
- Created feature
---
`;
      await writeTestContent(content);

      const result = await testManager.parse();
      expect(result.codebasePatterns).toHaveLength(1);
      expect(result.executionHistory).toHaveLength(1);
    });
  });

  describe("appendEntry", () => {
    it("should create new file with entry if file doesn't exist", async () => {
      await testManager.appendEntry("US-001", ["Created feature"], ["Learning 1"]);

      const content = await readTestContent();
      expect(content).toContain("##");
      expect(content).toContain("US-001");
      expect(content).toContain("Created feature");
      expect(content).toContain("Learning 1");
      expect(content).toContain("---");
    });

    it("should append entry to existing file", async () => {
      const existingContent = `## Codebase Patterns
- Pattern: Test pattern

## Execution History

## 2026-02-15 - US-000
- Old entry
---
`;
      await writeTestContent(existingContent);

      await testManager.appendEntry("US-001", ["New feature"], ["New learning"]);

      const content = await readTestContent();
      expect(content).toContain("US-000");
      expect(content).toContain("US-001");
      expect(content).toContain("New feature");
    });

    it("should format entry with timestamp", async () => {
      await testManager.appendEntry("US-001", ["Change 1"], []);

      const content = await readTestContent();
      const dateRegex = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;
      expect(content).toMatch(dateRegex);
    });

    it("should handle empty learnings array", async () => {
      await testManager.appendEntry("US-001", ["Change 1"], []);

      const content = await readTestContent();
      expect(content).not.toContain("**Learnings for future iterations:**");
    });

    it("should handle multiline learning text", async () => {
      await testManager.appendEntry("US-001", ["Change 1"], ["Line 1\nLine 2"]);

      const content = await readTestContent();
      expect(content).toContain("- Line 1");
      expect(content).toContain("- Line 2");
    });
  });

  describe("getContext", () => {
    it("should return patterns and recent entries", async () => {
      const content = `## Codebase Patterns
- Pattern: Test pattern 1
- Pattern: Test pattern 2

## Execution History

## 2026-02-15 - US-000
- Old entry
---

## 2026-02-16 - US-001
- New entry 1
---

## 2026-02-16 - US-002
- New entry 2
---
`;
      await writeTestContent(content);

      const context = await testManager.getContext(2);

      expect(context.patterns).toHaveLength(2);
      expect(context.patterns).toContain("Pattern: Test pattern 1");
      expect(context.patterns).toContain("Pattern: Test pattern 2");

      expect(context.recentEntries).toHaveLength(2);
      expect(context.recentEntries[0].storyId).toBe("US-001");
      expect(context.recentEntries[1].storyId).toBe("US-002");
    });

    it("should return empty context for non-existent file", async () => {
      const context = await testManager.getContext();
      expect(context.patterns).toEqual([]);
      expect(context.recentEntries).toEqual([]);
    });

    it("should respect lastEntries parameter", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Entry 1
---

## 2026-02-16 - US-002
- Entry 2
---

## 2026-02-16 - US-003
- Entry 3
---
`;
      await writeTestContent(content);

      const context = await testManager.getContext(1);
      expect(context.recentEntries).toHaveLength(1);
      expect(context.recentEntries[0].storyId).toBe("US-003");
    });
  });

  describe("addPattern", () => {
    it("should create new file with patterns section if file doesn't exist", async () => {
      await testManager.addPattern("New pattern");

      const content = await readTestContent();
      expect(content).toContain("## Codebase Patterns");
      expect(content).toContain("New pattern");
      expect(content).toContain("## Execution History");
    });

    it("should add pattern to existing patterns section", async () => {
      const content = `## Codebase Patterns
- Existing pattern

## Execution History
`;
      await writeTestContent(content);

      await testManager.addPattern("New pattern");

      const updatedContent = await readTestContent();
      expect(updatedContent).toContain("Existing pattern");
      expect(updatedContent).toContain("New pattern");
    });

    it("should add patterns section at beginning if missing", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Entry
---
`;
      await writeTestContent(content);

      await testManager.addPattern("New pattern");

      const updatedContent = await readTestContent();
      expect(updatedContent).toMatch(/^## Codebase Patterns\n- New pattern\n\n## Execution History/);
    });

    it("should throw error if patterns section is immediately followed by another section", async () => {
      const content = `## Codebase Patterns
## Execution History`;
      await writeTestContent(content);

      await expect(testManager.addPattern("New pattern")).rejects.toThrow(ProgressLogError);
    });
  });

  describe("getStoryEntries", () => {
    it("should return entries for specific story ID", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Entry 1
---

## 2026-02-16 - US-002
- Entry 2
---

## 2026-02-16 - US-001
- Entry 3 (retry)
---
`;
      await writeTestContent(content);

      const entries = await testManager.getStoryEntries("US-001");
      expect(entries).toHaveLength(2);
      expect(entries[0].changes).toContain("Entry 1");
      expect(entries[1].changes).toContain("Entry 3 (retry)");
    });

    it("should return empty array if story not found", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Entry
---
`;
      await writeTestContent(content);

      const entries = await testManager.getStoryEntries("US-999");
      expect(entries).toEqual([]);
    });
  });

  describe("addCommit", () => {
    it("should add commit to the most recent entry for a story", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created feature
- Added tests
---

## 2026-02-16 - US-002
- Fixed bug
---
`;
      await writeTestContent(content);

      await testManager.addCommit("US-001", "abc123def456789");

      const updatedContent = await readTestContent();
      expect(updatedContent).toContain("- **commit**: abc123d");

      // Verify the commit is in the correct entry (US-001)
      const lines = updatedContent.split("\n");
      const us001Index = lines.findIndex(line => line.includes("## 2026-02-16 - US-001"));
      const commitIndex = lines.findIndex(line => line.includes("- **commit**: abc123d"));
      const us002Index = lines.findIndex(line => line.includes("## 2026-02-16 - US-002"));

      expect(commitIndex).toBeGreaterThan(us001Index);
      expect(commitIndex).toBeLessThan(us002Index);
    });

    it("should truncate commit hash to 7 characters", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created feature
---
`;
      await writeTestContent(content);

      await testManager.addCommit("US-001", "abc123def456789xyz");

      const updatedContent = await readTestContent();
      expect(updatedContent).toContain("- **commit**: abc123d");
      expect(updatedContent).not.toContain("abc123def456789xyz");
    });

    it("should add commit before learnings section", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created feature
**Learnings for future iterations:**
- Learning 1
---
`;
      await writeTestContent(content);

      await testManager.addCommit("US-001", "abc123def456789");

      const updatedContent = await readTestContent();
      const lines = updatedContent.split("\n");

      const createdFeatureIndex = lines.findIndex(line => line.includes("- Created feature"));
      const commitIndex = lines.findIndex(line => line.includes("- **commit**: abc123d"));
      const learningsIndex = lines.findIndex(line => line.includes("**Learnings for future iterations:**"));

      expect(commitIndex).toBeGreaterThan(createdFeatureIndex);
      expect(commitIndex).toBeLessThan(learningsIndex);
    });
  });

  describe("getLatestEntry", () => {
    it("should return the most recent entry", async () => {
      const content = `## Execution History

## 2026-02-15 - US-001
- First entry
---

## 2026-02-16 - US-002
- Last entry
---
`;
      await writeTestContent(content);

      const latest = await testManager.getLatestEntry();
      expect(latest).not.toBeNull();
      expect(latest?.storyId).toBe("US-002");
    });

    it("should return null for empty log", async () => {
      const latest = await testManager.getLatestEntry();
      expect(latest).toBeNull();
    });
  });

  describe("searchEntries", () => {
    it("should search in changes", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Implemented TypeScript feature
- Added tests
---
`;
      await writeTestContent(content);

      const results = await testManager.searchEntries("TypeScript");
      expect(results).toHaveLength(1);
      expect(results[0].storyId).toBe("US-001");
    });

    it("should search in learnings", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created feature
**Learnings for future iterations:**
- TypeScript strict mode is important
---
`;
      await writeTestContent(content);

      const results = await testManager.searchEntries("strict mode");
      expect(results).toHaveLength(1);
    });

    it("should be case insensitive", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created TypeScript feature
---
`;
      await writeTestContent(content);

      const results = await testManager.searchEntries("typescript");
      expect(results).toHaveLength(1);
    });

    it("should return empty array if no matches", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created feature
---
`;
      await writeTestContent(content);

      const results = await testManager.searchEntries("nonexistent");
      expect(results).toEqual([]);
    });
  });

  describe("getCodebasePatterns", () => {
    it("should return patterns from parsed log", async () => {
      const parsed = {
        codebasePatterns: ["Pattern 1", "Pattern 2"],
        executionHistory: [],
      };

      const patterns = testManager.getCodebasePatterns(parsed);
      expect(patterns).toEqual(["Pattern 1", "Pattern 2"]);
    });
  });

  describe("getCommitsByStory", () => {
    it("should return empty array when no commits exist", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created feature
- Added tests
---
`;
      await writeTestContent(content);

      const result = await testManager.getCommitsByStory();
      expect(result).toEqual([]);
    });

    it("should extract commits from a single story", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created feature
- **commit**: abc123d
- Added tests
---
`;
      await writeTestContent(content);

      const result = await testManager.getCommitsByStory();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        storyId: "US-001",
        commits: ["abc123d"],
      });
    });

    it("should extract multiple commits from a single story", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created feature
- **commit**: abc123d
- Added tests
- **commit**: def456e
- Fixed bug
- **commit**: ghi789f
---
`;
      await writeTestContent(content);

      const result = await testManager.getCommitsByStory();
      expect(result).toHaveLength(1);
      expect(result[0].commits).toEqual(["abc123d", "def456e", "ghi789f"]);
    });

    it("should extract commits from multiple stories", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created feature
- **commit**: abc123d
---

## 2026-02-16 - US-002
- Fixed bug
- **commit**: def456e
---
`;
      await writeTestContent(content);

      const result = await testManager.getCommitsByStory();
      expect(result).toHaveLength(2);

      const us001Result = result.find((r) => r.storyId === "US-001");
      expect(us001Result?.commits).toEqual(["abc123d"]);

      const us002Result = result.find((r) => r.storyId === "US-002");
      expect(us002Result?.commits).toEqual(["def456e"]);
    });

    it("should filter by storyId when provided", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created feature
- **commit**: abc123d
---

## 2026-02-16 - US-002
- Fixed bug
- **commit**: def456e
---
`;
      await writeTestContent(content);

      const result = await testManager.getCommitsByStory("US-001");
      expect(result).toHaveLength(1);
      expect(result[0].storyId).toBe("US-001");
      expect(result[0].commits).toEqual(["abc123d"]);
    });
  });

  describe("getStoryProgressEntry", () => {
    it("should return null for story with no entries", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Entry 1
---
`;
      await writeTestContent(content);

      const result = await testManager.getStoryProgressEntry("test-prd", "US-999");
      expect(result).toBeNull();
    });

    it("should extract implemented and filesChanged from changes", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Implemented user authentication
- Added login form component
- apps/web/lib/memory/progress-log.ts
- packages/types/src/index.ts
**Learnings for future iterations:**
- Learning: Always use TypeScript strict mode
- Gotcha: Don't forget to update Z when changing W
---
`;
      await writeTestContent(content);

      const result = await testManager.getStoryProgressEntry("test-prd", "US-001");

      expect(result).not.toBeNull();
      expect(result!.implemented).toEqual([
        "Implemented user authentication",
        "Added login form component",
      ]);
      expect(result!.filesChanged).toEqual([
        "apps/web/lib/memory/progress-log.ts",
        "packages/types/src/index.ts",
      ]);
      expect(result!.learnings).toEqual([
        "Learning: Always use TypeScript strict mode",
        "Gotcha: Don't forget to update Z when changing W",
      ]);
    });

    it("should detect manual verification in learnings", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created feature
**Learnings for future iterations:**
- Manual verification: Verified in browser
---
`;
      await writeTestContent(content);

      const result = await testManager.getStoryProgressEntry("test-prd", "US-001");

      expect(result).not.toBeNull();
      expect(result!.manualVerification).toBe(true);
    });

    it("should set manualVerification to false if not mentioned", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created feature
**Learnings for future iterations:**
- Some other learning
---
`;
      await writeTestContent(content);

      const result = await testManager.getStoryProgressEntry("test-prd", "US-001");

      expect(result).not.toBeNull();
      expect(result!.manualVerification).toBe(false);
    });

    it("should parse file change indicators correctly", async () => {
      const content = `## Execution History

## 2026-02-16 - US-001
- Created authentication system
- Modified: apps/web/lib/auth.ts
- Added: apps/web/components/LoginForm.tsx
- Created file: packages/types/src/auth.ts
---
`;
      await writeTestContent(content);

      const result = await testManager.getStoryProgressEntry("test-prd", "US-001");

      expect(result).not.toBeNull();
      expect(result!.filesChanged).toContain("apps/web/lib/auth.ts");
      expect(result!.filesChanged).toContain("apps/web/components/LoginForm.tsx");
      expect(result!.filesChanged).toContain("packages/types/src/auth.ts");
    });
  });
});
