import fs from "fs/promises";
import path from "path";
import type { StorageService } from "@talos/types";
import { LocalStorageEngine } from "@talos/core/storage";

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface CommandContext {
  cwd: string;
  workspaceId?: string;
  featId?: string;
  taskId?: string;
}

export type CommandHandler = (args: string[], context: CommandContext) => Promise<CommandResult>;

export interface Command {
  name: string;
  description: string;
  usage: string;
  handler: CommandHandler;
}

export class TerminalCommandHandler {
  private commands: Map<string, Command> = new Map();
  private storage: StorageService;

  constructor(storage?: StorageService) {
    this.storage = storage || (new LocalStorageEngine() as unknown as StorageService);
    this.registerDefaultCommands();
  }

  /**
   * Register a command
   */
  registerCommand(command: Command): void {
    this.commands.set(command.name, command);
  }

  /**
   * Execute a command
   */
  async execute(input: string, context: CommandContext): Promise<CommandResult> {
    const trimmed = input.trim();
    if (!trimmed) {
      return { success: true, output: "" };
    }

    const parts = trimmed.split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Handle special terminal commands
    if (commandName.startsWith("/")) {
      return this.executeSpecialCommand(commandName, args, context);
    }

    const command = this.commands.get(commandName);
    if (!command) {
      return {
        success: false,
        output: ``,
        error: `Command not found: ${commandName}. Type 'help' for available commands.`,
      };
    }

    try {
      return await command.handler(args, context);
    } catch (error) {
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute special commands (starting with /)
   */
  private async executeSpecialCommand(
    command: string,
    _args: string[],
    context: CommandContext
  ): Promise<CommandResult> {
    switch (command) {
      case "/pause":
        return { success: true, output: "Execution paused." };
      case "/resume":
        return { success: true, output: "Execution resumed." };
      case "/skip":
        return { success: true, output: `Task ${context.taskId || "unknown"} skipped.` };
      case "/retry":
        return { success: true, output: `Retrying task ${context.taskId || "unknown"}...` };
      case "/status":
        return {
          success: true,
          output: `Workspace: ${context.workspaceId || "none"}\nFeat: ${context.featId || "none"}\nTask: ${context.taskId || "none"}\nCWD: ${context.cwd}`,
        };
      default:
        return { success: false, output: "", error: `Unknown special command: ${command}` };
    }
  }

  /**
   * Get list of available commands
   */
  getCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get command by name
   */
  getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }

  /**
   * Register default commands
   */
  private registerDefaultCommands(): void {
    // Help command
    this.registerCommand({
      name: "help",
      description: "Show available commands",
      usage: "help [command]",
      handler: async (args) => {
        if (args.length > 0) {
          const cmd = this.commands.get(args[0].toLowerCase());
          if (cmd) {
            return {
              success: true,
              output: `${cmd.name}: ${cmd.description}\nUsage: ${cmd.usage}`,
            };
          }
          return { success: false, output: "", error: `Command not found: ${args[0]}` };
        }

        const commands = this.getCommands();
        const output = [
          "Available commands:",
          "",
          ...commands.map((cmd) => `  ${cmd.name.padEnd(10)} - ${cmd.description}`),
          "",
          "Special commands:",
          "  /pause    - Pause execution",
          "  /resume   - Resume execution",
          "  /skip     - Skip current task",
          "  /retry    - Retry current task",
          "  /status   - Show current status",
          "",
          "Type 'help <command>' for more information.",
        ].join("\n");

        return { success: true, output };
      },
    });

    // Clear command
    this.registerCommand({
      name: "clear",
      description: "Clear the terminal screen",
      usage: "clear",
      handler: async () => {
        return { success: true, output: "__CLEAR__" };
      },
    });

    // Echo command
    this.registerCommand({
      name: "echo",
      description: "Print text to terminal",
      usage: "echo <text>",
      handler: async (args) => {
        return { success: true, output: args.join(" ") };
      },
    });

    // Pwd command
    this.registerCommand({
      name: "pwd",
      description: "Print working directory",
      usage: "pwd",
      handler: async (_args, context) => {
        return { success: true, output: context.cwd };
      },
    });

    // Ls command
    this.registerCommand({
      name: "ls",
      description: "List directory contents",
      usage: "ls [path]",
      handler: async (args, context) => {
        const targetPath = args[0] ? path.resolve(context.cwd, args[0]) : context.cwd;

        try {
          const entries = await fs.readdir(targetPath, { withFileTypes: true });
          const output = entries
            .map((entry) => {
              const prefix = entry.isDirectory() ? "d" : "-";
              const name = entry.name;
              return `${prefix} ${name}`;
            })
            .join("\n");

          return { success: true, output: output || "(empty directory)" };
        } catch (error) {
          return {
            success: false,
            output: "",
            error: `Cannot access '${targetPath}': ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });

    // Cd command
    this.registerCommand({
      name: "cd",
      description: "Change directory",
      usage: "cd <path>",
      handler: async (args, context) => {
        if (args.length === 0) {
          return { success: false, output: "", error: "Usage: cd <path>" };
        }

        const targetPath = path.resolve(context.cwd, args[0]);

        try {
          const stats = await fs.stat(targetPath);
          if (!stats.isDirectory()) {
            return { success: false, output: "", error: `Not a directory: ${targetPath}` };
          }
          return { success: true, output: targetPath };
        } catch (error) {
          return {
            success: false,
            output: "",
            error: `Cannot access '${targetPath}': ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });

    // Cat command
    this.registerCommand({
      name: "cat",
      description: "Display file contents",
      usage: "cat <file>",
      handler: async (args, context) => {
        if (args.length === 0) {
          return { success: false, output: "", error: "Usage: cat <file>" };
        }

        const filePath = path.resolve(context.cwd, args[0]);

        try {
          const content = await fs.readFile(filePath, "utf-8");
          return { success: true, output: content };
        } catch (error) {
          return {
            success: false,
            output: "",
            error: `Cannot read '${filePath}': ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });

    // Grep command
    this.registerCommand({
      name: "grep",
      description: "Search for patterns in files",
      usage: "grep <pattern> [file]",
      handler: async (args, context) => {
        if (args.length === 0) {
          return { success: false, output: "", error: "Usage: grep <pattern> [file]" };
        }

        const pattern = args[0];
        const targetPath = args[1] ? path.resolve(context.cwd, args[1]) : context.cwd;
        const regex = new RegExp(pattern, "i");

        try {
          const stats = await fs.stat(targetPath);

          if (stats.isFile()) {
            const content = await fs.readFile(targetPath, "utf-8");
            const lines = content.split("\n");
            const matches = lines
              .map((line, index) => ({ line, index: index + 1 }))
              .filter(({ line }) => regex.test(line))
              .map(({ line, index }) => `${index}:${line.trim()}`)
              .join("\n");

            return {
              success: true,
              output: matches || `No matches found for '${pattern}'`,
            };
          } else {
            // Search in directory
            const entries = await fs.readdir(targetPath);
            const results: string[] = [];

            for (const entry of entries.slice(0, 10)) {
              // Limit to 10 files
              const entryPath = path.join(targetPath, entry);
              try {
                const entryStats = await fs.stat(entryPath);
                if (entryStats.isFile() && entryStats.size < 1024 * 1024) {
                  // Skip files > 1MB
                  const content = await fs.readFile(entryPath, "utf-8");
                  const lines = content.split("\n");
                  const fileMatches = lines
                    .map((line, index) => ({ line, index: index + 1 }))
                    .filter(({ line }) => regex.test(line))
                    .map(({ line, index }) => `${entry}:${index}:${line.trim()}`);

                  results.push(...fileMatches);
                }
              } catch {
                // Skip files that can't be read
              }
            }

            return {
              success: true,
              output: results.join("\n") || `No matches found for '${pattern}'`,
            };
          }
        } catch (error) {
          return {
            success: false,
            output: "",
            error: `Error searching '${targetPath}': ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });

    // Status command
    this.registerCommand({
      name: "status",
      description: "Show current workspace/feat/task status",
      usage: "status",
      handler: async (_args, context) => {
        const output = [
          "Current Status:",
          `  Workspace: ${context.workspaceId || "none"}`,
          `  Feat:      ${context.featId || "none"}`,
          `  Task:      ${context.taskId || "none"}`,
          `  CWD:       ${context.cwd}`,
        ].join("\n");

        return { success: true, output };
      },
    });
  }
}

// Default instance
export const commandHandler = new TerminalCommandHandler();
