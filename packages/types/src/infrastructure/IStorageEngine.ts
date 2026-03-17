/**
 * Infrastructure Layer: Storage Engine Interface
 *
 * Defines the contract for file storage operations.
 * Implementations must provide atomic writes to prevent data corruption.
 */

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
 * Storage Engine Interface
 *
 * Provides abstraction over file storage operations.
 * Implementations MUST ensure atomic writes to prevent data corruption.
 *
 * Atomic write guarantees:
 * - Writes go to a temporary file first
 * - On success, the temporary file is renamed to the target path
 * - Rename operations are atomic on the filesystem level
 * - If write fails, the original file remains intact
 */
export interface IStorageEngine {
  /**
   * Read and parse a JSON file
   *
   * @param filePath - Absolute path to the JSON file
   * @param options - Read options
   * @returns Parsed JSON object, or null if file doesn't exist and throwIfNotFound is false
   *
   * @throws {Error} If file doesn't exist and throwIfNotFound is true
   * @throws {SyntaxError} If file contains invalid JSON
   *
   * Implementation notes:
   * - Must handle JSON parsing errors gracefully
   * - Should provide clear error messages with file path
   */
  readJSON<T = unknown>(
    filePath: string,
    options?: ReadJSONOptions
  ): Promise<T | null>;

  /**
   * Write an object to a JSON file atomically
   *
   * @param filePath - Absolute path to the JSON file
   * @param data - Object to serialize to JSON
   * @param options - Write options
   *
   * @throws {Error} If write operation fails
   *
   * Implementation notes:
   * - MUST use atomic writes (write to temp file, then rename)
   * - Temporary file should be in the same directory as target
   * - Must create parent directories if createDirectories is true
   * - Should ensure write permissions before attempting write
   */
  writeJSON<T>(
    filePath: string,
    data: T,
    options?: WriteJSONOptions
  ): Promise<void>;

  /**
   * Read a Markdown file
   *
   * @param filePath - Absolute path to the Markdown file
   * @param options - Read options
   * @returns File contents as string, or null if file doesn't exist and throwIfNotFound is false
   *
   * @throws {Error} If file doesn't exist and throwIfNotFound is true
   *
   * Implementation notes:
   * - Should handle different line endings (LF, CRLF) consistently
   * - Must preserve original file content
   */
  readMarkdown(
    filePath: string,
    options?: ReadMarkdownOptions
  ): Promise<string | null>;

  /**
   * Write a Markdown file atomically
   *
   * @param filePath - Absolute path to the Markdown file
   * @param content - Markdown content to write
   * @param options - Write options
   *
   * @throws {Error} If write operation fails
   *
   * Implementation notes:
   * - MUST use atomic writes (write to temp file, then rename)
   * - Temporary file should be in the same directory as target
   * - Must create parent directories if createDirectories is true
   * - Should ensure write permissions before attempting write
   */
  writeMarkdown(
    filePath: string,
    content: string,
    options?: WriteMarkdownOptions
  ): Promise<void>;

  /**
   * Delete a file
   *
   * @param filePath - Absolute path to the file to delete
   *
   * @throws {Error} If the file doesn't exist or cannot be deleted
   *
   * Implementation notes:
   * - Should handle non-existent files gracefully (may throw or ignore)
   * - Must provide clear error messages on failure
   */
  deleteFile(filePath: string): Promise<void>;

  /**
   * Check if a file exists
   *
   * @param filePath - Absolute path to check
   * @returns true if the file exists and is accessible, false otherwise
   *
   * Implementation notes:
   * - Must not throw exceptions
   * - Should handle permission errors gracefully (return false)
   * - Must distinguish between files and directories (only return true for files)
   */
  fileExists(filePath: string): Promise<boolean>;
}
