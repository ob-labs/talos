/**
 * WorktreeRepository Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorktreeRepository } from "./WorktreeRepository";
import { Worktree } from "../entities/Worktree";

// Mock LocalStorageEngine with a factory function
const mockStorage = {
  readJSON: vi.fn(),
  writeJSON: vi.fn(),
  deleteFile: vi.fn(),
  fileExists: vi.fn(),
  listFiles: vi.fn(),
};

vi.mock("../../storage/storage", () => ({
  LocalStorageEngine: vi.fn().mockImplementation(() => mockStorage),
}));

describe("WorktreeRepository", () => {
  let repository: WorktreeRepository;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    // Create repository
    repository = new WorktreeRepository();
  });

  describe("save", () => {
    it("should save a worktree", async () => {
      const worktree = Worktree.fromProperties({
        path: "/path/to/repo/worktrees/feature",
        branch: "feature-branch",
      });

      mockStorage.writeJSON.mockResolvedValue(undefined);

      await repository.save(worktree);

      expect(mockStorage.writeJSON).toHaveBeenCalled();
      const callArgs = mockStorage.writeJSON.mock.calls[0];
      expect(callArgs[0]).toMatch(/^worktrees\/wt_\d+\.json$/);
      expect(callArgs[1]).toEqual(worktree.toDTO());
    });
  });

  describe("findByPath", () => {
    it("should return null if worktree not found", async () => {
      mockStorage.readJSON.mockResolvedValue(null);

      const result = await repository.findByPath("/nonexistent/path");

      expect(result).toBeNull();
    });

    it("should return worktree if found", async () => {
      const dto = {
        path: "/path/to/repo/worktrees/feature",
        branch: "feature-branch",
      };

      mockStorage.readJSON.mockResolvedValue(dto);

      const result = await repository.findByPath("/path/to/repo/worktrees/feature");

      expect(result).not.toBeNull();
      expect(result?.path).toBe("/path/to/repo/worktrees/feature");
      expect(result?.branch).toBe("feature-branch");
    });
  });

  describe("findAll", () => {
    it("should return empty array if no worktrees found", async () => {
      mockStorage.listFiles.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it("should return all worktrees", async () => {
      const dto1 = {
        path: "/path/to/repo/worktrees/feature-1",
        branch: "feature-1",
      };
      const dto2 = {
        path: "/path/to/repo/worktrees/feature-2",
        branch: "feature-2",
      };

      mockStorage.listFiles.mockResolvedValue([
        "wt_12345.json",
        "wt_67890.json",
      ]);

      mockStorage.readJSON.mockImplementation((path: string) => {
        if (path.includes("wt_12345")) return Promise.resolve(dto1);
        if (path.includes("wt_67890")) return Promise.resolve(dto2);
        return Promise.resolve(null);
      });

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe("/path/to/repo/worktrees/feature-1");
      expect(result[1].path).toBe("/path/to/repo/worktrees/feature-2");
    });
  });

  describe("delete", () => {
    it("should delete a worktree", async () => {
      mockStorage.deleteFile.mockResolvedValue(undefined);

      await repository.delete("/path/to/repo/worktrees/feature");

      expect(mockStorage.deleteFile).toHaveBeenCalled();
      const callArgs = mockStorage.deleteFile.mock.calls[0];
      expect(callArgs[0]).toMatch(/^worktrees\/wt_\d+\.json$/);
    });
  });

  describe("exists", () => {
    it("should return false if worktree does not exist", async () => {
      mockStorage.fileExists.mockResolvedValue(false);

      const result = await repository.exists("/nonexistent/path");

      expect(result).toBe(false);
    });

    it("should return true if worktree exists", async () => {
      mockStorage.fileExists.mockResolvedValue(true);

      const result = await repository.exists("/path/to/repo/worktrees/feature");

      expect(result).toBe(true);
    });
  });
});
