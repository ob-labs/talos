import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import type { Stats } from "fs";
// TODO: Add back import type { IStorageEngine } from "@talos/types" once package exports are fixed

/**
 * Default directory name for Talos data storage
 */
export const TALOS_DIR = ".talos";

/**
 * Options for reading JSON files
 */
export interface ReadJSONOptions {
  /**
   * Encoding to use when reading the file (default: 'utf-8')
   */
  encoding?: BufferEncoding;

  /**
   * Whether to throw if the file doesn't exist (default: true)
   * When false, returns null for missing files
   */
  throwIfNotFound?: boolean;
}

/**
 * Options for writing JSON files
 */
export interface WriteJSONOptions {
  /**
   * Encoding to use when writing the file (default: 'utf-8')
   */
  encoding?: BufferEncoding;

  /**
   * Whether to create parent directories if they don't exist (default: true)
   */
  createDirectories?: boolean;

  /**
   * Number of spaces to use for indentation (default: 2)
   * Set to 0 for compact output
   */
  indent?: number;
}

/**
 * Options for reading Markdown files
 */
export interface ReadMarkdownOptions {
  /**
   * Encoding to use when reading the file (default: 'utf-8')
   */
  encoding?: BufferEncoding;

  /**
   * Whether to throw if the file doesn't exist (default: true)
   * When false, returns null for missing files
   */
  throwIfNotFound?: boolean;
}

/**
 * Options for writing Markdown files
 */
export interface WriteMarkdownOptions {
  /**
   * Encoding to use when writing the file (default: 'utf-8')
   */
  encoding?: BufferEncoding;

  /**
   * Whether to create parent directories if they don't exist (default: true)
   */
  createDirectories?: boolean;
}

/**
 * Local Storage Engine - File storage with atomic writes
 *
 * Implements IStorageEngine interface contract for safe file operations.
 * Uses atomic writes (write to temp file, then rename) to prevent data corruption.
 *
 * TODO: Add back `implements IStorageEngine` once package exports are fixed
 */
export class LocalStorageEngine {
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  /**
   * Ensures a directory exists, creates it if it doesn't
   */
  private async ensureDir(dirPath: string): Promise<void> {
    const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(this.basePath, dirPath);
    try {
      await fs.access(fullPath);
    } catch {
      await fs.mkdir(fullPath, { recursive: true });
    }
  }

  /**
   * Resolve a file path to absolute path
   */
  private resolvePath(filePath: string): string {
    return path.isAbsolute(filePath) ? filePath : path.join(this.basePath, filePath);
  }

  /**
   * Read and parse a JSON file
   *
   * @param filePath - Path to the JSON file (relative to basePath or absolute)
   * @param options - Read options
   * @returns Parsed JSON object, or null if file doesn't exist and throwIfNotFound is false
   */
  async readJSON<T = unknown>(
    filePath: string,
    options: ReadJSONOptions = {}
  ): Promise<T | null> {
    const {
      encoding = "utf-8",
      throwIfNotFound = false
    } = options;

    const fullPath = this.resolvePath(filePath);
    try {
      const content = await fs.readFile(fullPath, encoding);
      try {
        return JSON.parse(content) as T;
      } catch (parseError) {
        console.error(`[LocalStorageEngine] Failed to parse JSON: ${fullPath}`);
        console.error(`[LocalStorageEngine] Content length: ${content.length}, Error at position: ${(parseError as any).message?.match(/position (\d+)/)?.[1] || 'unknown'}`);
        console.error(`[LocalStorageEngine] Content preview (last 200 chars): ${content.slice(-200)}`);
        throw parseError;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        if (throwIfNotFound) {
          throw new Error(`File not found: ${fullPath}`);
        }
        return null;
      }
      throw error;
    }
  }

