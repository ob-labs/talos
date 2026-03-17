/**
 * Mock CommandHistoryManager for client-side use
 *
 * This is a browser-compatible version that doesn't rely on Node.js modules.
 * The real CommandHistoryManager uses LocalStorageEngine which requires fs/path.
 */

export interface CommandHistoryEntry {
  command: string;
  timestamp: number;
  workspaceId?: string;
  featId?: string;
}

export class CommandHistoryManager {
  private history: CommandHistoryEntry[] = [];
  private currentIndex: number = -1;
  private maxSize: number = 1000;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  async add(command: string, context?: { workspaceId?: string; featId?: string }): Promise<void> {
    if (!command.trim()) return;

    if (this.history.length > 0 && this.history[this.history.length - 1].command === command) {
      return;
    }

    this.history.push({
      command: command.trim(),
      timestamp: Date.now(),
      workspaceId: context?.workspaceId,
      featId: context?.featId,
    });

    if (this.history.length > this.maxSize) {
      this.history = this.history.slice(-this.maxSize);
    }

    this.currentIndex = this.history.length;
  }

  getPrevious(currentInput: string): string | null {
    if (this.currentIndex === this.history.length) {
      this.currentIndex = this.history.length;
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex]?.command ?? null;
    }

    return null;
  }

  getNext(): string | null {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex]?.command ?? null;
    }

    return null;
  }

  resetIndex(): void {
    this.currentIndex = this.history.length;
  }

  getAll(): CommandHistoryEntry[] {
    return [...this.history];
  }

  getByContext(workspaceId?: string, featId?: string): CommandHistoryEntry[] {
    return this.history.filter(
      (entry) =>
        (!workspaceId || entry.workspaceId === workspaceId) &&
        (!featId || entry.featId === featId)
    );
  }

  search(pattern: string): CommandHistoryEntry[] {
    const lowerPattern = pattern.toLowerCase();
    return this.history.filter((entry) =>
      entry.command.toLowerCase().includes(lowerPattern)
    );
  }

  async clear(): Promise<void> {
    this.history = [];
    this.currentIndex = -1;
  }

  get size(): number {
    return this.history.length;
  }

  get isEmpty(): boolean {
    return this.history.length === 0;
  }

  getRecent(n: number): CommandHistoryEntry[] {
    return this.history.slice(-n);
  }
}

// Default instance for client-side use
export const commandHistory = new CommandHistoryManager();
