/**
 * Workspace Entity Unit Tests
 * 工作区实体单元测试
 */

import { describe, it, expect } from "vitest";
import { Workspace, type WorkspaceDTO } from "./Workspace";
import type { TerminalSession } from "@talos/types";

describe("Workspace Entity", () => {
  describe("Creation", () => {
    it("should create workspace with required properties", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
      });

      expect(workspace.id).toBe("ws-123");
      expect(workspace.name).toBe("talos-project");
      expect(workspace.path).toBe("/Users/dev/projects/talos");
      expect(workspace.branch).toBe("main");
      expect(workspace.worktrees).toEqual([]);
      expect(workspace.terminals).toEqual([]);
      expect(workspace.expanded).toBe(false);
      expect(workspace.createdAt).toBeDefined();
    });

    it("should create workspace with all properties", () => {
      const terminals: TerminalSession[] = [
        { id: "term-1", command: "npm test", exitCode: 0 },
      ];

      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
        worktrees: ["wt-1", "wt-2"],
        terminals,
        expanded: true,
      });

      expect(workspace.worktrees).toEqual(["wt-1", "wt-2"]);
      expect(workspace.terminals).toEqual(terminals);
      expect(workspace.expanded).toBe(true);
    });

    it("should create workspace from DTO", () => {
      const dto: WorkspaceDTO = {
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
        worktrees: ["wt-1"],
        terminals: [],
        expanded: false,
        createdAt: 1234567890,
      };

      const workspace = Workspace.fromDTO(dto);

      expect(workspace.id).toBe(dto.id);
      expect(workspace.name).toBe(dto.name);
      expect(workspace.createdAt).toBe(dto.createdAt);
    });
  });

  describe("Worktree Management", () => {
    it("should add worktree to workspace", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
      });

      workspace.addWorktree("wt-1");

      expect(workspace.hasWorktree("wt-1")).toBe(true);
      expect(workspace.worktrees).toEqual(["wt-1"]);
    });

    it("should not add duplicate worktree", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
        worktrees: ["wt-1"],
      });

      workspace.addWorktree("wt-1");

      expect(workspace.worktrees).toEqual(["wt-1"]);
      expect(workspace.worktrees.length).toBe(1);
    });

    it("should remove worktree from workspace", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
        worktrees: ["wt-1", "wt-2"],
      });

      workspace.removeWorktree("wt-1");

      expect(workspace.hasWorktree("wt-1")).toBe(false);
      expect(workspace.worktrees).toEqual(["wt-2"]);
    });

    it("should check if workspace has worktree", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
        worktrees: ["wt-1"],
      });

      expect(workspace.hasWorktree("wt-1")).toBe(true);
      expect(workspace.hasWorktree("wt-2")).toBe(false);
    });
  });

  describe("Terminal Management", () => {
    it("should add terminal session to history", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
      });

      const terminal: TerminalSession = {
        id: "term-1",
        command: "npm test",
        exitCode: 0,
      };

      workspace.addTerminal(terminal);

      expect(workspace.terminals).toHaveLength(1);
      expect(workspace.terminals[0]).toEqual(terminal);
    });

    it("should get all terminal sessions", () => {
      const terminals: TerminalSession[] = [
        { id: "term-1", command: "npm test", exitCode: 0 },
        { id: "term-2", command: "npm build", exitCode: 0 },
      ];

      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
        terminals,
      });

      const retrievedTerminals = workspace.getTerminals();

      expect(retrievedTerminals).toEqual(terminals);
      expect(retrievedTerminals).not.toBe(terminals); // Should be a copy
    });

    it("should clear terminal session history", () => {
      const terminals: TerminalSession[] = [
        { id: "term-1", command: "npm test", exitCode: 0 },
      ];

      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
        terminals,
      });

      workspace.clearTerminals();

      expect(workspace.terminals).toEqual([]);
    });
  });

  describe("UI State", () => {
    it("should toggle expanded state", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
        expanded: false,
      });

      expect(workspace.expanded).toBe(false);

      workspace.toggleExpanded();
      expect(workspace.expanded).toBe(true);

      workspace.toggleExpanded();
      expect(workspace.expanded).toBe(false);
    });
  });

  describe("Business Methods", () => {
    it("should validate workspace with valid configuration", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
      });

      expect(workspace.isValid()).toBe(true);
    });

    it("should validate workspace with invalid id", () => {
      const workspace = Workspace.create({
        id: "",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
      });

      expect(workspace.isValid()).toBe(false);
    });

    it("should validate workspace with invalid name", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "",
        path: "/Users/dev/projects/talos",
        branch: "main",
      });

      expect(workspace.isValid()).toBe(false);
    });

    it("should get worktree path", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
      });

      const worktreePath = workspace.getWorktreePath("wt-1");

      // Changed to return worktrees/ path instead of .git/worktrees/
      expect(worktreePath).toBe("/Users/dev/projects/talos/worktrees/wt-1");
    });

    it("should get git worktree path", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
      });

      const gitWorktreePath = workspace.getGitWorktreePath("wt-1");

      expect(gitWorktreePath).toBe("/Users/dev/projects/talos/.git/worktrees/wt-1");
    });
  });

  describe("Serialization", () => {
    it("should convert workspace to DTO", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
        worktrees: ["wt-1"],
        terminals: [{ id: "term-1", command: "npm test", exitCode: 0 }],
        expanded: true,
      });

      const dto = workspace.toDTO();

      expect(dto.id).toBe(workspace.id);
      expect(dto.name).toBe(workspace.name);
      expect(dto.path).toBe(workspace.path);
      expect(dto.branch).toBe(workspace.branch);
      expect(dto.worktrees).toEqual(["wt-1"]);
      expect(dto.terminals).toHaveLength(1);
      expect(dto.expanded).toBe(true);
      expect(dto.createdAt).toBeDefined();
    });

    it("should create round-trip DTO conversion", () => {
      const original = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
        worktrees: ["wt-1", "wt-2"],
        terminals: [{ id: "term-1", command: "npm test", exitCode: 0 }],
        expanded: true,
      });

      const dto = original.toDTO();
      const restored = Workspace.fromDTO(dto);

      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.path).toBe(original.path);
      expect(restored.branch).toBe(original.branch);
      expect(restored.worktrees).toEqual(original.worktrees);
      expect(restored.terminals).toEqual(original.terminals);
      expect(restored.expanded).toBe(original.expanded);
      expect(restored.createdAt).toBe(original.createdAt);
    });

    it("should clone arrays in DTO to prevent mutation", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
        worktrees: ["wt-1"],
      });

      const dto = workspace.toDTO();

      // Modify DTO arrays
      dto.worktrees.push("wt-2");
      dto.terminals.push({ id: "term-1", command: "npm test", exitCode: 0 });

      // Original workspace should be unchanged
      expect(workspace.worktrees).toEqual(["wt-1"]);
      expect(workspace.terminals).toEqual([]);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty worktrees array", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
        worktrees: [],
      });

      expect(workspace.hasWorktree("wt-1")).toBe(false);
      expect(workspace.worktrees).toEqual([]);
    });

    it("should handle removing non-existent worktree", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
        worktrees: ["wt-1"],
      });

      workspace.removeWorktree("wt-2");

      expect(workspace.worktrees).toEqual(["wt-1"]);
    });

    it("should handle adding multiple worktrees", () => {
      const workspace = Workspace.create({
        id: "ws-123",
        name: "talos-project",
        path: "/Users/dev/projects/talos",
        branch: "main",
      });

      workspace.addWorktree("wt-1");
      workspace.addWorktree("wt-2");
      workspace.addWorktree("wt-3");

      expect(workspace.worktrees).toEqual(["wt-1", "wt-2", "wt-3"]);
    });
  });
});
