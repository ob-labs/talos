/**
 * Tests for talos workspace add command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { addWorkspaceCommand } from "./add.js";
import { Workspace, WorkspaceRepository } from "@talos/core";
import * as storage from "@talos/core";

// Mock @talos/core
vi.mock("@talos/core", () => ({
  Workspace: {
    create: vi.fn(),
  },
  WorkspaceRepository: vi.fn(),
  isGitRepo: vi.fn(),
  getRepoRootPath: vi.fn(),
  initializeTalosProject: vi.fn(),
}));

describe("workspace add command", () => {
  const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
  const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit called");
  });

  const mockFindByName = vi.fn();
  const mockSave = vi.fn();
  const mockDelete = vi.fn();
  const MockWorkspaceRepository = vi.mocked(WorkspaceRepository);
  const MockWorkspace = vi.mocked(Workspace);

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock for WorkspaceRepository
    MockWorkspaceRepository.mockImplementation(() => ({
      findByName: mockFindByName,
      save: mockSave,
      delete: mockDelete,
    } as unknown as WorkspaceRepository));

    mockFindByName.mockReset();
    mockSave.mockReset();
    mockDelete.mockReset();

    // Set up default mocks for utility functions
    (storage.isGitRepo as any).mockResolvedValue(true);
    (storage.getRepoRootPath as any).mockResolvedValue(process.cwd());
    (storage.initializeTalosProject as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  describe("path validation", () => {
    it("should show error if path does not exist", async () => {
      mockFindByName.mockResolvedValue(null);
      (storage.isGitRepo as any).mockResolvedValue(false);

      // Use a path that definitely doesn't exist
      await expect(
        addWorkspaceCommand({ path: "/nonexistent/path/that/does/not/exist/12345" })
      ).rejects.toThrow("process.exit called");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "错误：当前目录不是 Git 仓库，请先运行 git init 初始化仓库"
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should accept current directory as valid path", async () => {
      mockFindByName.mockResolvedValue(null);
      MockWorkspace.create.mockReturnValue({
        id: "ws-123",
        name: "test-workspace",
        path: process.cwd(),
        branch: "main",
      });

      await addWorkspaceCommand({ name: "test-workspace" });

      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe("workspace name", () => {
    it("should use provided --name option", async () => {
      mockFindByName.mockResolvedValue(null);
      MockWorkspace.create.mockReturnValue({
        id: "ws-123",
        name: "my-workspace",
        path: process.cwd(),
        branch: "main",
      });

      await addWorkspaceCommand({ name: "my-workspace" });

      expect(mockSave).toHaveBeenCalled();
    });

    it("should use directory name when --name not provided", async () => {
      mockFindByName.mockResolvedValue(null);
      MockWorkspace.create.mockReturnValue({
        id: "ws-123",
        name: expect.any(String),
        path: process.cwd(),
        branch: "main",
      });

      await addWorkspaceCommand({});

      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe("existing workspace", () => {
    it("should show message and exit if workspace already exists", async () => {
      mockFindByName.mockResolvedValue({
        id: "ws-1",
        name: "existing-workspace",
        path: "/some/path",
        branch: "main",
      });

      await expect(
        addWorkspaceCommand({ name: "existing-workspace" })
      ).rejects.toThrow("process.exit called");

      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Workspace 已存在：existing-workspace"
      );
      expect(mockProcessExit).toHaveBeenCalledWith(0);
      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  describe("success cases", () => {
    it("should add workspace and show success message", async () => {
      mockFindByName.mockResolvedValue(null);
      MockWorkspace.create.mockReturnValue({
        id: "ws-123",
        name: "my-workspace",
        path: process.cwd(),
        branch: "main",
      });

      await addWorkspaceCommand({ name: "my-workspace" });

      expect(mockSave).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        `✓ Workspace 已添加，.talos 目录已初始化`
      );
    });
  });

  describe("error handling", () => {
    it("should handle findByName errors", async () => {
      mockFindByName.mockRejectedValue(new Error("Database error"));

      await expect(
        addWorkspaceCommand({ name: "my-workspace" })
      ).rejects.toThrow("process.exit called");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error adding workspace:",
        "Database error"
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should handle save errors", async () => {
      mockFindByName.mockResolvedValue(null);
      mockSave.mockRejectedValue(new Error("Write error"));
      MockWorkspace.create.mockReturnValue({
        id: "ws-123",
        name: "my-workspace",
        path: process.cwd(),
        branch: "main",
      });

      await expect(
        addWorkspaceCommand({ name: "my-workspace" })
      ).rejects.toThrow("process.exit called");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error adding workspace:",
        "Write error"
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});