  /**
   * Write an object to a JSON file atomically
   *
   * Uses atomic write pattern:
   * 1. Write to temporary file ({filepath}.tmp)
   * 2. Rename temp file to target (atomic operation)
   * 3. Delete temp file on failure
   *
   * @param filePath - Path to the JSON file (relative to basePath or absolute)
   * @param data - Object to serialize to JSON
   * @param options - Write options
   */
  async writeJSON<T>(
    filePath: string,
    data: T,
    options: WriteJSONOptions = {}
  ): Promise<void> {
    const {
      encoding = "utf-8",
      createDirectories = true,
      indent = 2
    } = options;

    const fullPath = this.resolvePath(filePath);

    // Create parent directories if needed
    if (createDirectories) {
      const dirPath = path.dirname(fullPath);
      await this.ensureDir(dirPath);
    }

    // Use atomic write: temp file + rename
    const tempPath = `${fullPath}.tmp`;
    try {
      // Write to temp file
      const content = indent === 0
        ? JSON.stringify(data)
        : JSON.stringify(data, null, indent);
      await fs.writeFile(tempPath, content, encoding);

      // Atomically rename to target
      await fs.rename(tempPath, fullPath);
    } catch (error) {
      // Clean up temp file on failure
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Read a Markdown file
   *
   * @param filePath - Path to the Markdown file (relative to basePath or absolute)
   * @param options - Read options
   * @returns File contents as string, or null if file doesn't exist and throwIfNotFound is false
   */
  async readMarkdown(
    filePath: string,
    options: ReadMarkdownOptions = {}
  ): Promise<string | null> {
    const {
      encoding = "utf-8",
      throwIfNotFound = false
    } = options;

    const fullPath = this.resolvePath(filePath);
    try {
      return await fs.readFile(fullPath, encoding);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        if (throwIfNotFound) {
          throw new Error(`File not found: ${fullPath}`);
        }
        return null;
      }
      throw error;
    }
  }

  /**
   * Write a Markdown file atomically
   *
   * Uses atomic write pattern:
   * 1. Write to temporary file ({filepath}.tmp)
   * 2. Rename temp file to target (atomic operation)
   * 3. Delete temp file on failure
   *
   * @param filePath - Path to the Markdown file (relative to basePath or absolute)
   * @param content - Markdown content to write
   * @param options - Write options
   */
  async writeMarkdown(
    filePath: string,
    content: string,
    options: WriteMarkdownOptions = {}
  ): Promise<void> {
    const {
      encoding = "utf-8",
      createDirectories = true
    } = options;

    const fullPath = this.resolvePath(filePath);

    // Create parent directories if needed
    if (createDirectories) {
      const dirPath = path.dirname(fullPath);
      await this.ensureDir(dirPath);
    }

    // Use atomic write: temp file + rename
    const tempPath = `${fullPath}.tmp`;
    try {
      // Write to temp file
      await fs.writeFile(tempPath, content, encoding);

      // Atomically rename to target
      await fs.rename(tempPath, fullPath);
    } catch (error) {
      // Clean up temp file on failure
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Delete a file
   *
   * @param filePath - Path to the file to delete (relative to basePath or absolute)
   */
  async deleteFile(filePath: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  /**
   * Check if a file exists
   *
   * @param filePath - Path to check (relative to basePath or absolute)
   * @returns true if the file exists and is accessible, false otherwise
   */
  async fileExists(filePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all files in a directory with a given extension
   *
   * This is an additional method not in IStorageEngine interface.
   *
   * @param dirPath - Path to the directory (relative to basePath or absolute)
   * @param extension - Optional file extension filter
   * @returns List of file names
   */
  async listFiles(dirPath: string, extension?: string): Promise<string[]> {
    const fullPath = this.resolvePath(dirPath);
    try {
      const files = await fs.readdir(fullPath);
      if (extension) {
        return files.filter((file) => file.endsWith(extension));
      }
      return files;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get file stats (mtime, ctime, size)
   *
   * This is an additional method not in IStorageEngine interface.
   *
   * @param filePath - Path to the file (relative to basePath or absolute)
   * @returns File stats or null if file doesn't exist
   */
  async getFileStats(filePath: string): Promise<Stats | null> {
    const fullPath = this.resolvePath(filePath);
    try {
      return await fs.stat(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }
}


// Default instance for convenience
export const storage = new LocalStorageEngine();
