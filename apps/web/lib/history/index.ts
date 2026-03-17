import type {
  RalphTask,
  StoryExecutionResult,
} from '@talos/types';
import { readFile, readdir, writeFile, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

/**
 * History record metadata
 */
export interface HistoryMetadata {
  id: string;
  level: "console" | "project";
  timestamp: number;
  prdId: string;
  prdTitle: string;
  role: string;
  roleDescription?: string;
  modelsUsed: string[];
  duration?: number;
  status: "success" | "failure" | "partial";
  startedAt: number;
  completedAt?: number;
}

/**
 * Complete history record with metadata and tasks
 */
export interface HistoryRecord extends HistoryMetadata {
  tasks: RalphTask[];
}

/**
 * Project snapshot
 */
export interface ProjectSnapshot {
  timestamp: number;
  prdId: string;
  prdTitle: string;
  filesModified: string[];
  description: string;
}

/**
 * Custom error for history manager
 */
export class HistoryManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HistoryManagerError";
  }
}

/**
 * Simple storage interface that uses Node.js fs directly
 */
interface IStorage {
  readJSON<T>(filePath: string): Promise<T | null>;
  writeJSON<T>(filePath: string, data: T): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  fileExists(filePath: string): Promise<boolean>;
  listFiles(dirPath: string, extension?: string): Promise<string[]>;
}

/**
 * Storage implementation using Node.js fs module
 */
class DirectFileStorage implements IStorage {
  private baseDir: string;

  constructor() {
    // Use ~/.talos as base directory for history files
    this.baseDir = path.join(os.homedir(), '.talos');
  }

