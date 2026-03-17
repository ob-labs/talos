import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitService } from "./git-service";
import { GitError } from "@talos/types";
import { exec } from "child_process";

// Mock child_process.exec
vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

describe("GitService", () => {
  let gitService: GitService;

  beforeEach(() => {
    gitService = new GitService();
    vi.clearAllMocks();
  });

  describe("createWorktree", () => {
    it("should execute correct git command to create worktree", async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, callback) => {
        callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });

      await gitService.createWorktree(
        "/path/to/repo",
        "feature-branch",
        "/path/to/worktree"
      );

      expect(mockExec).toHaveBeenCalledWith(
        'cd "/path/to/repo" && git worktree add "/path/to/worktree" -b "feature-branch"',
        expect.any(Function)
      );
    });

    it("should throw GitError on command failure", async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, callback) => {
        callback(new Error("Command failed"), { stdout: "", stderr: "Error" });
        return {} as any;
      });

      await expect(
        gitService.createWorktree("/path/to/repo", "feature-branch", "/path/to/worktree")
      ).rejects.toThrow(GitError);
    });
  });

  describe("deleteWorktree", () => {
    it("should execute correct git command to delete worktree", async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, callback) => {
        callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });

      await gitService.deleteWorktree("/path/to/worktree");

      expect(mockExec).toHaveBeenCalledWith(
        'git worktree remove "/path/to/worktree"',
        expect.any(Function)
      );
    });

    it("should throw GitError on command failure", async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, callback) => {
        callback(new Error("Command failed"), { stdout: "", stderr: "Error" });
        return {} as any;
      });

      await expect(gitService.deleteWorktree("/path/to/worktree")).rejects.toThrow(GitError);
    });
  });

  describe("listWorktrees", () => {
    it("should parse porcelain output correctly", async () => {
      const mockExec = vi.mocked(exec);
      const porcelainOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/main
worktree /path/to/feature
HEAD def456
branch refs/heads/feature-branch
detached`;

      mockExec.mockImplementation((command, callback) => {
        callback(null, { stdout: porcelainOutput, stderr: "" });
        return {} as any;
      });

      const worktrees = await gitService.listWorktrees("/path/to/repo");

      expect(worktrees).toHaveLength(2);
      expect(worktrees[0]).toEqual({
        path: "/path/to/main",
        commit: "abc123",
        branch: "main",
        isBare: false,
        isDetached: false,
      });
      expect(worktrees[1]).toEqual({
        path: "/path/to/feature",
        commit: "def456",
        branch: "feature-branch",
        isBare: false,
        isDetached: true,
      });
    });

    it("should handle bare worktrees", async () => {
      const mockExec = vi.mocked(exec);
      const porcelainOutput = `worktree /path/to/bare
HEAD ghi789
bare`;

      mockExec.mockImplementation((command, callback) => {
        callback(null, { stdout: porcelainOutput, stderr: "" });
        return {} as any;
      });

      const worktrees = await gitService.listWorktrees("/path/to/repo");

      expect(worktrees).toHaveLength(1);
      expect(worktrees[0]).toEqual({
        path: "/path/to/bare",
        commit: "ghi789",
        branch: undefined,
        isBare: true,
        isDetached: false,
      });
    });

    it("should throw GitError on command failure", async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, callback) => {
        callback(new Error("Command failed"), { stdout: "", stderr: "Error" });
        return {} as any;
      });

      await expect(gitService.listWorktrees("/path/to/repo")).rejects.toThrow(GitError);
    });
  });

  describe("getWorktreeInfo", () => {
    it("should return worktree info if found", async () => {
      const mockExec = vi.mocked(exec);
      const porcelainOutput = `worktree /path/to/feature-abc
HEAD def456
branch refs/heads/feature-branch`;

      mockExec.mockImplementation((command, callback) => {
        callback(null, { stdout: porcelainOutput, stderr: "" });
        return {} as any;
      });

      const info = await gitService.getWorktreeInfo("/path/to/repo", "feature-abc");

      expect(info).not.toBeNull();
      expect(info?.path).toContain("feature-abc");
    });

    it("should return null if worktree not found", async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, callback) => {
        callback(null, { stdout: "worktree /path/to/other\nHEAD abc123", stderr: "" });
        return {} as any;
      });

      const info = await gitService.getWorktreeInfo("/path/to/repo", "non-existent");

      expect(info).toBeNull();
    });

    it("should return null on error", async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, callback) => {
        callback(new Error("Failed"), { stdout: "", stderr: "Error" });
        return {} as any;
      });

      const info = await gitService.getWorktreeInfo("/path/to/repo", "feature-abc");

      expect(info).toBeNull();
    });
  });

  describe("getStoryInfo", () => {
    it("should extract story info from worktree branch", async () => {
      const mockExec = vi.mocked(exec);
      const porcelainOutput = `worktree /path/to/US-001
HEAD def456
branch refs/heads/feature/US-001-implement-feature`;

      mockExec.mockImplementation((command, callback) => {
        callback(null, { stdout: porcelainOutput, stderr: "" });
        return {} as any;
      });

      const storyInfo = await gitService.getStoryInfo("/path/to/repo", "US-001");

      expect(storyInfo).not.toBeNull();
      expect(storyInfo?.id).toBe("US-001");
      expect(storyInfo?.title).toBe("US-001-implement-feature");
      expect(storyInfo?.status).toBe("in_progress");
    });

    it("should return null if worktree not found", async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, callback) => {
        callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });

      const storyInfo = await gitService.getStoryInfo("/path/to/repo", "non-existent");

      expect(storyInfo).toBeNull();
    });

    it("should return null on error", async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((command, callback) => {
        callback(new Error("Failed"), { stdout: "", stderr: "Error" });
        return {} as any;
      });

      const storyInfo = await gitService.getStoryInfo("/path/to/repo", "US-001");

      expect(storyInfo).toBeNull();
    });
  });
});
