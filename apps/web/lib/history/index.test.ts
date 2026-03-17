import { describe, it, expect, beforeEach } from "vitest";
import { HistoryManager, type HistoryRecord } from "./index";
import type { LocalStorageEngine } from '@talos/core';
import type { StoryExecutionResult } from '@talos/types';

// Mock storage service for testing
// Use Omit to exclude private properties from LocalStorageEngine
type MockStorageService = Omit<
  LocalStorageEngine,
  "basePath" | "ensureDir"
> & {
  clear(): void;
};

function createMockStorageService(): MockStorageService {
  const data: Map<string, unknown> = new Map();
  // Track directories that have been created via write operations
  const directories: Set<string> = new Set();

  // Track a directory and all its parent directories
  function trackDirectory(dirPath: string): void {
    let current = dirPath;
    while (current) {
      directories.add(current);
      const lastSlash = current.lastIndexOf("/");
      if (lastSlash === -1) break;
      current = current.substring(0, lastSlash);
    }
  }

  return {
    async readJSON<T>(filePath: string): Promise<T | null> {
      return (data.get(filePath) as T) || null;
    },

    async writeJSON<T>(filePath: string, fileData: T): Promise<void> {
      data.set(filePath, fileData);
      // Track directory path
      const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
      trackDirectory(dirPath);
    },

    async readMarkdown(): Promise<string | null> {
      return null;
    },

    async writeMarkdown(): Promise<void> {
      // Not implemented for mock
    },

    async deleteFile(filePath: string): Promise<void> {
      data.delete(filePath);
    },

    async fileExists(filePath: string): Promise<boolean> {
      return data.has(filePath);
    },

    async listFiles(dirPath: string, extension?: string): Promise<string[]> {
      const prefix = dirPath === "" ? "" : dirPath + "/";
      const files: string[] = [];
      const seen = new Set<string>();

      for (const key of data.keys()) {
        if (key.startsWith(prefix)) {
          const remainder = key.substring(prefix.length);

          // Extract just the filename (first path component)
          const slashIndex = remainder.indexOf("/");
          if (slashIndex === -1) {
            // It's a file directly in this directory
            if (!extension || remainder.endsWith(extension)) {
              if (!seen.has(remainder)) {
                files.push(remainder);
                seen.add(remainder);
              }
            }
          } else {
            // It's in a subdirectory - add the subdirectory name
            const subdir = remainder.substring(0, slashIndex);
            if (!seen.has(subdir)) {
              files.push(subdir);
              seen.add(subdir);
            }
          }
        }
      }

      // Also check tracked directories for subdirectories
      const dirPrefix = dirPath === "" ? "" : dirPath + "/";
      for (const dir of directories) {
        if (dir.startsWith(dirPrefix) && dir !== dirPrefix.slice(0, -1)) {
          const remainder = dir.substring(dirPrefix.length);
          const slashIndex = remainder.indexOf("/");
          if (slashIndex === -1 && !seen.has(remainder)) {
            files.push(remainder);
            seen.add(remainder);
          }
        }
      }

      return files;
    },

    async getFileStats(): Promise<null> {
      return null;
    },

    clear() {
      data.clear();
      directories.clear();
    },
  };
}

