import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { PRDRepository } from "./prd-repository";
import type { IPRD, IStory } from "@talos/types";

describe("PRDRepository", () => {
  const mockStory: IStory = {
    id: "US-001",
    title: "First Story",
    description: "First user story",
    acceptanceCriteria: ["criterion 1"],
    priority: 1,
    passes: false,
    notes: "",
    status: "pending",
    markAsPassing: () => {},
    markAsFailing: () => {},
    start: () => {},
    areDependenciesSatisfied: () => true,
    addNote: () => {},
    canStart: () => true
  };

  const mockPRD: IPRD = {
    id: "test-prd-001",
    project: "Test Project",
    description: "A test PRD for testing",
    userStories: [mockStory],
    branchName: "main",
    createdAt: Date.now(),
    status: "draft",
    getCompletedStories: () => [],
    getPendingStories: () => [mockStory],
    getStory: () => mockStory,
    getStoriesByPriority: () => [mockStory],
    getNextStory: () => undefined,
    getCompletionPercentage: () => 0,
    isComplete: () => false,
    addStory: () => {},
    updateStory: () => {},
    markAsCompleted: () => {},
    markAsStarted: () => {}
  };

  let tempDir: string;
  let repository: PRDRepository;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prd-repo-"));
    repository = new PRDRepository(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("save", () => {
    it("should save a new PRD", async () => {
      await repository.save(mockPRD);

      const found = await repository.findById(mockPRD.id);
      expect(found).not.toBeNull();
      expect(found?.project).toBe("Test Project");
      expect(found?.id).toBe(mockPRD.id);
      expect(found?.updatedAt).toBeDefined();
    });

    it("should update an existing PRD", async () => {
      await repository.save(mockPRD);

      const updatedPRD = {
        ...mockPRD,
        description: "Updated description"
      };
      await repository.save(updatedPRD);

      const found = await repository.findById(mockPRD.id);
      expect(found?.description).toBe("Updated description");
    });

    it("should throw error if PRD has no id", async () => {
      const invalidPRD = { ...mockPRD, id: "" };

      await expect(repository.save(invalidPRD)).rejects.toThrow("PRD must have an id");
    });
  });

  describe("findById", () => {
    it("should find PRD by id", async () => {
      await repository.save(mockPRD);

      const found = await repository.findById(mockPRD.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(mockPRD.id);
    });

    it("should return null if PRD not found", async () => {
      const found = await repository.findById("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("findAll", () => {
    it("should find all PRDs", async () => {
      const prd2: IPRD = {
        ...mockPRD,
        id: "test-prd-002",
        project: "Second Project"
      };

      await repository.save(mockPRD);
      await repository.save(prd2);

      const all = await repository.findAll();
      expect(all).toHaveLength(2);
    });

    it("should filter by status", async () => {
      const activePRD: IPRD = {
        ...mockPRD,
        id: "test-prd-002",
        status: "active" as const,
        getCompletedStories: () => [],
        getPendingStories: () => [],
        getStory: () => mockStory,
        getStoriesByPriority: () => [],
        getNextStory: () => undefined,
        getCompletionPercentage: () => 0,
        isComplete: () => false,
        addStory: () => {},
        updateStory: () => {},
        markAsCompleted: () => {},
        markAsStarted: () => {}
      };

      await repository.save(mockPRD);
      await repository.save(activePRD);

      const active = await repository.findAll({ status: "active" });
      expect(active).toHaveLength(1);
      expect(active[0].status).toBe("active");
    });

    it("should filter by project", async () => {
      const prd2: IPRD = {
        ...mockPRD,
        id: "test-prd-002",
        project: "Other Project"
      };

      await repository.save(mockPRD);
      await repository.save(prd2);

      const filtered = await repository.findAll({ project: "Test Project" });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].project).toBe("Test Project");
    });

    it("should filter by branch name", async () => {
      const prd2: IPRD = {
        ...mockPRD,
        id: "test-prd-002",
        branchName: "feature"
      };

      await repository.save(mockPRD);
      await repository.save(prd2);

      const filtered = await repository.findAll({ branchName: "main" });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].branchName).toBe("main");
    });

    it("should return empty array when no PRDs exist", async () => {
      const all = await repository.findAll();
      expect(all).toHaveLength(0);
    });
  });

  describe("delete", () => {
    it("should delete a PRD", async () => {
      await repository.save(mockPRD);

      await repository.delete(mockPRD.id);

      const found = await repository.findById(mockPRD.id);
      expect(found).toBeNull();
    });

    it("should throw error if PRD not found", async () => {
      await expect(repository.delete("non-existent")).rejects.toThrow("PRD not found");
    });
  });

  describe("exists", () => {
    it("should return true if PRD exists", async () => {
      await repository.save(mockPRD);

      const exists = await repository.exists(mockPRD.id);
      expect(exists).toBe(true);
    });

    it("should return false if PRD does not exist", async () => {
      const exists = await repository.exists("non-existent");
      expect(exists).toBe(false);
    });
  });

  describe("findByBranch", () => {
    it("should find PRD by branch name", async () => {
      await repository.save(mockPRD);

      const found = await repository.findByBranch("main");
      expect(found).not.toBeNull();
      expect(found?.branchName).toBe("main");
    });

    it("should return null if branch not found", async () => {
      const found = await repository.findByBranch("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("findActive", () => {
    it("should find active PRD", async () => {
      const activePRD: IPRD = {
        ...mockPRD,
        status: "active" as const,
        getCompletedStories: () => [],
        getPendingStories: () => [],
        getStory: () => mockStory,
        getStoriesByPriority: () => [],
        getNextStory: () => undefined,
        getCompletionPercentage: () => 0,
        isComplete: () => false,
        addStory: () => {},
        updateStory: () => {},
        markAsCompleted: () => {},
        markAsStarted: () => {}
      };

      await repository.save(activePRD);

      const found = await repository.findActive();
      expect(found).not.toBeNull();
      expect(found?.status).toBe("active");
    });

    it("should return null if no active PRD", async () => {
      const found = await repository.findActive();
      expect(found).toBeNull();
    });
  });
});