  async readJSON<T>(filePath: string): Promise<T | null> {
    try {
      const fullPath = path.join(this.baseDir, filePath);
      const content = await readFile(fullPath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  async writeJSON<T>(filePath: string, data: T): Promise<void> {
    const fullPath = path.join(this.baseDir, filePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await mkdir(dir, { recursive: true });

    await writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, filePath);
    const { unlink } = await import('fs/promises');
    await unlink(fullPath);
  }

  async fileExists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.baseDir, filePath);
    try {
      await stat(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(dirPath: string, extension?: string): Promise<string[]> {
    const fullPath = path.join(this.baseDir, dirPath);

    if (!existsSync(fullPath)) {
      return [];
    }

    try {
      const files = await readdir(fullPath);

      if (extension) {
        return files.filter(file => file.endsWith(extension));
      }

      return files;
    } catch {
      return [];
    }
  }
}

/**
 * History manager options
 */
export interface HistoryManagerOptions {
  /** Storage service instance (injected for testability) */
  storage?: IStorage;
}

/**
 * HistoryManager - manages execution history storage and retrieval
 *
 * Supports two levels of history:
 * - Console-level: data/history/console/YYYY-MM/exec-*.json
 * - Project-level: data/history/projects/{name}/exec-*.json
 */
export class HistoryManager {
  private readonly storage: IStorage;

  constructor(options: HistoryManagerOptions = {}) {
    this.storage = options.storage ?? new DirectFileStorage();
  }

  /**
   * Save execution history at console level
   * @param metadata - History metadata
   * @param storyResults - Story execution results from ExecutionLoop
   * @returns Promise with history record ID
   */
  async saveConsoleHistory(
    metadata: Omit<HistoryMetadata, "id" | "level">,
    storyResults: StoryExecutionResult[]
  ): Promise<string> {
    const historyId = this.generateHistoryId();

    // Build RalphTask array from StoryExecutionResult
    const tasks: RalphTask[] = this.buildRalphTasks(storyResults);

    const record: HistoryRecord = {
      ...metadata,
      id: historyId,
      level: "console",
      tasks,
    };

    // Save to data/history/console/YYYY-MM/exec-{id}.json
    const date = new Date(metadata.startedAt);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const filePath = `data/history/console/${yearMonth}/exec-${historyId}.json`;

    await this.storage.writeJSON(filePath, record);

    return historyId;
  }

  /**
   * Save execution history at project level
   * @param prdTitle - Project title (used for directory name)
   * @param metadata - History metadata
   * @param storyResults - Story execution results from ExecutionLoop
   * @returns Promise with history record ID
   */
  async saveProjectHistory(
    prdTitle: string,
    metadata: Omit<HistoryMetadata, "id" | "level">,
    storyResults: StoryExecutionResult[]
  ): Promise<string> {
    const historyId = this.generateHistoryId();

    // Build RalphTask array from StoryExecutionResult
    const tasks: RalphTask[] = this.buildRalphTasks(storyResults);

    const record: HistoryRecord = {
      ...metadata,
      id: historyId,
      level: "project",
      tasks,
    };

    // Save to data/history/projects/{slugified-title}/exec-{id}.json
    const projectSlug = this.slugify(prdTitle);
    const filePath = `data/history/projects/${projectSlug}/exec-${historyId}.json`;

    await this.storage.writeJSON(filePath, record);

    return historyId;
  }

  /**
   * Load history record by ID
   * Searches both console and project levels
   * @param historyId - History record ID
   * @returns Promise with history record or null
   */
  async loadHistory(historyId: string): Promise<HistoryRecord | null> {
    // Try console level first
    const consoleRecord = await this.loadConsoleHistory(historyId);
    if (consoleRecord) {
      return consoleRecord;
    }

    // Try project level
    const projectRecord = await this.loadProjectHistory(historyId);
    if (projectRecord) {
      return projectRecord;
    }

    return null;
  }

  /**
   * Load console history by ID
   * @param historyId - History record ID
   * @returns Promise with history record or null
   */
  async loadConsoleHistory(historyId: string): Promise<HistoryRecord | null> {
    // Search through all year-month directories
    const currentYear = new Date().getFullYear();

    // Search current year and previous year
    for (let year = currentYear; year >= currentYear - 1; year--) {
      for (let month = 12; month >= 1; month--) {
        const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
        const filePath = `data/history/console/${yearMonth}/exec-${historyId}.json`;
        const record = await this.storage.readJSON<HistoryRecord>(filePath);
        if (record) {
          return record;
        }
      }
    }

    return null;
  }

  /**
   * Load project history by ID
   * @param historyId - History record ID
   * @returns Promise with history record or null
   */
  async loadProjectHistory(historyId: string): Promise<HistoryRecord | null> {
    // Get all project directories
    const projects = await this.listProjects();
    for (const project of projects) {
      const filePath = `data/history/projects/${project}/exec-${historyId}.json`;
      const record = await this.storage.readJSON<HistoryRecord>(filePath);
      if (record && record.id === historyId) {
        return record;
      }
    }
    return null;
  }

  /**
   * List all projects with history
   * @returns Promise with array of project slugs
   */
  async listProjects(): Promise<string[]> {
    try {
      const files = await this.storage.listFiles("data/history/projects");
      return files;
    } catch {
      return [];
    }
  }

  /**
   * Get all history records for a specific project
   * @param prdTitle - Project title
   * @returns Promise with array of history records
   */
  async getProjectHistory(prdTitle: string): Promise<HistoryRecord[]> {
    const projectSlug = this.slugify(prdTitle);
    const dirPath = `data/history/projects/${projectSlug}`;
    const files = await this.storage.listFiles(dirPath, ".json");

    const records: HistoryRecord[] = [];
    for (const file of files) {
      const record = await this.storage.readJSON<HistoryRecord>(
        `${dirPath}/${file}`
      );
      if (record) {
        records.push(record);
      }
    }

    // Sort by timestamp descending
    return records.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get console history for a specific month
   * @param year - Year (e.g., 2026)
   * @param month - Month (1-12)
   * @returns Promise with array of history records
   */
  async getConsoleHistory(
    year: number,
    month: number
  ): Promise<HistoryRecord[]> {
    const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
    const dirPath = `data/history/console/${yearMonth}`;
    const files = await this.storage.listFiles(dirPath, ".json");

    const records: HistoryRecord[] = [];
    for (const file of files) {
      const record = await this.storage.readJSON<HistoryRecord>(
        `${dirPath}/${file}`
      );
      if (record) {
        records.push(record);
      }
    }

    // Sort by timestamp descending
    return records.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Delete history record by ID
   * @param historyId - History record ID
   * @returns Promise with boolean indicating success
   */
  async deleteHistory(historyId: string): Promise<boolean> {
    // Try console level first
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= currentYear - 1; year--) {
      for (let month = 12; month >= 1; month--) {
        const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
        const filePath = `data/history/console/${yearMonth}/exec-${historyId}.json`;
        if (await this.storage.fileExists(filePath)) {
          await this.storage.deleteFile(filePath);
          return true;
        }
      }
    }

    // Try project level
    const projects = await this.listProjects();
    for (const project of projects) {
      const filePath = `data/history/projects/${project}/exec-${historyId}.json`;
      if (await this.storage.fileExists(filePath)) {
        await this.storage.deleteFile(filePath);
        return true;
      }
    }

    return false;
  }

  /**
   * Build RalphTask array from StoryExecutionResult
   * @private
   */
  private buildRalphTasks(
    storyResults: StoryExecutionResult[]
  ): RalphTask[] {
    return storyResults.map((result) => {
      const task: RalphTask = {
        id: result.storyId,
        title: result.storyTitle,
        description: result.error || "",
        status: result.success ? "completed" : "failed",
        conversation: this.buildConversation(result),
        timestamp: Date.now(),
      };
      return task;
    });
  }

  /**
   * Build conversation array from story result
   * @private
   */
  private buildConversation(result: StoryExecutionResult): Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: number;
  }> {
    const conversation: Array<{
      role: "user" | "assistant";
      content: string;
      timestamp: number;
    }> = [];

    // Add user task as first message
    conversation.push({
      role: "user",
      content: `Task: ${result.storyTitle}`,
      timestamp: Date.now() - result.duration,
    });

    // Add assistant response
    if (result.rawOutput) {
      conversation.push({
        role: "assistant",
        content: result.rawOutput,
        timestamp: Date.now(),
      });
    } else if (result.error) {
      conversation.push({
        role: "assistant",
        content: `Error: ${result.error}`,
        timestamp: Date.now(),
      });
    }

    return conversation;
  }

  /**
   * Generate a unique history ID
   * @private
   */
  private generateHistoryId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `hist_${timestamp}_${random}`;
  }

  /**
   * Slugify a string for use in file paths
   * @private
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .trim();
  }
}

// Default instance for convenience
export const historyManager = new HistoryManager();
