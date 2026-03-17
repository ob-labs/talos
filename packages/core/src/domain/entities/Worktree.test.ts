/**
 * Worktree Entity Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Worktree } from "./Worktree";

// Mock @talos/git
vi.mock("@talos/git", () => ({
  GitWorktree: vi.fn().mockImplementation(() => ({
    isWorktree: vi.fn().mockResolvedValue({ success: true, data: false }),
    createFromBranch: vi.fn().mockResolvedValue({ success: true, data: "" }),
    create: vi.fn().mockResolvedValue({ success: true, data: "" }),
    remove: vi.fn().mockResolvedValue({ success: true, data: "" }),
  })),
  GitBranch: vi.fn().mockImplementation(() => ({
    exists: vi.fn().mockResolvedValue({ success: true, data: false }),
    switch: vi.fn().mockResolvedValue({ success: true }),
  })),
  GitRepository: vi.fn().mockImplementation(() => ({
    getCurrentBranch: vi.fn().mockResolvedValue({ success: true, data: "main" }),
  })),
}));

describe("Worktree", () => {
  const repoRoot = "/path/to/repo";

  describe("fromProperties", () => {
    it("should create a Worktree from properties", () => {
      const worktree = Worktree.fromProperties({
        path: "/path/to/repo/worktrees/feature",
        branch: "feature-branch",
      });

      expect(worktree.path).toBe("/path/to/repo/worktrees/feature");
      expect(worktree.branch).toBe("feature-branch");
    });

    it("should have readonly properties", () => {
      const worktree = Worktree.fromProperties({
        path: "/path/to/repo/worktrees/feature",
        branch: "feature-branch",
      });

      // Readonly is compile-time only, just verify the values
      expect(worktree.path).toBe("/path/to/repo/worktrees/feature");
      expect(worktree.branch).toBe("feature-branch");
    });
  });

  describe("fromDTO", () => {
    it("should create a Worktree from DTO", () => {
      const dto = {
        path: "/path/to/repo/worktrees/feature",
        branch: "feature-branch",
      };

      const worktree = Worktree.fromDTO(dto);

      expect(worktree.path).toBe("/path/to/repo/worktrees/feature");
      expect(worktree.branch).toBe("feature-branch");
    });
  });

  describe("toDTO", () => {
    it("should convert to DTO correctly", () => {
      const worktree = Worktree.fromProperties({
        path: "/path/to/repo/worktrees/feature",
        branch: "feature-branch",
      });

      const dto = worktree.toDTO();

      expect(dto.path).toBe("/path/to/repo/worktrees/feature");
      expect(dto.branch).toBe("feature-branch");
    });

    it("should support round-trip conversion", () => {
      const original = Worktree.fromProperties({
        path: "/path/to/repo/worktrees/feature",
        branch: "feature-branch",
      });

      const dto = original.toDTO();
      const restored = Worktree.fromDTO(dto);

      expect(restored.path).toBe(original.path);
      expect(restored.branch).toBe(original.branch);
    });
  });

  describe("getSummary", () => {
    it("should return a readable summary", () => {
      const worktree = Worktree.fromProperties({
        path: "/path/to/repo/worktrees/feature",
        branch: "feature-branch",
      });

      const summary = worktree.getSummary();
      expect(summary).toBe("Worktree [feature-branch] at /path/to/repo/worktrees/feature");
    });
  });

  describe("Git operations", () => {
    it("should check if worktree exists in Git", async () => {
      const worktree = Worktree.fromProperties({
        path: "/path/to/repo/worktrees/feature",
        branch: "feature-branch",
      });

      const exists = await worktree.existsInGit(repoRoot);
      expect(exists).toBe(false); // Mock returns false
    });

    it("should switch branch", async () => {
      const worktree = Worktree.fromProperties({
        path: "/path/to/repo/worktrees/feature",
        branch: "feature-branch",
      });

      const result = await worktree.switchToBranch();
      expect(result.success).toBe(true);
    });

    it("should get current branch", async () => {
      const worktree = Worktree.fromProperties({
        path: "/path/to/repo/worktrees/feature",
        branch: "feature-branch",
      });

      const branch = await worktree.getCurrentBranch();
      expect(branch).toBe("main"); // Mock returns "main"
    });

    it("should remove worktree", async () => {
      const worktree = Worktree.fromProperties({
        path: "/path/to/repo/worktrees/feature",
        branch: "feature-branch",
      });

      const result = await worktree.remove(repoRoot);
      expect(result.success).toBe(true);
    });
  });
});
