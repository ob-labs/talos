import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandHistoryManager, CommandHistoryEntry, CommandHistoryData } from "./history";
import { LocalStorageEngine } from "@talos/core/storage";

describe("CommandHistoryManager", () => {
  let mockStorage: LocalStorageEngine;
  let manager: CommandHistoryManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock storage instance
    mockStorage = {
      readJSON: vi.fn(),
      writeJSON: vi.fn(),
      readMarkdown: vi.fn(),
      writeMarkdown: vi.fn(),
      deleteFile: vi.fn(),
      fileExists: vi.fn(),
      listFiles: vi.fn(),
      getFileStats: vi.fn(),
    } as unknown as LocalStorageEngine;

    // Mock initial empty history
    vi.mocked(mockStorage.readJSON).mockResolvedValue({
      commands: [],
      maxSize: 1000,
    });
  });

  describe("constructor", () => {
    it("should load history from storage on initialization", async () => {
      const mockHistory: CommandHistoryData = {
        commands: [
          { command: "ls", timestamp: 1000 },
          { command: "pwd", timestamp: 2000 },
        ],
        maxSize: 1000,
      };

      vi.mocked(mockStorage.readJSON).mockResolvedValue(mockHistory);

      manager = new CommandHistoryManager(1000, mockStorage);

      // Wait for async loadHistory to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockStorage.readJSON).toHaveBeenCalledWith("data/terminal/command-history.json");
    });

    it("should use custom maxSize from constructor", async () => {
      manager = new CommandHistoryManager(500, mockStorage);

      // Wait for async loadHistory to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockStorage.readJSON).toHaveBeenCalled();
    });

    it("should use default LocalStorageEngine when not provided", async () => {
      manager = new CommandHistoryManager();

      // Wait for async loadHistory to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(manager).toBeDefined();
    });

    it("should start with empty history when storage file doesn't exist", async () => {
      vi.mocked(mockStorage.readJSON).mockResolvedValue(null);

      manager = new CommandHistoryManager(1000, mockStorage);

      // Wait for async loadHistory to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(manager.size).toBe(0);
    });

    it("should handle corrupted storage data gracefully", async () => {
      vi.mocked(mockStorage.readJSON).mockRejectedValue(new Error("Parse error"));

      manager = new CommandHistoryManager(1000, mockStorage);

      // Wait for async loadHistory to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(manager.size).toBe(0);
    });
  });

  describe("add", () => {
    beforeEach(async () => {
      manager = new CommandHistoryManager(1000, mockStorage);
      // Wait for constructor to load
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it("should add command to history with timestamp", async () => {
      const beforeTime = Date.now();
      await manager.add("ls -la");
      const afterTime = Date.now();

      const all = manager.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].command).toBe("ls -la");
      expect(all[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(all[0].timestamp).toBeLessThanOrEqual(afterTime);
    });

    it("should trim whitespace from commands", async () => {
      await manager.add("  ls -la  ");

      const all = manager.getAll();
      expect(all[0].command).toBe("ls -la");
    });

    it("should not add empty commands", async () => {
      await manager.add("");
      await manager.add("   ");

      expect(manager.isEmpty).toBe(true);
      expect(mockStorage.writeJSON).not.toHaveBeenCalled();
    });

    it("should not add duplicate of last command", async () => {
      await manager.add("ls");
      await manager.add("ls");

      const all = manager.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].command).toBe("ls");
    });

    it("should add same command if different from last", async () => {
      await manager.add("pwd");
      await manager.add("ls");
      await manager.add("pwd");

      const all = manager.getAll();
      expect(all).toHaveLength(3);
      expect(all[0].command).toBe("pwd");
      expect(all[1].command).toBe("ls");
      expect(all[2].command).toBe("pwd");
    });

    it("should limit history to maxSize", async () => {
      manager = new CommandHistoryManager(5, mockStorage);

      for (let i = 0; i < 10; i++) {
        await manager.add(`command-${i}`);
      }

      expect(manager.size).toBe(5);
      const all = manager.getAll();
      expect(all[0].command).toBe("command-5");
      expect(all[4].command).toBe("command-9");
    });

    it("should save to storage after adding command", async () => {
      await manager.add("test command");

      expect(mockStorage.writeJSON).toHaveBeenCalledWith(
        "data/terminal/command-history.json",
        expect.objectContaining({
          commands: expect.any(Array),
          maxSize: 1000,
        })
      );
    });

    it("should store context with command", async () => {
      await manager.add("git status", { workspaceId: "ws-1", featId: "feat-1" });

      const all = manager.getAll();
      expect(all[0].workspaceId).toBe("ws-1");
      expect(all[0].featId).toBe("feat-1");
    });

    it("should reset navigation index after adding command", async () => {
      await manager.add("cmd1");
      await manager.add("cmd2");

      // After adding, currentIndex should be at end
      const prev1 = manager.getPrevious("temp");
      expect(prev1).toBe("cmd2");
    });
  });

  describe("getPrevious", () => {
    beforeEach(async () => {
      manager = new CommandHistoryManager(1000, mockStorage);
      await new Promise(resolve => setTimeout(resolve, 0));

      await manager.add("cmd1");
      await manager.add("cmd2");
      await manager.add("cmd3");
    });

    it("should return previous command", () => {
      const prev = manager.getPrevious("current input");

      expect(prev).toBe("cmd3");
    });

    it("should save current input on first navigation", () => {
      manager.getPrevious("my current input");

      // Navigate to end
      manager.getNext();
      manager.getNext();

      // Should return saved input
      const result = manager.getNext();
      expect(result).toBe("my current input");
    });

    it("should return null at start of history", () => {
      manager.getPrevious("input"); // cmd3
      manager.getPrevious("input"); // cmd2
      manager.getPrevious("input"); // cmd1

      const result = manager.getPrevious("input");
      expect(result).toBeNull();
    });

    it("should navigate through multiple commands", () => {
      const steps = [
        manager.getPrevious("input"),
        manager.getPrevious("input"),
        manager.getPrevious("input"),
      ];

      expect(steps).toEqual(["cmd3", "cmd2", "cmd1"]);
    });

    it("should not save temp input after first call", () => {
      manager.getPrevious("first");

      // Change temp input scenario - should not overwrite
      manager.getPrevious("second");

      // Navigate back to end and get temp
      manager.getNext(); // cmd2
      manager.getNext(); // cmd3
      manager.getNext(); // should return "first", not "second"

      // This should return the temp input
      const temp = manager.getNext();
      expect(temp).toBe("first");
    });
  });

  describe("getNext", () => {
    beforeEach(async () => {
      manager = new CommandHistoryManager(1000, mockStorage);
      await new Promise(resolve => setTimeout(resolve, 0));

      await manager.add("cmd1");
      await manager.add("cmd2");
      await manager.add("cmd3");
    });

    it("should return next command", () => {
      manager.getPrevious("input"); // cmd3
      const result = manager.getNext();

      expect(result).toBe("cmd3");
    });

    it("should return to current input at end", () => {
      const savedInput = "my input";

      manager.getPrevious(savedInput); // cmd3, saves input
      manager.getPrevious(savedInput); // cmd2

      const result = manager.getNext(); // back to cmd3
      expect(result).toBe("cmd3");

      const result2 = manager.getNext(); // back to temp input
      expect(result2).toBe(savedInput);
    });

    it("should return null at end without saved input", () => {
      // currentIndex is already at end
      const result = manager.getNext();

      expect(result).toBeNull();
    });

    it("should return null when navigating past end with saved input", () => {
      manager.getPrevious("input"); // cmd3
      manager.getNext(); // cmd3
      manager.getNext(); // temp input

      const result = manager.getNext();
      expect(result).toBeNull();
    });

    it("should navigate forward through multiple commands", () => {
      manager.getPrevious("input"); // cmd3
      manager.getPrevious("input"); // cmd2
      manager.getPrevious("input"); // cmd1

      const steps = [
        manager.getNext(), // cmd2
        manager.getNext(), // cmd3
      ];

      expect(steps).toEqual(["cmd2", "cmd3"]);
    });
  });

  describe("resetIndex", () => {
    beforeEach(async () => {
      manager = new CommandHistoryManager(1000, mockStorage);
      await new Promise(resolve => setTimeout(resolve, 0));

      await manager.add("cmd1");
      await manager.add("cmd2");
    });

    it("should reset navigation index to end", () => {
      manager.getPrevious("input"); // cmd2
      manager.getPrevious("input"); // cmd1

      manager.resetIndex();

      // After reset, getPrevious should return the last command again
      const prev = manager.getPrevious("new input");
      expect(prev).toBe("cmd2");
    });

    it("should clear temp input", () => {
      manager.getPrevious("saved input");
      manager.resetIndex();

      // Navigate to end and beyond
      manager.getPrevious("new");
      manager.getNext(); // cmd2
      manager.getNext(); // should return empty, not "saved input"

      // When currentIndex === history.length after reset, getNext returns null
      const result = manager.getNext();
      expect(result).toBe("");
    });

    it("should be callable multiple times", () => {
      manager.getPrevious("input");
      manager.resetIndex();
      manager.resetIndex();

      expect(manager.getPrevious("input")).toBe("cmd2");
    });
  });

  describe("getAll", () => {
    beforeEach(async () => {
      manager = new CommandHistoryManager(1000, mockStorage);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it("should return empty array when no commands", () => {
      const all = manager.getAll();

      expect(all).toEqual([]);
      expect(Array.isArray(all)).toBe(true);
    });

    it("should return copy of history", async () => {
      await manager.add("cmd1");
      await manager.add("cmd2");

      const all1 = manager.getAll();
      const all2 = manager.getAll();

      expect(all1).not.toBe(all2); // Different array references
      expect(all1).toEqual(all2);  // Same contents
    });

    it("should return all commands in order", async () => {
      await manager.add("first");
      await manager.add("second");
      await manager.add("third");

      const all = manager.getAll();

      expect(all).toHaveLength(3);
      expect(all[0].command).toBe("first");
      expect(all[1].command).toBe("second");
      expect(all[2].command).toBe("third");
    });

    it("should include timestamps and context", async () => {
      await manager.add("test", { workspaceId: "ws-1", featId: "feat-1" });

      const all = manager.getAll();

      expect(all[0]).toHaveProperty("timestamp");
      expect(all[0].workspaceId).toBe("ws-1");
      expect(all[0].featId).toBe("feat-1");
    });

    it("should not be affected by navigation", async () => {
      await manager.add("cmd1");
      await manager.add("cmd2");

      manager.getPrevious("input");
      manager.getPrevious("input");

      const all = manager.getAll();

      expect(all).toHaveLength(2);
    });
  });

  describe("getByContext", () => {
    beforeEach(async () => {
      manager = new CommandHistoryManager(1000, mockStorage);
      await new Promise(resolve => setTimeout(resolve, 0));

      await manager.add("cmd1", { workspaceId: "ws-1", featId: "feat-1" });
      await manager.add("cmd2", { workspaceId: "ws-1", featId: "feat-2" });
      await manager.add("cmd3", { workspaceId: "ws-2", featId: "feat-1" });
      await manager.add("cmd4"); // no context
    });

    it("should return all commands when no filters", () => {
      const result = manager.getByContext();

      expect(result).toHaveLength(4);
    });

    it("should filter by workspaceId", () => {
      const result = manager.getByContext("ws-1");

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.workspaceId === "ws-1")).toBe(true);
    });

    it("should filter by featId", () => {
      const result = manager.getByContext(undefined, "feat-1");

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.featId === "feat-1")).toBe(true);
    });

    it("should filter by both workspaceId and featId", () => {
      const result = manager.getByContext("ws-1", "feat-1");

      expect(result).toHaveLength(1);
      expect(result[0].command).toBe("cmd1");
    });

    it("should include commands with no context when filtering", () => {
      const result = manager.getByContext();

      expect(result.some((r) => !r.workspaceId)).toBe(true);
    });

    it("should return empty array for non-matching filters", () => {
      const result = manager.getByContext("non-existent");

      expect(result).toEqual([]);
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      manager = new CommandHistoryManager(1000, mockStorage);
      await new Promise(resolve => setTimeout(resolve, 0));

      await manager.add("git status");
      await manager.add("git commit -m 'msg'");
      await manager.add("npm install");
      await manager.add("git log");
    });

    it("should search commands case-insensitive", () => {
      const result = manager.search("GIT");

      expect(result).toHaveLength(3);
    });

    it("should return empty array for no matches", () => {
      const result = manager.search("docker");

      expect(result).toEqual([]);
    });

    it("should search partial matches", () => {
      const result = manager.search("git");

      expect(result).toHaveLength(3);
      expect(result.every((r) => r.command.includes("git"))).toBe(true);
    });

    it("should search with special characters", () => {
      const result = manager.search("-m");

      expect(result).toHaveLength(1);
      expect(result[0].command).toBe("git commit -m 'msg'");
    });

    it("should return results in chronological order", () => {
      const result = manager.search("git");

      expect(result[0].command).toBe("git status");
      expect(result[1].command).toBe("git commit -m 'msg'");
      expect(result[2].command).toBe("git log");
    });
  });

  describe("clear", () => {
    beforeEach(async () => {
      manager = new CommandHistoryManager(1000, mockStorage);
      await new Promise(resolve => setTimeout(resolve, 0));

      await manager.add("cmd1");
      await manager.add("cmd2");
    });

    it("should clear all history", async () => {
      await manager.clear();

      expect(manager.size).toBe(0);
      expect(manager.isEmpty).toBe(true);
    });

    it("should reset navigation index", async () => {
      manager.getPrevious("input");

      await manager.clear();

      // Should not be able to navigate
      const result = manager.getPrevious("input");
      expect(result).toBeNull();
    });

    it("should clear temp input", async () => {
      manager.getPrevious("saved input");
      await manager.clear();

      // Reset index after clear
      manager.resetIndex();

      // Try to get temp - should be empty
      manager.getPrevious("new");
      manager.getNext(); // back to end
      const temp = manager.getNext();

      expect(temp).toBeNull();
    });

    it("should save to storage after clearing", async () => {
      await manager.clear();

      expect(mockStorage.writeJSON).toHaveBeenCalledWith(
        "data/terminal/command-history.json",
        expect.objectContaining({
          commands: [],
          maxSize: 1000,
        })
      );
    });

    it("should be idempotent", async () => {
      await manager.clear();
      await manager.clear();

      expect(manager.size).toBe(0);
    });
  });

  describe("size property", () => {
    beforeEach(async () => {
      manager = new CommandHistoryManager(1000, mockStorage);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it("should return 0 for empty history", () => {
      expect(manager.size).toBe(0);
    });

    it("should return correct count after adding commands", async () => {
      await manager.add("cmd1");
      expect(manager.size).toBe(1);

      await manager.add("cmd2");
      expect(manager.size).toBe(2);

      await manager.add("cmd3");
      expect(manager.size).toBe(3);
    });

    it("should not be affected by navigation", async () => {
      await manager.add("cmd1");
      await manager.add("cmd2");

      manager.getPrevious("input");
      manager.getPrevious("input");

      expect(manager.size).toBe(2);
    });

    it("should update after clearing", async () => {
      await manager.add("cmd1");
      await manager.add("cmd2");

      await manager.clear();

      expect(manager.size).toBe(0);
    });

    it("should reflect maxSize limit", async () => {
      manager = new CommandHistoryManager(5, mockStorage);

      for (let i = 0; i < 10; i++) {
        await manager.add(`cmd${i}`);
      }

      expect(manager.size).toBe(5);
    });
  });

  describe("isEmpty property", () => {
    beforeEach(async () => {
      manager = new CommandHistoryManager(1000, mockStorage);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it("should return true for empty history", () => {
      expect(manager.isEmpty).toBe(true);
    });

    it("should return false after adding command", async () => {
      await manager.add("cmd1");

      expect(manager.isEmpty).toBe(false);
    });

    it("should return true after clearing", async () => {
      await manager.add("cmd1");
      await manager.clear();

      expect(manager.isEmpty).toBe(true);
    });
  });

  describe("getRecent", () => {
    beforeEach(async () => {
      manager = new CommandHistoryManager(1000, mockStorage);
      await new Promise(resolve => setTimeout(resolve, 0));

      for (let i = 1; i <= 10; i++) {
        await manager.add(`cmd${i}`);
      }
    });

    it("should return last N commands", () => {
      const recent = manager.getRecent(3);

      expect(recent).toHaveLength(3);
      expect(recent[0].command).toBe("cmd8");
      expect(recent[1].command).toBe("cmd9");
      expect(recent[2].command).toBe("cmd10");
    });

    it("should return all if N exceeds size", () => {
      const recent = manager.getRecent(20);

      expect(recent).toHaveLength(10);
      expect(recent[0].command).toBe("cmd1");
      expect(recent[9].command).toBe("cmd10");
    });

    it("should return empty array for N=0", () => {
      const recent = manager.getRecent(0);

      expect(recent).toEqual([]);
    });

    it("should return last command for N=1", () => {
      const recent = manager.getRecent(1);

      expect(recent).toHaveLength(1);
      expect(recent[0].command).toBe("cmd10");
    });

    it("should handle negative N", () => {
      const recent = manager.getRecent(-5);

      expect(recent).toEqual([]);
    });

    it("should return from empty history", async () => {
      const emptyManager = new CommandHistoryManager(1000, mockStorage);
      await new Promise(resolve => setTimeout(resolve, 0));

      const recent = emptyManager.getRecent(5);

      expect(recent).toEqual([]);
    });
  });
});
