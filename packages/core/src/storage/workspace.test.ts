import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { WorkspaceStorage } from "./workspace";
import { LocalStorageEngine } from "./index";

describe("WorkspaceStorage", () => {
  let tempDir: string;
  let storage: LocalStorageEngine;
  let workspaceStorage: WorkspaceStorage;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "workspace-test-"));
    storage = new LocalStorageEngine(tempDir);
    workspaceStorage = new WorkspaceStorage(storage);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("createWorkspace", () => {
    it("should create a workspace with correct properties", async () => {
      const workspace = await workspaceStorage.createWorkspace(
        "Talos",
        "main",
        "/Users/qingquan/workspaces/personal/talos"
      );

      expect(workspace.id).toBe("ws-talos");
      expect(workspace.name).toBe("Talos");
      expect(workspace.branch).toBe("main");
      expect(workspace.path).toBe("/Users/qingquan/workspaces/personal/talos");
      expect(workspace.worktrees).toEqual([]);
      expect(workspace.terminals).toEqual([]);
      expect(workspace.expanded).toBe(true);
    });

    it("should persist workspace to file", async () => {
      const workspace = await workspaceStorage.createWorkspace(
        "Test Project",
        "develop",
        "/path/to/project"
      );

      const filePath = path.join(tempDir, "workspaces", `${workspace.id}.json`);
      const fileContent = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(fileContent);

      expect(parsed.name).toBe("Test Project");
      expect(parsed.branch).toBe("develop");
    });
  });

  describe("getWorkspace", () => {
    it("should return workspace by id", async () => {
      const created = await workspaceStorage.createWorkspace(
        "Talos",
        "main",
        "/path/to/talos"
      );

      const retrieved = await workspaceStorage.getWorkspace(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe("Talos");
    });

    it("should return null for non-existent workspace", async () => {
      const result = await workspaceStorage.getWorkspace("non-existent-id");
      expect(result).toBeNull();
    });
  });

  describe("getAllWorkspaces", () => {
    it("should return all workspaces", async () => {
      await workspaceStorage.createWorkspace("Project A", "main", "/path/a");
      await workspaceStorage.createWorkspace("Project B", "develop", "/path/b");

      const workspaces = await workspaceStorage.getAllWorkspaces();

      expect(workspaces).toHaveLength(2);
      expect(workspaces.map((w) => w.name).sort()).toEqual(["Project A", "Project B"]);
    });

    it("should return empty array when no workspaces exist", async () => {
      const workspaces = await workspaceStorage.getAllWorkspaces();
      expect(workspaces).toEqual([]);
    });
  });

  describe("updateWorkspace", () => {
    it("should update workspace properties", async () => {
      const created = await workspaceStorage.createWorkspace(
        "Old Name",
        "main",
        "/old/path"
      );

      const updated = await workspaceStorage.updateWorkspace(created.id, {
        name: "New Name",
        branch: "develop",
      });

      expect(updated?.name).toBe("New Name");
      expect(updated?.branch).toBe("develop");
      expect(updated?.path).toBe("/old/path"); // Unchanged
    });

    it("should return null for non-existent workspace", async () => {
      const result = await workspaceStorage.updateWorkspace("non-existent", {
        name: "New Name",
      });
      expect(result).toBeNull();
    });
  });

  describe("deleteWorkspace", () => {
    it("should delete workspace and return true", async () => {
      const created = await workspaceStorage.createWorkspace(
        "To Delete",
        "main",
        "/path/to/delete"
      );

      const deleted = await workspaceStorage.deleteWorkspace(created.id);

      expect(deleted).toBe(true);
      const retrieved = await workspaceStorage.getWorkspace(created.id);
      expect(retrieved).toBeNull();
    });

    it("should return false for non-existent workspace", async () => {
      const result = await workspaceStorage.deleteWorkspace("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("addWorktreeToWorkspace (backward compat - adds worktree)", () => {
    it("should add worktree to workspace", async () => {
      const workspace = await workspaceStorage.createWorkspace(
        "Talos",
        "main",
        "/path/to/talos"
      );

      const updated = await workspaceStorage.addWorktreeToWorkspace(workspace.id, "worktree-1");

      expect(updated?.worktrees).toContain("worktree-1");
    });

    it("should not add duplicate worktree", async () => {
      const workspace = await workspaceStorage.createWorkspace(
        "Talos",
        "main",
        "/path/to/talos"
      );

      await workspaceStorage.addWorktreeToWorkspace(workspace.id, "worktree-1");
      await workspaceStorage.addWorktreeToWorkspace(workspace.id, "worktree-1");

      const retrieved = await workspaceStorage.getWorkspace(workspace.id);
      expect(retrieved?.worktrees).toHaveLength(1);
    });
  });


  describe("toggleExpanded", () => {
    it("should toggle expanded state", async () => {
      const workspace = await workspaceStorage.createWorkspace(
        "Talos",
        "main",
        "/path/to/talos"
      );

      expect(workspace.expanded).toBe(true);

      const collapsed = await workspaceStorage.toggleExpanded(workspace.id);
      expect(collapsed?.expanded).toBe(false);

      const expanded = await workspaceStorage.toggleExpanded(workspace.id);
      expect(expanded?.expanded).toBe(true);
    });
  });

  describe("workspaceExists", () => {
    it("should return true for existing workspace", async () => {
      const workspace = await workspaceStorage.createWorkspace(
        "Talos",
        "main",
        "/path/to/talos"
      );

      const exists = await workspaceStorage.workspaceExists(workspace.id);
      expect(exists).toBe(true);
    });

    it("should return false for non-existent workspace", async () => {
      const exists = await workspaceStorage.workspaceExists("non-existent");
      expect(exists).toBe(false);
    });
  });

  describe("addTerminalSession", () => {
    it("should add terminal session to workspace", async () => {
      const workspace = await workspaceStorage.createWorkspace(
        "Talos",
        "main",
        "/path/to/talos"
      );

      const updated = await workspaceStorage.addTerminalSession(
        workspace.id,
        "sess-123",
        12345
      );

      expect(updated?.terminals).toHaveLength(1);
      expect(updated?.terminals[0].id).toBe("sess-123");
      expect(updated?.terminals[0].shellPid).toBe(12345);
      expect(updated?.terminals[0].createdAt).toBeGreaterThan(0);
      expect(updated?.terminals[0].lastActiveAt).toBeGreaterThan(0);
    });

    it("should limit terminals to 50 sessions", async () => {
      const workspace = await workspaceStorage.createWorkspace(
        "Talos",
        "main",
        "/path/to/talos"
      );

      // Add 55 sessions
      for (let i = 0; i < 55; i++) {
        await workspaceStorage.addTerminalSession(
          workspace.id,
          `sess-${i}`,
          10000 + i
        );
      }

      const updated = await workspaceStorage.getWorkspace(workspace.id);
      expect(updated?.terminals).toHaveLength(50);
      // Should keep the last 50 sessions
      expect(updated?.terminals[0].id).toBe("sess-5");
      expect(updated?.terminals[49].id).toBe("sess-54");
    });

    it("should return null for non-existent workspace", async () => {
      const result = await workspaceStorage.addTerminalSession(
        "non-existent",
        "sess-123",
        12345
      );
      expect(result).toBeNull();
    });
  });

  describe("updateTerminalSessionActive", () => {
    it("should update lastActiveAt timestamp", async () => {
      const workspace = await workspaceStorage.createWorkspace(
        "Talos",
        "main",
        "/path/to/talos"
      );

      await workspaceStorage.addTerminalSession(workspace.id, "sess-123", 12345);

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await workspaceStorage.updateTerminalSessionActive(
        workspace.id,
        "sess-123"
      );

      if (!updated || !updated.terminals[0]) {
        throw new Error("Workspace or terminal session not found");
      }

      expect(updated.terminals[0].lastActiveAt).toBeGreaterThan(
        updated.terminals[0].createdAt
      );
    });

    it("should return null for non-existent workspace", async () => {
      const result = await workspaceStorage.updateTerminalSessionActive(
        "non-existent",
        "sess-123"
      );
      expect(result).toBeNull();
    });
  });

  describe("getMostRecentTerminalSession", () => {
    it("should return the most recent session", async () => {
      const workspace = await workspaceStorage.createWorkspace(
        "Talos",
        "main",
        "/path/to/talos"
      );

      await workspaceStorage.addTerminalSession(workspace.id, "sess-1", 111);
      await workspaceStorage.addTerminalSession(workspace.id, "sess-2", 222);
      await workspaceStorage.addTerminalSession(workspace.id, "sess-3", 333);

      // Reload the workspace to get updated terminals array
      const updatedWorkspace = await workspaceStorage.getWorkspace(workspace.id);
      const recent = workspaceStorage.getMostRecentTerminalSession(updatedWorkspace!);
      expect(recent?.id).toBe("sess-3");
    });

    it("should return null when no sessions exist", async () => {
      const workspace = await workspaceStorage.createWorkspace(
        "Talos",
        "main",
        "/path/to/talos"
      );

      const recent = workspaceStorage.getMostRecentTerminalSession(workspace);
      expect(recent).toBeNull();
    });
  });
});
