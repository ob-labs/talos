import { describe, it, expect, beforeEach, vi } from "vitest";
import { TerminalCommandHandler, type CommandContext } from "./command-handler";
import { LocalStorageEngine } from "@talos/core/storage";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  default: {
    readdir: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
  },
}));

// Mock @talos/core/storage
vi.mock("@talos/core/storage", () => ({
  LocalStorageEngine: vi.fn(),
}));

import fs from "fs/promises";
import { LocalStorageEngine } from "@talos/core/storage";

describe("TerminalCommandHandler", () => {
  let handler: TerminalCommandHandler;
  let mockStorage: any;
  let context: CommandContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock storage
    mockStorage = {};
    vi.mocked(LocalStorageEngine).mockReturnValue(mockStorage as any);

    // Create handler
    handler = new TerminalCommandHandler(mockStorage);

    // Default context
    context = {
      cwd: "/test/workspace",
      workspaceId: "workspace-1",
      featId: "feat-1",
      taskId: "task-1",
    };

    // Mock fs.readdir
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: "file1.txt", isDirectory: () => false },
      { name: "dir1", isDirectory: () => true },
    ] as any);

    // Mock fs.stat
    vi.mocked(fs.stat).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 100,
    } as any);

    // Mock fs.readFile
    vi.mocked(fs.readFile).mockResolvedValue("file content\nline 2\nline 3");
  });

  describe("constructor and default commands", () => {
    it("should register default commands", () => {
      const commands = handler.getCommands();

      expect(commands.length).toBeGreaterThan(0);

      const commandNames = commands.map((c) => c.name);
      expect(commandNames).toContain("help");
      expect(commandNames).toContain("clear");
      expect(commandNames).toContain("echo");
      expect(commandNames).toContain("pwd");
      expect(commandNames).toContain("ls");
      expect(commandNames).toContain("cd");
      expect(commandNames).toContain("cat");
      expect(commandNames).toContain("grep");
      expect(commandNames).toContain("status");
    });

    it("should accept custom storage instance", () => {
      const customStorage = {} as any;
      const handlerWithStorage = new TerminalCommandHandler(customStorage);

      expect(handlerWithStorage).toBeDefined();
    });

    it("should use LocalStorageEngine if no storage provided", () => {
      // Reset mock count
      vi.mocked(LocalStorageEngine).mockClear();

      const handlerWithoutStorage = new TerminalCommandHandler();

      expect(LocalStorageEngine).toHaveBeenCalled();
    });
  });

  describe("registerCommand", () => {
    it("should register custom command", () => {
      const customCommand = {
        name: "custom",
        description: "Custom command",
        usage: "custom",
        handler: async () => ({ success: true, output: "custom output" }),
      };

      handler.registerCommand(customCommand);

      const retrieved = handler.getCommand("custom");
      expect(retrieved).toEqual(customCommand);
    });

    it("should add command to commands list", () => {
      const initialCount = handler.getCommands().length;

      handler.registerCommand({
        name: "newcmd",
        description: "New command",
        usage: "newcmd",
        handler: async () => ({ success: true, output: "" }),
      });

      expect(handler.getCommands().length).toBe(initialCount + 1);
    });
  });

  describe("execute", () => {
    it("should return empty result for empty input", async () => {
      const result = await handler.execute("", context);

      expect(result).toEqual({ success: true, output: "" });
    });

    it("should return empty result for whitespace-only input", async () => {
      const result = await handler.execute("   ", context);

      expect(result).toEqual({ success: true, output: "" });
    });

    it("should trim whitespace from input", async () => {
      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      const result = await handler.execute("  ls  ", context);

      expect(result.success).toBe(true);
    });

    it("should return error for unknown command", async () => {
      const result = await handler.execute("unknowncmd", context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Command not found: unknowncmd");
      expect(result.error).toContain("Type 'help' for available commands");
    });

    it("should handle command execution errors gracefully", async () => {
      handler.registerCommand({
        name: "errorcmd",
        description: "Error command",
        usage: "errorcmd",
        handler: async () => {
          throw new Error("Command failed");
        },
      });

      const result = await handler.execute("errorcmd", context);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Command failed");
    });

    it("should handle non-Error errors gracefully", async () => {
      handler.registerCommand({
        name: "stringerror",
        description: "String error command",
        usage: "stringerror",
        handler: async () => {
          throw "String error";
        },
      });

      const result = await handler.execute("stringerror", context);

      expect(result.success).toBe(false);
      expect(result.error).toBe("String error");
    });
  });

  describe("special commands (/pause, /resume, /skip, /retry, /status)", () => {
    it("should handle /pause command", async () => {
      const result = await handler.execute("/pause", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("Execution paused.");
    });

    it("should handle /resume command", async () => {
      const result = await handler.execute("/resume", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("Execution resumed.");
    });

    it("should handle /skip command with taskId", async () => {
      const result = await handler.execute("/skip", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("Task task-1 skipped.");
    });

    it("should handle /skip command without taskId", async () => {
      const result = await handler.execute("/skip", { cwd: "/test" });

      expect(result.success).toBe(true);
      expect(result.output).toBe("Task unknown skipped.");
    });

    it("should handle /retry command with taskId", async () => {
      const result = await handler.execute("/retry", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("Retrying task task-1...");
    });

    it("should handle /retry command without taskId", async () => {
      const result = await handler.execute("/retry", { cwd: "/test" });

      expect(result.success).toBe(true);
      expect(result.output).toBe("Retrying task unknown...");
    });

    it("should handle /status command", async () => {
      const result = await handler.execute("/status", context);

      expect(result.success).toBe(true);
      expect(result.output).toContain("Workspace: workspace-1");
      expect(result.output).toContain("Feat: feat-1");
      expect(result.output).toContain("Task: task-1");
      expect(result.output).toContain("CWD: /test/workspace");
    });

    it("should return error for unknown special command", async () => {
      const result = await handler.execute("/unknown", context);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown special command: /unknown");
    });

    it("should be case-insensitive for special commands", async () => {
      const result = await handler.execute("/PAUSE", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("Execution paused.");
    });
  });

  describe("help command", () => {
    it("should show all commands when called without args", async () => {
      const result = await handler.execute("help", context);

      expect(result.success).toBe(true);
      expect(result.output).toContain("Available commands:");
      expect(result.output).toContain("help");
      expect(result.output).toContain("clear");
      expect(result.output).toContain("echo");
    });

    it("should show special commands section", async () => {
      const result = await handler.execute("help", context);

      expect(result.output).toContain("Special commands:");
      expect(result.output).toContain("/pause");
      expect(result.output).toContain("/resume");
      expect(result.output).toContain("/skip");
      expect(result.output).toContain("/retry");
      expect(result.output).toContain("/status");
    });

    it("should show single command detail when called with arg", async () => {
      const result = await handler.execute("help pwd", context);

      expect(result.success).toBe(true);
      expect(result.output).toContain("pwd:");
      expect(result.output).toContain("Usage: pwd");
    });

    it("should return error for unknown command in help", async () => {
      const result = await handler.execute("help unknowncmd", context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Command not found: unknowncmd");
    });

    it("should be case-insensitive for command name", async () => {
      const result = await handler.execute("help PWD", context);

      expect(result.success).toBe(true);
      expect(result.output).toContain("pwd:");
    });
  });

  describe("clear command", () => {
    it("should return __CLEAR__ marker", async () => {
      const result = await handler.execute("clear", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("__CLEAR__");
    });
  });

  describe("echo command", () => {
    it("should echo single word", async () => {
      const result = await handler.execute("echo hello", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("hello");
    });

    it("should echo multiple words", async () => {
      const result = await handler.execute("echo hello world test", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("hello world test");
    });

    it("should echo empty string when no args", async () => {
      const result = await handler.execute("echo", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("");
    });
  });

  describe("pwd command", () => {
    it("should return current working directory", async () => {
      const result = await handler.execute("pwd", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("/test/workspace");
    });
  });

  describe("ls command", () => {
    it("should list directory contents", async () => {
      const result = await handler.execute("ls", context);

      expect(result.success).toBe(true);
      expect(result.output).toContain("- file1.txt");
      expect(result.output).toContain("d dir1");
    });

    it("should list specific directory", async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: "other.txt", isDirectory: () => false },
      ] as any);

      const result = await handler.execute("ls /other/path", context);

      expect(result.success).toBe(true);
      expect(result.output).toContain("- other.txt");
      expect(fs.readdir).toHaveBeenCalledWith("/other/path", { withFileTypes: true });
    });

    it("should resolve relative path from cwd", async () => {
      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      await handler.execute("ls subdir", context);

      expect(fs.readdir).toHaveBeenCalledWith("/test/workspace/subdir", { withFileTypes: true });
    });

    it("should show (empty directory) for empty directory", async () => {
      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      const result = await handler.execute("ls", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("(empty directory)");
    });

    it("should handle directory access errors", async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error("Permission denied"));

      const result = await handler.execute("ls /protected", context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot access '/protected'");
      expect(result.error).toContain("Permission denied");
    });

    it("should use d prefix for directories", async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: "mydir", isDirectory: () => true },
      ] as any);

      const result = await handler.execute("ls", context);

      expect(result.output).toContain("d mydir");
    });

    it("should use - prefix for files", async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: "myfile.txt", isDirectory: () => false },
      ] as any);

      const result = await handler.execute("ls", context);

      expect(result.output).toContain("- myfile.txt");
    });
  });

  describe("cd command", () => {
    it("should return error when no args provided", async () => {
      const result = await handler.execute("cd", context);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Usage: cd <path>");
    });

    it("should resolve path from cwd", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      const result = await handler.execute("cd subdir", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("/test/workspace/subdir");
      expect(fs.stat).toHaveBeenCalledWith("/test/workspace/subdir");
    });

    it("should validate target is directory", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);

      const result = await handler.execute("cd file.txt", context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Not a directory: /test/workspace/file.txt");
    });

    it("should handle access errors", async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error("No such file or directory"));

      const result = await handler.execute("cd nonexistent", context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot access '/test/workspace/nonexistent'");
      expect(result.error).toContain("No such file or directory");
    });
  });

  describe("cat command", () => {
    it("should return error when no args provided", async () => {
      const result = await handler.execute("cat", context);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Usage: cat <file>");
    });

    it("should read and return file contents", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("line 1\nline 2\nline 3");

      const result = await handler.execute("cat file.txt", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("line 1\nline 2\nline 3");
      expect(fs.readFile).toHaveBeenCalledWith("/test/workspace/file.txt", "utf-8");
    });

    it("should resolve file path from cwd", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("");

      await handler.execute("cat subdir/file.txt", context);

      expect(fs.readFile).toHaveBeenCalledWith("/test/workspace/subdir/file.txt", "utf-8");
    });

    it("should handle file read errors", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));

      const result = await handler.execute("cat nonexistent.txt", context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot read '/test/workspace/nonexistent.txt'");
      expect(result.error).toContain("File not found");
    });
  });

  describe("grep command", () => {
    it("should return error when no args provided", async () => {
      const result = await handler.execute("grep", context);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Usage: grep <pattern> [file]");
    });

    it("should search file and return matches", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("hello world\nhello again\ngoodbye world");
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as any);

      const result = await handler.execute("grep hello", context);

      expect(result.success).toBe(true);
      expect(result.output).toContain("1:hello world");
      expect(result.output).toContain("2:hello again");
      expect(result.output).not.toContain("goodbye");
    });

    it("should search specific file when provided", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("pattern match\nno match\nanother pattern");
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as any);

      const result = await handler.execute("grep pattern file.txt", context);

      expect(result.success).toBe(true);
      expect(result.output).toContain("1:pattern match");
      expect(result.output).toContain("3:another pattern");
      expect(fs.readFile).toHaveBeenCalledWith("/test/workspace/file.txt", "utf-8");
    });

    it("should be case-insensitive by default", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("HELLO\nhello\nHeLLo");
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as any);

      const result = await handler.execute("grep hello", context);

      expect(result.success).toBe(true);
      expect(result.output).toContain("1:HELLO");
      expect(result.output).toContain("2:hello");
      expect(result.output).toContain("3:HeLLo");
    });

    it("should return no matches message when pattern not found", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("no matches here");
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as any);

      const result = await handler.execute("grep pattern", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("No matches found for 'pattern'");
    });

    it("should search directory when target is directory", async () => {
      // First stat call checks if target is directory
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({
          isFile: () => false,
          isDirectory: () => true,
        } as any)
        // Then stat calls for each file
        .mockResolvedValue({
          isFile: () => true,
          size: 100,
        } as any);

      vi.mocked(fs.readdir).mockResolvedValue(["file1.txt", "file2.txt"] as any);

      // file1.txt has pattern, file2.txt doesn't
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce("pattern in file1\nother line")
        .mockResolvedValueOnce("no matches here at all");

      const result = await handler.execute("grep pattern", context);

      expect(result.success).toBe(true);
      expect(result.output).toContain("file1.txt:1:pattern in file1");
      // file2.txt should NOT appear since it has no matches
      expect(result.output).not.toContain("file2.txt");
    });

    it("should limit directory search to 10 files", async () => {
      // First stat checks if target is directory
      vi.mocked(fs.stat).mockResolvedValueOnce({
        isFile: () => false,
        isDirectory: () => true,
      } as any);

      const files = Array.from({ length: 15 }, (_, i) => `file${i}.txt`);
      vi.mocked(fs.readdir).mockResolvedValue(files as any);

      // Mock stat for each file
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        size: 100,
      } as any);

      for (let i = 0; i < 15; i++) {
        vi.mocked(fs.readFile).mockResolvedValue(`content ${i}`);
      }

      const result = await handler.execute("grep pattern", context);

      // Should only process first 10 files
      expect(fs.readFile).toHaveBeenCalledTimes(10);
    });

    it("should skip files larger than 1MB", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      vi.mocked(fs.readdir).mockResolvedValue(["largefile.txt"] as any);

      vi.mocked(fs.stat)
        .mockResolvedValueOnce({
          isDirectory: () => true,
        } as any)
        .mockResolvedValueOnce({
          isFile: () => true,
          size: 2 * 1024 * 1024, // 2MB
        } as any);

      const result = await handler.execute("grep pattern", context);

      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it("should skip files that cannot be read", async () => {
      // This test verifies that the grep command handles file read errors gracefully
      // The implementation wraps readFile in try/catch to skip unreadable files
      // We verify this behavior by checking that read errors don't crash the command

      // Set up mocks for directory search with one readable file
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({
          isFile: () => false,
          isDirectory: () => true,
        } as any)
        // Subsequent stat calls for files
        .mockResolvedValue({
          isFile: () => true,
          size: 100,
        } as any);

      vi.mocked(fs.readdir).mockResolvedValue(["readable.txt", "unreadable.txt"] as any);

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce("pattern here")
        .mockRejectedValueOnce(new Error("Cannot read"));

      const result = await handler.execute("grep pattern /test/dir", context);

      // Command should succeed despite one file being unreadable
      expect(result.success).toBe(true);
    });

    it("should handle search errors", async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error("Search failed"));

      const result = await handler.execute("grep pattern /some/path", context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Error searching '/some/path'");
    });
  });

  describe("status command", () => {
    it("should show current status with all fields", async () => {
      const result = await handler.execute("status", context);

      expect(result.success).toBe(true);
      expect(result.output).toContain("Current Status:");
      expect(result.output).toContain("Workspace: workspace-1");
      expect(result.output).toContain("Feat:      feat-1");
      expect(result.output).toContain("Task:      task-1");
      expect(result.output).toContain("CWD:       /test/workspace");
    });

    it("should show 'none' for missing fields", async () => {
      const result = await handler.execute("status", { cwd: "/test" });

      expect(result.success).toBe(true);
      expect(result.output).toContain("Workspace: none");
      expect(result.output).toContain("Feat:      none");
      expect(result.output).toContain("Task:      none");
    });
  });

  describe("getCommand", () => {
    it("should return registered command", () => {
      const command = handler.getCommand("help");

      expect(command).toBeDefined();
      expect(command?.name).toBe("help");
    });

    it("should return undefined for unknown command", () => {
      const command = handler.getCommand("unknown");

      expect(command).toBeUndefined();
    });
  });

  describe("getCommands", () => {
    it("should return all registered commands", () => {
      const commands = handler.getCommands();

      expect(commands.length).toBeGreaterThan(0);
      expect(commands.every((cmd) => cmd.name)).toBe(true);
    });
  });
});