describe("HistoryManager", () => {
  let historyManager: HistoryManager;
  let mockStorage: MockStorageService;

  // Sample story execution results
  const sampleStoryResults: StoryExecutionResult[] = [
    {
      storyId: "US-001",
      storyTitle: "Initialize project",
      success: true,
      attempts: 1,
      duration: 5000,
      rawOutput: "Project initialized successfully",
    },
    {
      storyId: "US-002",
      storyTitle: "Create types",
      success: true,
      attempts: 1,
      duration: 3000,
      rawOutput: "Types created",
    },
    {
      storyId: "US-003",
      storyTitle: "Implement storage",
      success: false,
      attempts: 3,
      duration: 0,
      error: "Storage initialization failed",
    },
  ];

  // Sample metadata
  const sampleMetadata = {
    timestamp: Date.now(),
    prdId: "test-prd-001",
    prdTitle: "Test Project",
    role: "developer",
    roleDescription: "Software developer role",
    modelsUsed: ["claude-sonnet-4.5"],
    duration: 8000,
    status: "partial" as const,
    startedAt: Date.now(),
    completedAt: Date.now() + 8000,
  };

  beforeEach(() => {
    mockStorage = createMockStorageService();
    historyManager = new HistoryManager({ storage: mockStorage });
  });

  describe("saveConsoleHistory", () => {
    it("should save console history and return history ID", async () => {
      const historyId = await historyManager.saveConsoleHistory(
        sampleMetadata,
        sampleStoryResults
      );

      expect(historyId).toMatch(/^hist_\d+_[a-z0-9]+$/);

      // Verify the record was saved
      const year = new Date(sampleMetadata.startedAt).getFullYear();
      const month = String(
        new Date(sampleMetadata.startedAt).getMonth() + 1
      ).padStart(2, "0");
      const filePath = `data/history/console/${year}-${month}/exec-${historyId}.json`;

      const record = await mockStorage.readJSON<HistoryRecord>(filePath);
      expect(record).toBeDefined();
      expect(record?.id).toBe(historyId);
      expect(record?.level).toBe("console");
      expect(record?.prdId).toBe(sampleMetadata.prdId);
      expect(record?.prdTitle).toBe(sampleMetadata.prdTitle);
      expect(record?.tasks).toHaveLength(3);
    });

    it("should build RalphTask array from story results", async () => {
      const historyId = await historyManager.saveConsoleHistory(
        sampleMetadata,
        sampleStoryResults
      );

      const year = new Date(sampleMetadata.startedAt).getFullYear();
      const month = String(
        new Date(sampleMetadata.startedAt).getMonth() + 1
      ).padStart(2, "0");
      const filePath = `data/history/console/${year}-${month}/exec-${historyId}.json`;

      const record = await mockStorage.readJSON<HistoryRecord>(filePath);
      expect(record?.tasks).toHaveLength(3);

      // Check first task (successful)
      expect(record!.tasks[0].id).toBe("US-001");
      expect(record!.tasks[0].title).toBe("Initialize project");
      expect(record!.tasks[0].status).toBe("completed");
      expect(record!.tasks[0].conversation).toHaveLength(2);
      expect(record!.tasks[0].conversation[0].role).toBe("user");
      expect(record!.tasks[0].conversation[1].role).toBe("assistant");

      // Check third task (failed)
      expect(record!.tasks[2].id).toBe("US-003");
      expect(record!.tasks[2].status).toBe("failed");
      expect(record!.tasks[2].description).toBe("Storage initialization failed");
    });
  });

  describe("saveProjectHistory", () => {
    it("should save project history with slugified title", async () => {
      const historyId = await historyManager.saveProjectHistory(
        "Test Project With Spaces!",
        sampleMetadata,
        sampleStoryResults
      );

      expect(historyId).toMatch(/^hist_\d+_[a-z0-9]+$/);

      // Verify the record was saved with slugified title
      const filePath = `data/history/projects/test-project-with-spaces/exec-${historyId}.json`;

      const record = await mockStorage.readJSON<HistoryRecord>(filePath);
      expect(record).toBeDefined();
      expect(record?.id).toBe(historyId);
      expect(record?.level).toBe("project");
    });
  });

  describe("saveHistory", () => {
    it("should save to both console and project levels", async () => {
      const result = await historyManager.saveHistory(
        sampleMetadata,
        sampleStoryResults
      );

      expect(result.consoleId).toBeDefined();
      expect(result.projectId).toBeDefined();

      // Verify both records exist
      const year = new Date(sampleMetadata.startedAt).getFullYear();
      const month = String(
        new Date(sampleMetadata.startedAt).getMonth() + 1
      ).padStart(2, "0");
      const consolePath = `data/history/console/${year}-${month}/exec-${result.consoleId}.json`;
      const projectPath = `data/history/projects/test-project/exec-${result.projectId}.json`;

      expect(await mockStorage.fileExists(consolePath)).toBe(true);
      expect(await mockStorage.fileExists(projectPath)).toBe(true);
    });
  });

  describe("loadHistory", () => {
    it("should load history from console level", async () => {
      const historyId = await historyManager.saveConsoleHistory(
        sampleMetadata,
        sampleStoryResults
      );

      const loaded = await historyManager.loadHistory(historyId);
      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe(historyId);
      expect(loaded?.level).toBe("console");
      expect(loaded?.prdTitle).toBe("Test Project");
    });

    it("should load history from project level", async () => {
      const historyId = await historyManager.saveProjectHistory(
        "Test Project",
        sampleMetadata,
        sampleStoryResults
      );

      const loaded = await historyManager.loadHistory(historyId);
      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe(historyId);
      expect(loaded?.level).toBe("project");
    });

    it("should return null for non-existent history", async () => {
      const loaded = await historyManager.loadHistory("non-existent-id");
      expect(loaded).toBeNull();
    });
  });

  describe("loadConsoleHistory", () => {
    it("should load console history by ID", async () => {
      const historyId = await historyManager.saveConsoleHistory(
        sampleMetadata,
        sampleStoryResults
      );

      const loaded = await historyManager.loadConsoleHistory(historyId);
      expect(loaded).toBeDefined();
      expect(loaded?.level).toBe("console");
    });

    it("should return null for non-existent console history", async () => {
      const loaded = await historyManager.loadConsoleHistory("non-existent");
      expect(loaded).toBeNull();
    });
  });

  describe("loadProjectHistory", () => {
    it("should load project history by ID", async () => {
      const historyId = await historyManager.saveProjectHistory(
        "Test Project",
        sampleMetadata,
        sampleStoryResults
      );

      const loaded = await historyManager.loadProjectHistory(historyId);
      expect(loaded).toBeDefined();
      expect(loaded?.level).toBe("project");
    });

    it("should return null for non-existent project history", async () => {
      const loaded = await historyManager.loadProjectHistory("non-existent");
      expect(loaded).toBeNull();
    });
  });

  describe("listProjects", () => {
    it("should return empty array when no projects exist", async () => {
      const projects = await historyManager.listProjects();
      expect(projects).toEqual([]);
    });

    it("should list all projects", async () => {
      await historyManager.saveProjectHistory("Project A", sampleMetadata, []);
      await historyManager.saveProjectHistory("Project B", sampleMetadata, []);

      const projects = await historyManager.listProjects();
      expect(projects).toContain("project-a");
      expect(projects).toContain("project-b");
    });
  });

  describe("getProjectHistory", () => {
    it("should return empty array for non-existent project", async () => {
      const history = await historyManager.getProjectHistory("Non-existent");
      expect(history).toEqual([]);
    });

    it("should return all history for a project sorted by timestamp", async () => {
      // Save multiple histories with different timestamps
      await historyManager.saveProjectHistory("Test Project", sampleMetadata, []);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await historyManager.saveProjectHistory("Test Project", sampleMetadata, []);

      const history = await historyManager.getProjectHistory("Test Project");
      expect(history).toHaveLength(2);
      // Should be sorted by timestamp descending
      expect(history[0].timestamp).toBeGreaterThanOrEqual(
        history[1].timestamp
      );
    });
  });

  describe("getConsoleHistory", () => {
    it("should return empty array for non-existent month", async () => {
      const history = await historyManager.getConsoleHistory(2025, 1);
      expect(history).toEqual([]);
    });

    it("should return console history for a specific month", async () => {
      await historyManager.saveConsoleHistory(
        sampleMetadata,
        sampleStoryResults
      );

      const now = new Date();
      const history = await historyManager.getConsoleHistory(
        now.getFullYear(),
        now.getMonth() + 1
      );

      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe("deleteHistory", () => {
    it("should delete console history", async () => {
      const historyId = await historyManager.saveConsoleHistory(
        sampleMetadata,
        sampleStoryResults
      );

      const deleted = await historyManager.deleteHistory(historyId);
      expect(deleted).toBe(true);

      const loaded = await historyManager.loadHistory(historyId);
      expect(loaded).toBeNull();
    });

    it("should delete project history", async () => {
      const historyId = await historyManager.saveProjectHistory(
        "Test Project",
        sampleMetadata,
        sampleStoryResults
      );

      const deleted = await historyManager.deleteHistory(historyId);
      expect(deleted).toBe(true);

      const loaded = await historyManager.loadHistory(historyId);
      expect(loaded).toBeNull();
    });

    it("should return false for non-existent history", async () => {
      const deleted = await historyManager.deleteHistory("non-existent");
      expect(deleted).toBe(false);
    });
  });

  describe("saveProjectSnapshot", () => {
    it("should save project snapshot and return ID", async () => {
      const snapshot = {
        timestamp: Date.now(),
        prdId: "test-prd-001",
        prdTitle: "Test Project",
        filesModified: ["src/index.ts", "src/utils.ts"],
        description: "Initial implementation",
      };

      const snapshotId = await historyManager.saveProjectSnapshot(snapshot);
      expect(snapshotId).toMatch(/^snapshot_\d+_[a-z0-9]+$/);

      // Verify snapshot was saved
      const filePath = `data/history/projects/test-project/${snapshotId}.json`;
      const saved = await mockStorage.readJSON<{ prdId: string }>(filePath);
      expect(saved).toBeDefined();
      expect(saved?.prdId).toBe("test-prd-001");
    });
  });

  describe("getProjectSnapshots", () => {
    it("should return empty array for non-existent project", async () => {
      const snapshots = await historyManager.getProjectSnapshots("Non-existent");
      expect(snapshots).toEqual([]);
    });

    it("should return all snapshots for a project excluding execution records", async () => {
      const snapshot = {
        timestamp: Date.now(),
        prdId: "test-prd-001",
        prdTitle: "Test Project",
        filesModified: ["src/index.ts"],
        description: "Snapshot 1",
      };

      await historyManager.saveProjectSnapshot(snapshot);
      await historyManager.saveProjectHistory(
        "Test Project",
        sampleMetadata,
        []
      );

      const snapshots = await historyManager.getProjectSnapshots("Test Project");
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].description).toBe("Snapshot 1");
    });

    it("should sort snapshots by timestamp descending", async () => {
      await historyManager.saveProjectSnapshot({
        timestamp: Date.now(),
        prdId: "test-prd-001",
        prdTitle: "Test Project",
        filesModified: ["a.ts"],
        description: "First",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await historyManager.saveProjectSnapshot({
        timestamp: Date.now(),
        prdId: "test-prd-001",
        prdTitle: "Test Project",
        filesModified: ["b.ts"],
        description: "Second",
      });

      const snapshots = await historyManager.getProjectSnapshots("Test Project");
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].description).toBe("Second");
      expect(snapshots[1].description).toBe("First");
    });
  });

  describe("slugify", () => {
    it("should slugify text correctly", async () => {
      await historyManager.saveProjectHistory(
        "Test Project With Spaces & Special Characters!",
        sampleMetadata,
        []
      );

      const projects = await historyManager.listProjects();
      expect(projects).toContain(
        "test-project-with-spaces-special-characters"
      );
    });

    it("should handle multiple hyphens", async () => {
      await historyManager.saveProjectHistory(
        "Test---Project",
        sampleMetadata,
        []
      );

      const projects = await historyManager.listProjects();
      expect(projects).toContain("test-project");
    });
  });

  describe("findStoryTask", () => {
    it("should find task in project-level history", async () => {
      await historyManager.saveProjectHistory(
        "Test Project",
        sampleMetadata,
        sampleStoryResults
      );

      const task = await historyManager.findStoryTask(
        sampleMetadata.prdId,
        "US-001"
      );

      expect(task).toBeDefined();
      expect(task?.id).toBe("US-001");
      expect(task?.title).toBe("Initialize project");
      expect(task?.status).toBe("completed");
    });

    it("should find task in console-level history", async () => {
      await historyManager.saveConsoleHistory(
        sampleMetadata,
        sampleStoryResults
      );

      const task = await historyManager.findStoryTask(
        sampleMetadata.prdId,
        "US-002"
      );

      expect(task).toBeDefined();
      expect(task?.id).toBe("US-002");
      expect(task?.title).toBe("Create types");
    });

    it("should return null for non-existent story", async () => {
      await historyManager.saveProjectHistory(
        "Test Project",
        sampleMetadata,
        sampleStoryResults
      );

      const task = await historyManager.findStoryTask(
        sampleMetadata.prdId,
        "US-999"
      );

      expect(task).toBeNull();
    });

    it("should return null for non-existent PRD", async () => {
      const task = await historyManager.findStoryTask("non-existent-prd", "US-001");

      expect(task).toBeNull();
    });

    it("should find task across multiple history records", async () => {
      // Save first history record with US-001 and US-002
      await historyManager.saveProjectHistory(
        "Test Project",
        sampleMetadata,
        sampleStoryResults.slice(0, 2)
      );

      // Save second history record with US-003
      await historyManager.saveProjectHistory(
        "Test Project",
        {
          ...sampleMetadata,
          timestamp: Date.now() + 1000,
        },
        sampleStoryResults.slice(2)
      );

      const task1 = await historyManager.findStoryTask(
        sampleMetadata.prdId,
        "US-001"
      );
      expect(task1?.id).toBe("US-001");

      const task3 = await historyManager.findStoryTask(
        sampleMetadata.prdId,
        "US-003"
      );
      expect(task3?.id).toBe("US-003");
      expect(task3?.status).toBe("failed");
    });

    it("should prioritize project-level history over console-level", async () => {
      // Save to both levels
      await historyManager.saveHistory(sampleMetadata, sampleStoryResults);

      const task = await historyManager.findStoryTask(
        sampleMetadata.prdId,
        "US-001"
      );

      // Should find the task (from project-level history)
      expect(task).toBeDefined();
      expect(task?.id).toBe("US-001");
    });
  });
});
