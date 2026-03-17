import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { WorktreeStorage } from "./worktree";
import { LocalStorageEngine } from "./index";
import { WorkspaceStorage } from "./workspace";
import type { Story } from "@talos/types";

describe("WorktreeStorage", () => {
  let tempDir: string;
  let storage: LocalStorageEngine;
  let workspaceStorage: WorkspaceStorage;
  let worktreeStorage: WorktreeStorage;
  let testWorkspace: { id: string };

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "worktree-test-"));
    storage = new LocalStorageEngine(tempDir);
    workspaceStorage = new WorkspaceStorage(storage);
    worktreeStorage = new WorktreeStorage(storage);

    // Create a test workspace
    testWorkspace = await workspaceStorage.createWorkspace(
      "Test Project",
      "main",
      "/path/to/project"
    );
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("createWorktree", () => {
    it("should create a worktree with correct properties", async () => {
      const worktree = await worktreeStorage.createWorktree(
        "feature-branch",
        "Feature Branch",
        "feature-branch",
        testWorkspace.id,
        false,
        []
      );

      expect(worktree.id).toMatch(/^worktree-\d+-\w+$/);
      expect(worktree.name).toBe("feature-branch");
      expect(worktree.title).toBe("Feature Branch");
      expect(worktree.branchName).toBe("feature-branch");
      expect(worktree.status).toBe("pending");
      expect(worktree.progress).toBe(0);
      expect(worktree.isDefault).toBe(false);
      expect(worktree.workspaceId).toBe(testWorkspace.id);
      expect(worktree.stories).toEqual([]);
      expect(worktree.terminal).toEqual([]);
    });

    it("should calculate progress from stories", async () => {
      const stories: Story[] = [
        { id: "1", title: "Story 1", description: "", acceptanceCriteria: [], priority: 1, passes: true, terminal: [] },
        { id: "2", title: "Story 2", description: "", acceptanceCriteria: [], priority: 2, passes: false, terminal: [] },
        { id: "3", title: "Story 3", description: "", acceptanceCriteria: [], priority: 3, passes: true, terminal: [] },
      ];

      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        stories
      );

      expect(worktree.progress).toBe(67); // 2 out of 3 = 67%
    });

    it("should persist worktree to file", async () => {
      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        []
      );

      const filePath = path.join(tempDir, "worktrees", `${worktree.id}.json`);
      const fileContent = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(fileContent);

      expect(parsed.name).toBe("feature");
      expect(parsed.title).toBe("Feature");
    });
  });

  describe("createDefaultWorktree", () => {
    it("should create a default worktree", async () => {
      const worktree = await worktreeStorage.createDefaultWorktree(
        "main",
        testWorkspace.id,
        "/path/to/project"
      );

      expect(worktree.id).toBe(`worktree-default-${testWorkspace.id}`);
      expect(worktree.isDefault).toBe(true);
      expect(worktree.status).toBe("default");
      expect(worktree.progress).toBe(0);
      expect(worktree.stories).toEqual([]);
    });
  });

  describe("getWorktree", () => {
    it("should return worktree by id", async () => {
      const created = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        []
      );

      const retrieved = await worktreeStorage.getWorktree(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe("feature");
    });

    it("should return null for non-existent worktree", async () => {
      const result = await worktreeStorage.getWorktree("non-existent-id");
      expect(result).toBeNull();
    });
  });

  describe("getAllWorktrees", () => {
    it("should return all worktrees", async () => {
      await worktreeStorage.createWorktree("feature-1", "Feature 1", "feature-1", testWorkspace.id, false, []);
      await worktreeStorage.createWorktree("feature-2", "Feature 2", "feature-2", testWorkspace.id, false, []);

      const worktrees = await worktreeStorage.getAllWorktrees();

      expect(worktrees).toHaveLength(2);
      expect(worktrees.map((w) => w.name).sort()).toEqual(["feature-1", "feature-2"]);
    });

    it("should return empty array when no worktrees exist", async () => {
      const worktrees = await worktreeStorage.getAllWorktrees();
      expect(worktrees).toEqual([]);
    });
  });

  describe("getWorktreesByWorkspace", () => {
    it("should return worktrees for specific workspace", async () => {
      const workspace2 = await workspaceStorage.createWorkspace("Project 2", "main", "/path/to/project2");

      await worktreeStorage.createWorktree("feature-1", "Feature 1", "feature-1", testWorkspace.id, false, []);
      await worktreeStorage.createWorktree("feature-2", "Feature 2", "feature-2", workspace2.id, false, []);

      const workspace1Worktrees = await worktreeStorage.getWorktreesByWorkspace(testWorkspace.id);
      const workspace2Worktrees = await worktreeStorage.getWorktreesByWorkspace(workspace2.id);

      expect(workspace1Worktrees).toHaveLength(1);
      expect(workspace2Worktrees).toHaveLength(1);
      expect(workspace1Worktrees[0].name).toBe("feature-1");
      expect(workspace2Worktrees[0].name).toBe("feature-2");
    });
  });

  describe("updateWorktree", () => {
    it("should update worktree properties", async () => {
      const created = await worktreeStorage.createWorktree(
        "old-name",
        "Old Title",
        "feature",
        testWorkspace.id,
        false,
        []
      );

      const updated = await worktreeStorage.updateWorktree(created.id, {
        name: "new-name",
        title: "New Title",
      });

      expect(updated?.name).toBe("new-name");
      expect(updated?.title).toBe("New Title");
      expect(updated?.branchName).toBe("feature"); // Unchanged
    });

    it("should recalculate progress when stories change", async () => {
      const stories: Story[] = [
        { id: "1", title: "Story 1", description: "", acceptanceCriteria: [], priority: 1, passes: false, terminal: [] },
        { id: "2", title: "Story 2", description: "", acceptanceCriteria: [], priority: 2, passes: false, terminal: [] },
      ];

      const created = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        stories
      );

      expect(created.progress).toBe(0);

      const updatedStories: Story[] = [
        { ...stories[0], passes: true },
        { ...stories[1], passes: false },
      ];

      const updated = await worktreeStorage.updateWorktree(created.id, {
        stories: updatedStories,
      });

      expect(updated?.progress).toBe(50);
    });

    it("should return null for non-existent worktree", async () => {
      const result = await worktreeStorage.updateWorktree("non-existent", {
        name: "New Name",
      });
      expect(result).toBeNull();
    });
  });

  describe("deleteWorktree", () => {
    it("should delete worktree and return true", async () => {
      const created = await worktreeStorage.createWorktree(
        "to-delete",
        "To Delete",
        "to-delete",
        testWorkspace.id,
        false,
        []
      );

      const deleted = await worktreeStorage.deleteWorktree(created.id);

      expect(deleted).toBe(true);
      const retrieved = await worktreeStorage.getWorktree(created.id);
      expect(retrieved).toBeNull();
    });

    it("should return false for non-existent worktree", async () => {
      const result = await worktreeStorage.deleteWorktree("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("addStoryToWorktree", () => {
    it("should add story to worktree", async () => {
      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        []
      );

      const story: Story = {
        id: "story-1",
        title: "Test Story",
        description: "Test description",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        passes: false,
        terminal: [],
      };

      const updated = await worktreeStorage.addStoryToWorktree(worktree.id, story);

      expect(updated?.stories).toHaveLength(1);
      expect(updated?.stories[0].id).toBe("story-1");
    });

    it("should update progress when adding story", async () => {
      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        []
      );

      const story: Story = {
        id: "story-1",
        title: "Test Story",
        description: "",
        acceptanceCriteria: [],
        priority: 1,
        passes: true,
        terminal: [],
      };

      const updated = await worktreeStorage.addStoryToWorktree(worktree.id, story);

      expect(updated?.progress).toBe(100); // 1 out of 1 = 100%
    });
  });

  describe("updateStoryInWorktree", () => {
    it("should update story in worktree", async () => {
      const story: Story = {
        id: "story-1",
        title: "Original Title",
        description: "",
        acceptanceCriteria: [],
        priority: 1,
        passes: false,
        terminal: [],
      };

      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        [story]
      );

      const updated = await worktreeStorage.updateStoryInWorktree(worktree.id, "story-1", {
        title: "Updated Title",
        passes: true,
      });

      expect(updated?.stories[0].title).toBe("Updated Title");
      expect(updated.stories[0].passes).toBe(true);
    });

    it("should recalculate progress when story changes", async () => {
      const story: Story = {
        id: "story-1",
        title: "Story",
        description: "",
        acceptanceCriteria: [],
        priority: 1,
        passes: false,
        terminal: [],
      };

      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        [story]
      );

      expect(worktree.progress).toBe(0);

      await worktreeStorage.updateStoryInWorktree(worktree.id, "story-1", {
        passes: true,
      });

      const updated = await worktreeStorage.getWorktree(worktree.id);
      expect(updated?.progress).toBe(100);
    });

    it("should return null for non-existent story", async () => {
      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        []
      );

      const result = await worktreeStorage.updateStoryInWorktree(worktree.id, "non-existent", {
        title: "New Title",
      });

      expect(result).toBeNull();
    });
  });

  describe("removeStoryFromWorktree", () => {
    it("should remove story from worktree", async () => {
      const story1: Story = {
        id: "story-1",
        title: "Story 1",
        description: "",
        acceptanceCriteria: [],
        priority: 1,
        passes: true,
        terminal: [],
      };
      const story2: Story = {
        id: "story-2",
        title: "Story 2",
        description: "",
        acceptanceCriteria: [],
        priority: 2,
        passes: false,
        terminal: [],
      };

      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        [story1, story2]
      );

      const updated = await worktreeStorage.removeStoryFromWorktree(worktree.id, "story-1");

      expect(updated?.stories).toHaveLength(1);
      expect(updated?.stories[0].id).toBe("story-2");
    });

    it("should recalculate progress when removing story", async () => {
      const story1: Story = {
        id: "story-1",
        title: "Story 1",
        description: "",
        acceptanceCriteria: [],
        priority: 1,
        passes: true,
        terminal: [],
      };
      const story2: Story = {
        id: "story-2",
        title: "Story 2",
        description: "",
        acceptanceCriteria: [],
        priority: 2,
        passes: false,
        terminal: [],
      };

      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        [story1, story2]
      );

      expect(worktree.progress).toBe(50);

      await worktreeStorage.removeStoryFromWorktree(worktree.id, "story-1");

      const updated = await worktreeStorage.getWorktree(worktree.id);
      expect(updated?.progress).toBe(0); // 0 out of 1 = 0%
    });
  });

  describe("toggleStoryCompletion", () => {
    it("should toggle story completion status", async () => {
      const story: Story = {
        id: "story-1",
        title: "Story",
        description: "",
        acceptanceCriteria: [],
        priority: 1,
        passes: false,
        terminal: [],
      };

      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        [story]
      );

      const updated = await worktreeStorage.toggleStoryCompletion(worktree.id, "story-1");

      expect(updated.stories[0].passes).toBe(true);
      expect(updated.stories[0].passes).toBe(true);
    });

    it("should update worktree status based on story completion", async () => {
      const story: Story = {
        id: "story-1",
        title: "Story",
        description: "",
        acceptanceCriteria: [],
        priority: 1,
        passes: false,
        terminal: [],
      };

      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        [story]
      );

      expect(worktree.status).toBe("pending");

      const updated = await worktreeStorage.toggleStoryCompletion(worktree.id, "story-1");

      expect(updated?.status).toBe("completed");
    });
  });

  describe("updateStatus", () => {
    it("should update worktree status", async () => {
      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        []
      );

      const updated = await worktreeStorage.updateStatus(worktree.id, "running");

      expect(updated?.status).toBe("running");
    });
  });

  describe("addTerminalLog", () => {
    it("should add terminal log to worktree", async () => {
      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        []
      );

      const updated = await worktreeStorage.addTerminalLog(
        worktree.id,
        "info",
        "Test message"
      );

      expect(updated?.terminal).toHaveLength(1);
      expect(updated?.terminal[0].type).toBe("info");
      expect(updated?.terminal[0].message).toBe("Test message");
      expect(updated?.terminal[0].timestamp).toBeGreaterThan(0);
    });

    it("should limit terminal logs to 1000 entries", async () => {
      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        []
      );

      // Add 1005 logs
      for (let i = 0; i < 1005; i++) {
        await worktreeStorage.addTerminalLog(worktree.id, "info", `Message ${i}`);
      }

      const updated = await worktreeStorage.getWorktree(worktree.id);
      expect(updated?.terminal).toHaveLength(1000);
    });
  });

  describe("clearTerminalLogs", () => {
    it("should clear all terminal logs", async () => {
      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        []
      );

      await worktreeStorage.addTerminalLog(worktree.id, "info", "Message 1");
      await worktreeStorage.addTerminalLog(worktree.id, "info", "Message 2");

      const updated = await worktreeStorage.clearTerminalLogs(worktree.id);

      expect(updated?.terminal).toHaveLength(0);
    });
  });

  describe("worktreeExists", () => {
    it("should return true for existing worktree", async () => {
      const worktree = await worktreeStorage.createWorktree(
        "feature",
        "Feature",
        "feature",
        testWorkspace.id,
        false,
        []
      );

      const exists = await worktreeStorage.worktreeExists(worktree.id);
      expect(exists).toBe(true);
    });

    it("should return false for non-existent worktree", async () => {
      const exists = await worktreeStorage.worktreeExists("non-existent");
      expect(exists).toBe(false);
    });
  });
});
