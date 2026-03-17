import type { StorageService } from "@talos/types";
import { LocalStorageEngine } from "@talos/core/storage";

export interface CommandHistoryEntry {
  command: string;
  timestamp: number;
  workspaceId?: string;
  featId?: string;
}

export interface CommandHistoryData {
  commands: CommandHistoryEntry[];
  maxSize: number;
}

export class CommandHistoryManager {
  private storage: StorageService;
  private history: CommandHistoryEntry[] = [];
  private currentIndex: number = -1;
  private tempInput: string = "";
  private maxSize: number;
  private readonly storageKey = "terminal/command-history.json";

  constructor(maxSize: number = 1000, storage?: StorageService) {
    this.maxSize = maxSize;
    this.storage = storage || (new LocalStorageEngine() as unknown as StorageService);
    this.loadHistory();
  }

  /**
   * Load command history from storage
   */
  private async loadHistory(): Promise<void> {
    try {
      const data = await this.storage.readJSON<CommandHistoryData>(this.storageKey);
      if (data && Array.isArray(data.commands)) {
        this.history = data.commands.slice(-this.maxSize);
      }
    } catch {
      // If file doesn't exist or is corrupted, start with empty history
      this.history = [];
    }
  }

  /**
   * Save command history to storage
   */
  private async saveHistory(): Promise<void> {
    const data: CommandHistoryData = {
      commands: this.history.slice(-this.maxSize),
      maxSize: this.maxSize,
    };
    await this.storage.writeJSON(this.storageKey, data);
  }

  /**
   * Add a command to history
   */
  async add(command: string, context?: { workspaceId?: string; featId?: string }): Promise<void> {
    if (!command.trim()) return;

    // Don't add duplicate of the last command
    if (this.history.length > 0 && this.history[this.history.length - 1].command === command) {
      return;
    }

    this.history.push({
      command: command.trim(),
      timestamp: Date.now(),
      workspaceId: context?.workspaceId,
      featId: context?.featId,
    });

    // Trim to max size
    if (this.history.length > this.maxSize) {
      this.history = this.history.slice(-this.maxSize);
    }

    this.currentIndex = this.history.length;
    this.tempInput = "";

    await this.saveHistory();
  }

  /**
   * Get previous command (for up arrow)
   */
  getPrevious(currentInput: string): string | null {
    // Save current input if we're just starting to navigate
    if (this.currentIndex === this.history.length) {
      this.tempInput = currentInput;
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex]?.command ?? null;
    }

    return null;
  }

  /**
   * Get next command (for down arrow)
   */
  getNext(): string | null {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex]?.command ?? null;
    }

    // Return to current input if at the end
    if (this.currentIndex === this.history.length - 1) {
      this.currentIndex = this.history.length;
      return this.tempInput;
    }

    return null;
  }

  /**
   * Reset navigation index (call when command is executed)
   */
  resetIndex(): void {
    this.currentIndex = this.history.length;
    this.tempInput = "";
  }

  /**
   * Get all history entries
   */
  getAll(): CommandHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Get history entries filtered by context
   */
  getByContext(workspaceId?: string, featId?: string): CommandHistoryEntry[] {
    return this.history.filter(
      (entry) =>
        (!workspaceId || entry.workspaceId === workspaceId) &&
        (!featId || entry.featId === featId)
    );
  }

  /**
   * Search history for commands matching a pattern
   */
  search(pattern: string): CommandHistoryEntry[] {
    const lowerPattern = pattern.toLowerCase();
    return this.history.filter((entry) =>
      entry.command.toLowerCase().includes(lowerPattern)
    );
  }

  /**
   * Clear all history
   */
  async clear(): Promise<void> {
    this.history = [];
    this.currentIndex = -1;
    this.tempInput = "";
    await this.saveHistory();
  }

  /**
   * Get the number of commands in history
   */
  get size(): number {
    return this.history.length;
  }

  /**
   * Check if history is empty
   */
  get isEmpty(): boolean {
    return this.history.length === 0;
  }

  /**
   * Get the last N commands
   */
  getRecent(n: number): CommandHistoryEntry[] {
    return this.history.slice(-n);
  }
}

// Default instance
export const commandHistory = new CommandHistoryManager();
