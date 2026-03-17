import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorkspaceSessionStorage } from "./workspace-session-storage";
import type { WorkspaceConfig, SessionData } from "@talos/types";
import { StorageError } from "@talos/types";
import fs from "fs/promises";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

describe("WorkspaceSessionStorage", () => {
  let storage: WorkspaceSessionStorage;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await mkdtemp(join(tmpdir(), "talos-storage-test-"));
    storage = new WorkspaceSessionStorage(tempDir);
  });

  async function cleanup() {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  describe("Workspace Operations", () => {
    it("should return null for non-existent workspace", async () => {
      const workspace = await storage.getWorkspace("non-existent");
      expect(workspace).toBeNull();
    });

    it("should save and retrieve a workspace", async () => {
      const workspace: WorkspaceConfig = {
        id: "ws-1",
        name: "Test Workspace",
        path: "/path/to/workspace",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveWorkspace(workspace);
      const retrieved = await storage.getWorkspace("ws-1");

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe("ws-1");
      expect(retrieved?.name).toBe("Test Workspace");
      expect(retrieved?.path).toBe("/path/to/workspace");
      // updatedAt should be updated by saveWorkspace
      expect(retrieved?.updatedAt).toBeGreaterThanOrEqual(workspace.updatedAt);
    });

    it("should list all workspaces", async () => {
      const workspace1: WorkspaceConfig = {
        id: "ws-1",
        name: "Workspace 1",
        path: "/path/1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const workspace2: WorkspaceConfig = {
        id: "ws-2",
        name: "Workspace 2",
        path: "/path/2",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveWorkspace(workspace1);
      await storage.saveWorkspace(workspace2);

      const workspaces = await storage.getWorkspaces();
      expect(workspaces).toHaveLength(2);
      expect(workspaces.map((w) => w.id)).toContain("ws-1");
      expect(workspaces.map((w) => w.id)).toContain("ws-2");
    });

    it("should return empty array when no workspaces exist", async () => {
      const workspaces = await storage.getWorkspaces();
      expect(workspaces).toEqual([]);
    });

    it("should delete a workspace", async () => {
      const workspace: WorkspaceConfig = {
        id: "ws-1",
        name: "Test Workspace",
        path: "/path/to/workspace",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveWorkspace(workspace);
      expect(await storage.getWorkspace("ws-1")).not.toBeNull();

      await storage.deleteWorkspace("ws-1");
      expect(await storage.getWorkspace("ws-1")).toBeNull();
    });

    it("should handle delete of non-existent workspace gracefully", async () => {
      // Should not throw
      await storage.deleteWorkspace("non-existent");
      expect(true).toBe(true);
    });

    it("should auto-create workspaces directory", async () => {
      const workspace: WorkspaceConfig = {
        id: "ws-1",
        name: "Test Workspace",
        path: "/path/to/workspace",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveWorkspace(workspace);

      // Verify directory was created
      const workspacesDir = join(tempDir, "workspaces");
      const exists = await fs
        .access(workspacesDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      await cleanup();
    });
  });

  describe("Session Operations", () => {
    it("should return null for non-existent session", async () => {
      const session = await storage.getSession("non-existent");
      expect(session).toBeNull();
    });

    it("should save and retrieve a session", async () => {
      const session: SessionData = {
        id: "sess-1",
        prdId: "prd-1",
        roleId: "role-1",
        conversation: [
          {
            role: "user",
            content: "Hello",
            timestamp: Date.now(),
          },
          {
            role: "assistant",
            content: "Hi there!",
            timestamp: Date.now(),
          },
        ],
        lastUsedAt: Date.now(),
      };

      await storage.saveSession(session);
      const retrieved = await storage.getSession("sess-1");

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe("sess-1");
      expect(retrieved?.prdId).toBe("prd-1");
      expect(retrieved?.roleId).toBe("role-1");
      expect(retrieved?.conversation).toHaveLength(2);
      // lastUsedAt should be updated by saveSession
      expect(retrieved?.lastUsedAt).toBeGreaterThanOrEqual(session.lastUsedAt);
    });

    it("should list sessions by PRD", async () => {
      const session1: SessionData = {
        id: "sess-1",
        prdId: "prd-1",
        roleId: "role-1",
        conversation: [],
        lastUsedAt: Date.now(),
      };

      const session2: SessionData = {
        id: "sess-2",
        prdId: "prd-1",
        roleId: "role-2",
        conversation: [],
        lastUsedAt: Date.now(),
      };

      const session3: SessionData = {
        id: "sess-3",
        prdId: "prd-2",
        roleId: "role-1",
        conversation: [],
        lastUsedAt: Date.now(),
      };

      await storage.saveSession(session1);
      await storage.saveSession(session2);
      await storage.saveSession(session3);

      const prd1Sessions = await storage.getSessionsByPRD("prd-1");
      expect(prd1Sessions).toHaveLength(2);
      expect(prd1Sessions.map((s) => s.id).sort()).toEqual(["sess-1", "sess-2"]);

      const prd2Sessions = await storage.getSessionsByPRD("prd-2");
      expect(prd2Sessions).toHaveLength(1);
      expect(prd2Sessions[0].id).toBe("sess-3");
    });

    it("should return empty array when no sessions exist for PRD", async () => {
      const sessions = await storage.getSessionsByPRD("non-existent-prd");
      expect(sessions).toEqual([]);
    });

    it("should delete a session", async () => {
      const session: SessionData = {
        id: "sess-1",
        prdId: "prd-1",
        roleId: "role-1",
        conversation: [],
        lastUsedAt: Date.now(),
      };

      await storage.saveSession(session);
      expect(await storage.getSession("sess-1")).not.toBeNull();

      await storage.deleteSession("sess-1");
      expect(await storage.getSession("sess-1")).toBeNull();
    });

    it("should handle delete of non-existent session gracefully", async () => {
      // Should not throw
      await storage.deleteSession("non-existent");
      expect(true).toBe(true);
    });

    it("should auto-create sessions directory", async () => {
      const session: SessionData = {
        id: "sess-1",
        prdId: "prd-1",
        roleId: "role-1",
        conversation: [],
        lastUsedAt: Date.now(),
      };

      await storage.saveSession(session);

      // Verify directory was created
      const sessionsDir = join(tempDir, "sessions");
      const exists = await fs
        .access(sessionsDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      await cleanup();
    });
  });

  describe("Error Handling", () => {
    it("should return null for missing data (not throw)", async () => {
      // Verify that missing data returns null, not an error
      const workspace = await storage.getWorkspace("definitely-not-existent");
      expect(workspace).toBeNull();

      const session = await storage.getSession("also-not-existent");
      expect(session).toBeNull();
    });
  });

  describe("Error Scenarios", () => {
    it("should throw StorageError when LocalStorageEngine fails to read workspace", async () => {
      const badStorage = new WorkspaceSessionStorage(tempDir);

      // Get the private storage instance to mock it
      // @ts-ignore - accessing private member for testing
      const originalReadJSON = badStorage.storage.readJSON;
      // @ts-ignore
      badStorage.storage.readJSON = vi.fn().mockRejectedValue(new Error("EACCES: permission denied"));

      await expect(badStorage.getWorkspace("ws-1")).rejects.toThrow(StorageError);

      // Restore original method
      // @ts-ignore
      badStorage.storage.readJSON = originalReadJSON;
    });

    it("should throw StorageError when LocalStorageEngine fails to save workspace", async () => {
      const badStorage = new WorkspaceSessionStorage(tempDir);

      // @ts-ignore
      const originalWriteJSON = badStorage.storage.writeJSON;
      // @ts-ignore
      badStorage.storage.writeJSON = vi.fn().mockRejectedValue(new Error("ENOSPC: no space left"));

      const workspace: WorkspaceConfig = {
        id: "ws-1",
        name: "Test Workspace",
        path: "/path/to/workspace",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await expect(badStorage.saveWorkspace(workspace)).rejects.toThrow(StorageError);

      // @ts-ignore
      badStorage.storage.writeJSON = originalWriteJSON;
    });

    it("should throw StorageError when LocalStorageEngine fails to save session", async () => {
      const badStorage = new WorkspaceSessionStorage(tempDir);

      // @ts-ignore
      const originalWriteJSON = badStorage.storage.writeJSON;
      // @ts-ignore
      badStorage.storage.writeJSON = vi.fn().mockRejectedValue(new Error("EIO: IO error"));

      const session: SessionData = {
        id: "sess-1",
        prdId: "prd-1",
        roleId: "role-1",
        conversation: [],
        lastUsedAt: Date.now(),
      };

      await expect(badStorage.saveSession(session)).rejects.toThrow(StorageError);

      // @ts-ignore
      badStorage.storage.writeJSON = originalWriteJSON;
    });

    it("should throw StorageError when LocalStorageEngine fails to list workspaces", async () => {
      const badStorage = new WorkspaceSessionStorage(tempDir);

      // @ts-ignore
      const originalListFiles = badStorage.storage.listFiles;
      // @ts-ignore
      badStorage.storage.listFiles = vi.fn().mockRejectedValue(new Error("EACCES: permission denied"));

      await expect(badStorage.getWorkspaces()).rejects.toThrow(StorageError);

      // @ts-ignore
      badStorage.storage.listFiles = originalListFiles;
    });

    it("should throw StorageError when LocalStorageEngine fails to list sessions", async () => {
      const badStorage = new WorkspaceSessionStorage(tempDir);

      // @ts-ignore
      const originalListFiles = badStorage.storage.listFiles;
      // @ts-ignore
      badStorage.storage.listFiles = vi.fn().mockRejectedValue(new Error("EACCES: permission denied"));

      await expect(badStorage.getSessionsByPRD("prd-1")).rejects.toThrow(StorageError);

      // @ts-ignore
      badStorage.storage.listFiles = originalListFiles;
    });
  });
});
