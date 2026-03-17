/**
 * TaskLifecycleManager unit tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskLifecycleManager } from "./TaskLifecycleManager";
import type { TaskLifecycleManagerDependencies } from "./TaskLifecycleManager";
import { Task } from "../../domain/entities/Task";
import { Workspace } from "../../domain/entities/Workspace";
import { Worktree } from "../../domain/entities/Worktree";

// Mock @talos/git package
vi.mock("@talos/git", () => ({
  GitWorktree: vi.fn().mockImplementation(() => ({
    isWorktree: vi.fn().mockResolvedValue({ success: true, data: false }),
    create: vi.fn().mockResolvedValue({ success: true, data: "" }),
    createFromBranch: vi.fn().mockResolvedValue({ success: true, data: "" }),
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

// Mock Worktree.create to avoid actual Git operations
vi.mock("../../domain/entities/Worktree", async (importOriginal) => {
  const actual = await importOriginal<typeof Worktree>();
  return {
    ...actual,
    Worktree: {
      ...actual.Worktree,
      create: vi.fn().mockResolvedValue({
        path: "/path/to/workspace/worktrees/workspace-my-prd",
        branch: "ralph/my-prd",
        existsInGit: async () => true,
        switchToBranch: async () => ({ success: true }),
        getCurrentBranch: async () => "ralph/my-prd",
        remove: async () => ({ success: true }),
        toDTO: () => ({
          path: "/path/to/workspace/worktrees/workspace-my-prd",
          branch: "ralph/my-prd",
        }),
        getSummary: () => "Worktree [ralph/my-prd] at /path/to/workspace/worktrees/workspace-my-prd",
      }),
    },
  };
});

// Mock dependencies
const mockWorkspaceRepository = {
  findAll: vi.fn(),
  findById: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
  findByPath: vi.fn(),
  findByPathContains: vi.fn(),
  findByName: vi.fn(),
  count: vi.fn(),
};

const mockProcessManager = {
  spawn: vi.fn(),
  register: vi.fn(),
  stop: vi.fn(),
  stopProcessGroup: vi.fn(),
  stopLegacy: vi.fn(),
  isAlive: vi.fn(),
  isAliveSync: vi.fn(),
  on: vi.fn(),
  get: vi.fn(),
};

const mockEventBus = {
  publish: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  emit: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  audit: vi.fn(),
  setLevel: vi.fn(),
  getLevel: vi.fn(),
};

describe("TaskLifecycleManager", () => {
  let lifecycleManager: TaskLifecycleManager;
  let deps: TaskLifecycleManagerDependencies;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup dependencies
    deps = {
      processManager: mockProcessManager as any,
      eventBus: mockEventBus as any,
      logger: mockLogger as any,
      basePath: "/tmp/.talos",
      workspaceRepository: mockWorkspaceRepository as any,
    };

    lifecycleManager = new TaskLifecycleManager(deps);
  });

  describe("startTask", () => {
    it("should create a new task and spawn process", async () => {
      // Arrange
      const prdId = "my-prd";
      const workingDir = "/path/to/workspace";
      const debug = false;
      const tool = "claude";
      const model = "sonnet-4";

      const workspaceConfig = {
        id: "ws-1",
        name: "workspace",
        path: "/path/to/workspace",
        branch: "main",
        worktrees: [],
        terminals: [],
        expanded: false,
      };

      mockWorkspaceRepository.findAll.mockResolvedValue([workspaceConfig]);
      mockWorkspaceRepository.findByPathContains.mockResolvedValue(workspaceConfig);
      mockProcessManager.register.mockResolvedValue(12345);
      mockProcessManager.isAlive.mockResolvedValue(true);
      mockEventBus.emit.mockResolvedValue(undefined);

      // Mock Worktree.create to return a mock worktree object
      const mockWorktree = {
        id: "workspace-my-prd",
        workspace: null,
        prdId: "my-prd",
        branch: "ralph/my-prd",
        path: "/path/to/workspace/worktrees/workspace-my-prd",
        getPrdDir: () => "/path/to/workspace/worktrees/workspace-my-prd/ralph/my-prd",
        getLogPath: () => "/path/to/workspace/.talos/logs/workspace-my-prd.log",
        getRepoRoot: () => "/path/to/workspace",
        existsInGit: async () => true,
        toDTO: () => ({
          id: "workspace-my-prd",
          workspacePath: "/path/to/workspace",
          prdId: "my-prd",
          branch: "ralph/my-prd",
        }),
      };

      // @ts-expect-error - Mocking Worktree.create
      vi.mocked(Worktree).create.mockResolvedValue(mockWorktree);

      // Mock PRD file reading
      vi.doMock("fs", () => ({
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => JSON.stringify({ branchName: "ralph/custom" })),
      }));

      // Act
      const result = await lifecycleManager.startTask(prdId, workingDir, debug, tool, model);

      // Assert
      expect(result.taskId).toBe("workspace-my-prd");
      expect(result.processId).toBe("workspace-my-prd");
      expect(result.pid).toBe(12345);

      expect(mockProcessManager.register).toHaveBeenCalled();
      expect(mockProcessManager.isAlive).toHaveBeenCalledWith(12345);
      expect(mockEventBus.emit).toHaveBeenCalledWith("task:started", expect.objectContaining({
        taskId: "workspace-my-prd",
        prdId: "my-prd",
      }));
    });

    it("should verify process is running before saving state", async () => {
      // Arrange
      const prdId = "my-prd";
      const workingDir = "/path/to/workspace";

      const workspaceConfig = {
        id: "ws-1",
        name: "workspace",
        path: "/path/to/workspace",
        branch: "main",
        worktrees: [],
        terminals: [],
        expanded: false,
      };

      mockWorkspaceRepository.findAll.mockResolvedValue([workspaceConfig]);
      mockWorkspaceRepository.findByPathContains.mockResolvedValue(workspaceConfig);
      mockProcessManager.register.mockResolvedValue(12345);
      mockProcessManager.isAlive.mockResolvedValue(false); // Process died immediately

      // Mock Worktree.create to return a mock worktree object
      const mockWorktree = {
        id: "workspace-my-prd",
        workspace: null,
        prdId: "my-prd",
        branch: "ralph/my-prd",
        path: "/path/to/workspace/worktrees/workspace-my-prd",
        getPrdDir: () => "/path/to/workspace/worktrees/workspace-my-prd/ralph/my-prd",
        getLogPath: () => "/path/to/workspace/.talos/logs/workspace-my-prd.log",
        getRepoRoot: () => "/path/to/workspace",
        existsInGit: async () => true,
        toDTO: () => ({
          id: "workspace-my-prd",
          workspacePath: "/path/to/workspace",
          prdId: "my-prd",
          branch: "ralph/my-prd",
        }),
      };

      // @ts-expect-error - Mocking Worktree.create
      vi.mocked(Worktree).create.mockResolvedValue(mockWorktree);

      // Act & Assert
      await expect(
        lifecycleManager.startTask(prdId, workingDir)
      ).rejects.toThrow("Process 12345 died immediately after spawn");

      expect(mockProcessManager.isAlive).toHaveBeenCalledWith(12345);
    });
  });

  describe("stopTask", () => {
    it("should stop a running task", async () => {
      // Arrange
      const processId = "workspace-my-prd";
      const pid = 12345;

      const workspaceConfig = {
        id: "ws-1",
        name: "workspace",
        path: "/path/to/workspace",
        branch: "main",
      };

      mockWorkspaceRepository.findAll.mockResolvedValue([workspaceConfig]);

      // Mock TaskRepository.findById to return a task
      const mockTaskRepository = {
        findById: vi.fn().mockResolvedValue({
          id: processId,
          pid,
          worktree: { path: "/path/to/workspace/worktrees/workspace-my-prd" },
          status: "running",
          stop: vi.fn(),
        }),
        save: vi.fn(),
      };

      mockProcessManager.stopProcessGroup.mockResolvedValue(new Map());

      // Act
      await lifecycleManager.stopTask(processId);

      // Assert
      expect(mockProcessManager.stopProcessGroup).toHaveBeenCalledWith(pid, "SIGTERM");
    });

    it("should throw error if task not found", async () => {
      // Arrange
      const processId = "nonexistent-task";

      mockWorkspaceRepository.findAll.mockResolvedValue([]);

      // Act & Assert
      await expect(lifecycleManager.stopTask(processId)).rejects.toThrow(
        "Process nonexistent-task not found"
      );
    });
  });

  describe("resumeTask", () => {
    it("should resume a stopped task", async () => {
      // Arrange
      const processId = "workspace-my-prd";
      const debug = true;
      const tool = "cursor";
      const pid = 12345;

      const workspaceConfig = {
        id: "ws-1",
        name: "workspace",
        path: "/path/to/workspace",
        branch: "main",
      };

      mockWorkspaceRepository.findAll.mockResolvedValue([workspaceConfig]);

      const task = Task.create({
        id: processId,
        title: "Test Task",
        description: "Test",
        command: "test",
        workspace: "workspace",
        prd: {
          id: "my-prd",
          project: "test",
          description: "test",
          branchName: "main",
          userStories: [],
          status: "draft",
          createdAt: Date.now(),
        },
        branch: "main",
        worktree: {
          path: "/path/to/workspace/worktrees/workspace-my-prd",
          branch: "main",
          existsInGit: async () => true,
        },
        timestamp: Date.now(),
        status: "stopped",
      });

      // Mock TaskRepository methods
      const mockTaskRepository = {
        findById: vi.fn().mockResolvedValue(task),
        save: vi.fn(),
      };

      mockProcessManager.register.mockResolvedValue(pid);
      mockProcessManager.isAlive.mockResolvedValue(true);

      // Mock fs.access
      vi.doMock("fs/promises", () => ({
        access: vi.fn().mockResolvedValue(undefined),
      }));

      // Act
      await lifecycleManager.resumeTask(processId, debug, tool);

      // Assert
      expect(mockProcessManager.register).toHaveBeenCalled();
      expect(mockProcessManager.isAlive).toHaveBeenCalledWith(pid);
    });

    it("should verify process is running before saving state on resume", async () => {
      // Arrange
      const processId = "workspace-my-prd";

      const workspaceConfig = {
        id: "ws-1",
        name: "workspace",
        path: "/path/to/workspace",
        branch: "main",
      };

      mockWorkspaceRepository.findAll.mockResolvedValue([workspaceConfig]);

      const task = Task.create({
        id: processId,
        title: "Test Task",
        description: "Test",
        command: "test",
        workspace: "workspace",
        prd: {
          id: "my-prd",
          project: "test",
          description: "test",
          branchName: "main",
          userStories: [],
          status: "draft",
          createdAt: Date.now(),
        },
        branch: "main",
        worktree: {
          path: "/path/to/workspace/worktrees/workspace-my-prd",
          branch: "main",
          existsInGit: async () => true,
        },
        timestamp: Date.now(),
        status: "stopped",
      });

      mockProcessManager.register.mockResolvedValue(12345);
      mockProcessManager.isAlive.mockResolvedValue(false); // Process died immediately

      // Act & Assert
      await expect(
        lifecycleManager.resumeTask(processId)
      ).rejects.toThrow("Process 12345 died immediately after spawn");

      expect(mockProcessManager.isAlive).toHaveBeenCalledWith(12345);
    });

    it("should throw error if task not found", async () => {
      // Arrange
      const processId = "nonexistent-task";

      mockWorkspaceRepository.findAll.mockResolvedValue([]);

      // Act & Assert
      await expect(lifecycleManager.resumeTask(processId)).rejects.toThrow(
        "Task nonexistent-task not found in storage"
      );
    });

    it("should throw error if task is not in stopped state", async () => {
      // Arrange
      const processId = "workspace-my-prd";

      const workspaceConfig = {
        id: "ws-1",
        name: "workspace",
        path: "/path/to/workspace",
        branch: "main",
      };

      mockWorkspaceRepository.findAll.mockResolvedValue([workspaceConfig]);

      const task = Task.create({
        id: processId,
        title: "Test Task",
        description: "Test",
        command: "test",
        workspace: "workspace",
        prd: {
          id: "my-prd",
          project: "test",
          description: "test",
          branchName: "main",
          userStories: [],
          status: "draft",
          createdAt: Date.now(),
        },
        branch: "main",
        worktree: {
          path: "/path/to/workspace/worktrees/workspace-my-prd",
          branch: "main",
          existsInGit: async () => true,
        },
        timestamp: Date.now(),
        status: "in_progress", // Not stopped
      });

      // Act & Assert
      await expect(lifecycleManager.resumeTask(processId)).rejects.toThrow(
        "Cannot resume task with status: in_progress"
      );
    });
  });
});
