import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { WorkspaceRepository } from "./workspace-repository";
import type { IWorkspace } from "@talos/types";

describe("WorkspaceRepository", () => {
  const mockWorkspace: IWorkspace = {
    id: "ws-test-001",
    name: "Test Project",
    branch: "main",
    path: "/test/path",
    worktrees: [],
    terminals: [],
    expanded: true,
    addWorktree: () => {},
    removeWorktree: () => {},
    hasWorktree: () => false,
    addTerminal: () => {},
    getTerminals: () => [],
    clearTerminals: () => {},
    toggleExpanded: () => {}
  };

  let tempDir: string;
  let repository: WorkspaceRepository;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "workspace-repo-"));

    // Create repository with custom storage that points to temp dir
    const { LocalStorageEngine } = await import("../storage/storage");
    const customStorage = new LocalStorageEngine(tempDir);

    // Replace storage on the repository instance
    repository = new WorkspaceRepository();
    (repository as any).storage = customStorage;
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("save", () => {
    it("should save a new workspace", async () => {
      await repository.save(mockWorkspace);

      const found = await repository.findById(mockWorkspace.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe("Test Project");
      expect(found?.id).toBe(mockWorkspace.id);
    });

    it("should update an existing workspace", async () => {
      await repository.save(mockWorkspace);

      const updatedWorkspace = {
        ...mockWorkspace,
        name: "Updated Name"
      };
      await repository.save(updatedWorkspace);

      const found = await repository.findById(mockWorkspace.id);
      expect(found?.name).toBe("Updated Name");
    });

    it("should throw error if workspace has no id", async () => {
      const invalidWorkspace = { ...mockWorkspace, id: "" };

      await expect(repository.save(invalidWorkspace)).rejects.toThrow("Workspace must have an id");
    });
  });

  describe("findById", () => {
    it("should find workspace by id", async () => {
      await repository.save(mockWorkspace);

      const found = await repository.findById(mockWorkspace.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(mockWorkspace.id);
    });

    it("should return null if workspace not found", async () => {
      const found = await repository.findById("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("findAll", () => {
    it("should find all workspaces", async () => {
      const workspace2: IWorkspace = {
        ...mockWorkspace,
        id: "ws-test-002",
        name: "Second Project"
      };

      await repository.save(mockWorkspace);
      await repository.save(workspace2);

      const all = await repository.findAll();
      expect(all).toHaveLength(2);
    });

    it("should filter by branch", async () => {
      const workspace2: IWorkspace = {
        ...mockWorkspace,
        id: "ws-test-002",
        branch: "feature"
      };

      await repository.save(mockWorkspace);
      await repository.save(workspace2);

      const filtered = await repository.findAll({ branch: "main" });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].branch).toBe("main");
    });

    it("should filter by name pattern", async () => {
      const workspace2: IWorkspace = {
        ...mockWorkspace,
        id: "ws-test-002",
        name: "Another Project"
      };

      await repository.save(mockWorkspace);
      await repository.save(workspace2);

      const filtered = await repository.findAll({ name: "Test" });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Test Project");
    });

    it("should filter by path pattern", async () => {
      const workspace2: IWorkspace = {
        ...mockWorkspace,
        id: "ws-test-002",
        path: "/other/path"
      };

      await repository.save(mockWorkspace);
      await repository.save(workspace2);

      const filtered = await repository.findAll({ path: "/test" });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].path).toBe("/test/path");
    });

    it("should return empty array when no workspaces exist", async () => {
      const all = await repository.findAll();
      expect(all).toHaveLength(0);
    });
  });

  describe("delete", () => {
    it("should delete a workspace", async () => {
      await repository.save(mockWorkspace);

      await repository.delete(mockWorkspace.id);

      const found = await repository.findById(mockWorkspace.id);
      expect(found).toBeNull();
    });

    it("should throw error if workspace not found", async () => {
      await expect(repository.delete("non-existent")).rejects.toThrow("Workspace not found");
    });
  });

  describe("exists", () => {
    it("should return true if workspace exists", async () => {
      await repository.save(mockWorkspace);

      const exists = await repository.exists(mockWorkspace.id);
      expect(exists).toBe(true);
    });

    it("should return false if workspace does not exist", async () => {
      const exists = await repository.exists("non-existent");
      expect(exists).toBe(false);
    });
  });

  describe("findByPath", () => {
    it("should find workspace by path", async () => {
      await repository.save(mockWorkspace);

      const found = await repository.findByPath("/test/path");
      expect(found).not.toBeNull();
      expect(found?.path).toBe("/test/path");
    });

    it("should return null if path not found", async () => {
      const found = await repository.findByPath("/non-existent");
      expect(found).toBeNull();
    });
  });

  describe("findByName", () => {
    it("should find workspace by name", async () => {
      await repository.save(mockWorkspace);

      const found = await repository.findByName("Test Project");
      expect(found).not.toBeNull();
      expect(found?.name).toBe("Test Project");
    });

    it("should return null if name not found", async () => {
      const found = await repository.findByName("Non-existent");
      expect(found).toBeNull();
    });
  });

  describe("count", () => {
    it("should count all workspaces", async () => {
      const workspace2: IWorkspace = {
        ...mockWorkspace,
        id: "ws-test-002"
      };

      await repository.save(mockWorkspace);
      await repository.save(workspace2);

      const count = await repository.count();
      expect(count).toBe(2);
    });

    it("should count workspaces with filter", async () => {
      const workspace2: IWorkspace = {
        ...mockWorkspace,
        id: "ws-test-002",
        branch: "feature"
      };

      await repository.save(mockWorkspace);
      await repository.save(workspace2);

      const count = await repository.count({ branch: "main" });
      expect(count).toBe(1);
    });

    it("should return 0 when no workspaces exist", async () => {
      const count = await repository.count();
      expect(count).toBe(0);
    });
  });
});
