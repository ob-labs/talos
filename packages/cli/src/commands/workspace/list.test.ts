/**
 * Tests for talos workspace list command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { listWorkspaceCommand } from "./list.js";
import { WorkspaceRepository } from "@talos/core";
import * as fsPromises from "fs/promises";

// Mock @talos/core
vi.mock("@talos/core", () => ({
  WorkspaceRepository: vi.fn(),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  access: vi.fn(),
}));

describe("workspace list command", () => {
  const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
  const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit called");
  });

  const mockFindAll = vi.fn();
  const MockWorkspaceRepository = vi.mocked(WorkspaceRepository);

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock for fs.access to resolve (path exists)
    vi.mocked(fsPromises.access).mockReset();
    vi.mocked(fsPromises.access).mockResolvedValue(undefined);

    // Set up default mock for WorkspaceRepository.findAll
    MockWorkspaceRepository.mockImplementation(() => ({
      findAll: mockFindAll,
    } as unknown as WorkspaceRepository));
    mockFindAll.mockReset();
  });

  afterEach(() => {
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  describe("no workspaces", () => {
    it("should show message when no workspaces configured", async () => {
      mockFindAll.mockResolvedValue([]);

      await listWorkspaceCommand({ json: false });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'No workspaces configured. Run "talos workspace add <path>" to add one.'
      );
    });

    it("should show empty JSON array when no workspaces configured (JSON mode)", async () => {
      mockFindAll.mockResolvedValue([]);

      await listWorkspaceCommand({ json: true });

      expect(mockConsoleLog).toHaveBeenCalledWith("[]");
    });
  });

  describe("list workspaces (table format)", () => {
    it("should list all workspaces in table format", async () => {
      const mockWorkspaces = [
        { name: "workspace1", path: "/path/to/workspace1" },
        { name: "workspace2", path: "/path/to/workspace2" },
      ];
      mockFindAll.mockResolvedValue(mockWorkspaces);

      await listWorkspaceCommand({ json: false });

      // Verify the workspaces were fetched
      expect(mockFindAll).toHaveBeenCalled();

      // Check that console.log was called with table output
      expect(mockConsoleLog).toHaveBeenCalled();
      const allCalls = mockConsoleLog.mock.calls.flat();
      const output = allCalls.join("\n");

      // Verify workspace names appear in output
      expect(output).toContain("workspace1");
      expect(output).toContain("workspace2");

      // Verify total count
      expect(output).toContain("Total: 2 workspaces");
    });

    it("should show singular count when only one workspace", async () => {
      const mockWorkspaces = [
        { name: "workspace1", path: "/path/to/workspace1" },
      ];
      mockFindAll.mockResolvedValue(mockWorkspaces);

      await listWorkspaceCommand({ json: false });

      const allCalls = mockConsoleLog.mock.calls.flat();
      const output = allCalls.join("\n");

      expect(output).toContain("Total: 1 workspace");
    });

    it("should show NOT FOUND for non-existent workspace paths", async () => {
      const mockWorkspaces = [
        { name: "workspace1", path: "/path/to/workspace1" },
        { name: "workspace2", path: "/nonexistent/path" },
      ];
      mockFindAll.mockResolvedValue(mockWorkspaces);

      // Mock access to reject for the second workspace
      vi.mocked(fsPromises.access).mockImplementation((filePath: string) => {
        if (filePath === "/nonexistent/path") {
          return Promise.reject(new Error("Path not found"));
        }
        return Promise.resolve(undefined);
      });

      await listWorkspaceCommand({ json: false });

      const allCalls = mockConsoleLog.mock.calls.flat();
      const output = allCalls.join("\n");

      // Verify NOT FOUND appears for the non-existent path
      expect(output).toContain("NOT FOUND");
      expect(output).toContain("workspace2");
    });
  });

  describe("list workspaces (JSON format)", () => {
    it("should list all workspaces in JSON format", async () => {
      const mockWorkspaces = [
        { name: "workspace1", path: "/path/to/workspace1" },
        { name: "workspace2", path: "/path/to/workspace2" },
      ];
      mockFindAll.mockResolvedValue(mockWorkspaces);

      // Explicitly reset and set mock to resolve all paths
      vi.mocked(fsPromises.access).mockReset();
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);

      await listWorkspaceCommand({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const jsonString = mockConsoleLog.mock.calls[0][0];

      // Verify it's valid JSON
      const parsed = JSON.parse(jsonString);
      expect(parsed).toEqual([
        { name: "workspace1", path: "/path/to/workspace1" },
        { name: "workspace2", path: "/path/to/workspace2" },
      ]);
    });

    it("should show NOT FOUND in JSON for non-existent workspace paths", async () => {
      const mockWorkspaces = [
        { name: "workspace1", path: "/path/to/workspace1" },
        { name: "workspace2", path: "/nonexistent/path" },
      ];
      mockFindAll.mockResolvedValue(mockWorkspaces);

      // Mock access to reject for the second workspace, resolve for first
      vi.mocked(fsPromises.access).mockImplementation((filePath: string) => {
        if (filePath === "/nonexistent/path") {
          return Promise.reject(new Error("Path not found"));
        }
        return Promise.resolve(undefined);
      });

      await listWorkspaceCommand({ json: true });

      const jsonString = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(jsonString);

      expect(parsed).toEqual([
        { name: "workspace1", path: "/path/to/workspace1" },
        { name: "workspace2", path: "NOT FOUND" },
      ]);
    });
  });

  describe("error handling", () => {
    it("should handle findAll errors", async () => {
      mockFindAll.mockRejectedValue(new Error("Database error"));

      await expect(listWorkspaceCommand({ json: false })).rejects.toThrow("process.exit called");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error listing workspaces:",
        "Database error"
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should handle fs.access errors gracefully (should not throw, should mark as NOT FOUND)", async () => {
      const mockWorkspaces = [
        { name: "workspace1", path: "/path/to/workspace1" },
      ];
      mockFindAll.mockResolvedValue(mockWorkspaces);

      vi.mocked(fsPromises.access).mockRejectedValue(new Error("Access error"));

      // Should not throw, should show NOT FOUND instead
      await listWorkspaceCommand({ json: false });

      expect(mockProcessExit).not.toHaveBeenCalled();
      const allCalls = mockConsoleLog.mock.calls.flat();
      const output = allCalls.join("\n");
      expect(output).toContain("NOT FOUND");
    });
  });
});
