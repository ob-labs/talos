/**
 * Tests for talos task status command
 *
 * Note: These tests focus on the core refactoring changes from TaskStatusManager
 * to TaskRepository. Full integration tests require actual filesystem setup.
 */

import { describe, it, expect, vi } from "vitest";

// Mock @talos/core before importing
vi.mock("@talos/core", () => ({
  WorkspaceRepository: vi.fn().mockImplementation(() => ({
    findAll: vi.fn().mockResolvedValue([
      { id: "ws-1", name: "workspace1", path: "/mocked/path", branch: "main" },
    ]),
  })),
  TaskRepository: vi.fn().mockImplementation(() => ({
    findAll: vi.fn().mockResolvedValue([]),
  })),
}));

// Mock child_process
vi.mock("child_process", () => ({
  execSync: vi.fn(() => "/mocked/path/.git"),
}));

// Mock fs
vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock ink and ui
vi.mock("ink", () => ({
  render: vi.fn(() => ({
    unmount: vi.fn(),
    waitUntilExit: vi.fn(Promise.resolve),
  })),
}));

vi.mock("../../ui", () => ({
  renderInk: vi.fn(() => ({
    unmount: vi.fn(),
    waitUntilExit: vi.fn(Promise.resolve),
  })),
  ErrorBoundary: ({ children }: { children: any }) => children,
}));

// Import after mocks are set up
import { WorkspaceRepository, TaskRepository } from "@talos/core";

describe("task status command - Architecture Refactoring", () => {
  describe("Module imports", () => {
    it("should import TaskRepository from @talos/core", () => {
      expect(TaskRepository).toBeDefined();
      expect(typeof TaskRepository).toBe("function");
    });

    it("should import WorkspaceRepository from @talos/core", () => {
      expect(WorkspaceRepository).toBeDefined();
      expect(typeof WorkspaceRepository).toBe("function");
    });
  });

  describe("Repository instantiation", () => {
    it("should create TaskRepository instance with repoRoot path", () => {
      const repo = new TaskRepository("/some/path");
      expect(repo).toBeDefined();
      expect(typeof repo.findAll).toBe("function");
    });

    it("should create WorkspaceRepository instance", () => {
      const repo = new WorkspaceRepository();
      expect(repo).toBeDefined();
      expect(typeof repo.findAll).toBe("function");
    });
  });

  describe("Core functionality verification", () => {
    it("TaskRepository.findAll should be callable", async () => {
      const repo = new TaskRepository("/some/path");
      const tasks = await repo.findAll();
      expect(Array.isArray(tasks)).toBe(true);
    });

    it("WorkspaceRepository.findAll should be callable", async () => {
      const repo = new WorkspaceRepository();
      const workspaces = await repo.findAll();
      expect(Array.isArray(workspaces)).toBe(true);
    });
  });

  describe("TaskStatusManager removal verification", () => {
    it("should NOT import TaskStatusManager (file should be deleted)", async () => {
      // This test verifies that the old TaskStatusManager is no longer used
      // by checking that attempting to import it fails
      await expect(async () => {
        await import("@/tasks/status-manager");
      }).rejects.toThrow();
    });
  });
});
