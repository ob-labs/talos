/**
 * Ralph 命令工具函数
 * Ralph Command Utility Functions
 */

import { readdir, stat, readFile, mkdir, copyFile, writeFile, rm } from 'fs/promises';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createInterface } from 'readline';
import { WriteStream } from 'fs';

const execAsync = promisify(exec);

/**
 * Spinner animation for long-running operations
 */
export class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private frameIndex = 0;
  private interval: NodeJS.Timeout | null = null;
  private message: string;
  private stream: WriteStream;
  private isSilent: boolean;
  private lastLine = '';

  constructor(message: string, stream: WriteStream = process.stderr) {
    this.message = message;
    this.stream = stream;
    this.isSilent = !stream.isTTY;
  }

  start(): void {
    if (this.isSilent) return;

    // Hide cursor
    this.stream.write('\x1b[?25l');

    this.interval = setInterval(() => {
      const frame = this.frames[this.frameIndex];
      const line = `${frame} ${this.message}`;

      // Clear line and write new content
      this.stream.write(`\r\x1b[K${line}`);
      this.stream.write('\x1b[0G'); // Move to beginning of line

      this.lastLine = line;
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 80);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    // Clear the spinner line
    this.stream.write(`\r\x1b[K`);

    // Show cursor again
    this.stream.write('\x1b[?25h');
  }

  succeed(message?: string): void {
    this.stop();
    if (!this.isSilent && message) {
      this.stream.write(`✅ ${message}\n`);
    }
  }

  fail(message?: string): void {
    this.stop();
    if (!this.isSilent && message) {
      this.stream.write(`❌ ${message}\n`);
    }
  }
}

/**
 * 扫描未提交的 PRD 文件
 * Scan for uncommitted PRD files
 *
 * 扫描 tasks/ 目录，查找所有匹配 prd-*.md 模式的文件，
 * 并使用 git status --porcelain 检查每个文件的 git 状态。
 * 返回未提交（包括新文件和已修改）的 PRD 文件名数组。
 *
 * Scans the tasks/ directory for files matching prd-*.md pattern,
 * and uses git status --porcelain to check git status of each file.
 * Returns array of uncommitted PRD filenames (new or modified).
 *
 * @param projectRoot - 项目根目录 (Project root directory)
 * @returns Promise resolving to array of uncommitted PRD filenames
 *
 * @example
 * ```typescript
 * const uncommittedPRDs = await getUncommittedPRDs('/path/to/project');
 * // 返回: ['prd-talos-cli.md', 'prd-new-feature.md']
 * ```
 */
export async function getUncommittedPRDs(projectRoot: string): Promise<string[]> {
  const tasksDir = join(projectRoot, 'tasks');

  // 1. 检查 tasks/ 目录是否存在
  // Check if tasks/ directory exists
  try {
    await stat(tasksDir);
  } catch {
    // 目录不存在，返回空数组（不抛出错误）
    // Directory doesn't exist, return empty array (don't throw error)
    return [];
  }

  // 2. 扫描目录查找所有 PRD 文件
  // Scan directory for all PRD files
  let allFiles: string[];
  try {
    allFiles = await readdir(tasksDir);
  } catch {
    // 读取失败，返回空数组
    // Failed to read, return empty array
    return [];
  }

  // 3. 过滤出匹配 prd-*.md 模式的文件
  // Filter files matching prd-*.md pattern
  const prdFiles = allFiles.filter((file) => /^prd-.*\.md$/.test(file));

  if (prdFiles.length === 0) {
    return [];
  }

  // 4. 检查每个 PRD 文件的 git 状态
  // Check git status for each PRD file
  const uncommittedPRDs: string[] = [];

  try {
    // 使用 git status --porcelain 获取文件状态
    // Use git status --porcelain to get file status
    const { stdout } = await execAsync('git status --porcelain', {
      cwd: projectRoot,
    });

    // 解析输出，查找未提交的文件
    // Parse output to find uncommitted files
    // 输出格式: XY filename
    // X = 索引状态, Y = 工作树状态
    // 我们关注工作树状态 (Y) 为 M (修改) 或 ?? (未跟踪)
    const lines = stdout.split('\n').filter((line) => line.trim());

    for (const prdFile of prdFiles) {
      const relativePath = `tasks/${prdFile}`;

      // 检查文件是否在 git status 输出中
      // Check if file is in git status output
      const isUncommitted = lines.some((line) => {
        const parts = line.trim().split(/\s+/);
        // parts[0] = XY 状态码, parts[1...] = 文件路径
        const statusCode = parts[0];
        const filePath = parts.slice(1).join(' ');

        // 匹配文件路径
        // Match file path
        if (filePath === relativePath || filePath === prdFile) {
          // 检查状态码：工作树状态 (第二个字符) 为 M 或 ?
          // Check status code: worktree status (second char) is M or ?
          const worktreeStatus = statusCode.length >= 2 ? statusCode[1] : statusCode[0];
          return worktreeStatus === 'M' || worktreeStatus === '?';
        }
        return false;
      });

      if (isUncommitted) {
        uncommittedPRDs.push(prdFile);
      }
    }
  } catch (error) {
    // git status 执行失败，抛出错误
    // Failed to execute git status, throw error
    throw new Error(
      `执行 git status 失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return uncommittedPRDs;
}

/**
 * 从 PRD 文件名中提取标识符
 * Extract identifier from PRD filename
 *
 * 从 PRD 文件名中提取特征标识符，移除 prd- 前缀和 .md 扩展名。
 * 支持文件名中包含多个连字符的情况。
 *
 * Extracts feature identifier from PRD filename by removing prd- prefix
 * and .md extension. Handles filenames with multiple hyphens.
 *
 * @param filename - PRD 文件名，如 "prd-talos-cli.md" (PRD filename, e.g., "prd-talos-cli.md")
 * @returns 提取的标识符，如 "talos-cli" (Extracted identifier, e.g., "talos-cli")
 * @throws {Error} 如果文件名格式不符合预期 (If filename format doesn't match expected pattern)
 *
 * @example
 * ```typescript
 * extractPRDIdentifier('prd-talos-cli.md')
 * // 返回: 'talos-cli'
 *
 * extractPRDIdentifier('prd-cli-prd-anywhere.md')
 * // 返回: 'cli-prd-anywhere'
 * ```
 */
export function extractPRDIdentifier(filename: string): string {
  // 验证文件名格式
  // Validate filename format
  const match = filename.match(/^prd-(.+)\.md$/);

  if (!match) {
    throw new Error(
      `无效的 PRD 文件名格式: "${filename}"。期望格式: "prd-<identifier>.md"`
    );
  }

  // 返回标识符部分（移除 prd- 前缀和 .md 扩展名）
  // Return identifier part (remove prd- prefix and .md extension)
  return match[1];
}


/**
 * 归档当前的 PRD 运行记录
 * Archive current PRD run records
 *
 * 检查 ralph/{name}/prd.json 是否存在，如果存在则归档。
 * 创建归档目录并将当前的 prd.json 和 progress.txt 复制到归档目录中。
 * 然后重置 progress.txt 为新的初始状态。
 *
 * Checks if ralph/{name}/prd.json exists, and if so, triggers archiving.
 * Creates an archive directory and copies the current prd.json and progress.txt
 * to the archive directory. Then resets progress.txt to its initial state.
 *
 * @param projectRoot - 项目根目录 (Project root directory)
 *
 * @example
 * ```typescript
 * // 归档当前的 PRD 记录（如果存在）
 * await archiveCurrentPRD('/path/to/project');
 * // 结果：
 * // - 创建 archive/cli-ralph-intelligent-2026-03-05/ 目录
 * // - 复制 ralph/cli-ralph-intelligent/prd.json 和 progress.txt 到该目录
 * // - 重置 ralph/cli-ralph-intelligent/progress.txt 为新的 header
 * ```
 */
export async function archiveCurrentPRD(projectRoot: string, specificIdentifier?: string): Promise<void> {
  // 1. 检查新路径 ralph/{name}/prd.json
  // 1. Check new path ralph/{name}/prd.json
  const newRalphBaseDir = join(projectRoot, 'ralph');
  let prdJsonPath: string | null = null;
  let progressTxtPath: string | null = null;
  let identifier: string | null = null;

  // 如果指定了 identifier，直接使用它
  // If identifier is specified, use it directly
  if (specificIdentifier) {
    const specificDir = join(newRalphBaseDir, specificIdentifier);
    const specificPrdJson = join(specificDir, 'prd.json');

    try {
      await stat(specificPrdJson);
      prdJsonPath = specificPrdJson;
      progressTxtPath = join(specificDir, 'progress.txt');
      identifier = specificIdentifier;
    } catch {
      // 指定的 PRD 不存在，直接返回
      // Specified PRD doesn't exist, return directly
      console.log(`指定的 PRD 不存在: ${specificIdentifier}`);
      return;
    }
  } else {
    // 没有指定 identifier，查找第一个包含 prd.json 的子目录
    // No identifier specified, find first subdirectory containing prd.json
    try {
      const entries = await readdir(newRalphBaseDir);
      // 查找第一个包含 prd.json 的子目录
      // Find first subdirectory containing prd.json
      for (const entry of entries) {
        const entryPath = join(newRalphBaseDir, entry);
        const stats = await stat(entryPath);
        if (stats.isDirectory()) {
          const potentialPrdJson = join(entryPath, 'prd.json');
          try {
            await stat(potentialPrdJson);
            // 找到了 prd.json，使用这个路径
            // Found prd.json, use this path
            prdJsonPath = potentialPrdJson;
            progressTxtPath = join(entryPath, 'progress.txt');
            identifier = entry;
            break;
          } catch {
            // 这个目录没有 prd.json，继续查找
            // This directory doesn't have prd.json, continue searching
            continue;
          }
        }
      }
    } catch {
      // ralph/ 目录不存在或读取失败，直接返回
      // ralph/ directory doesn't exist or read failed, return directly
      return;
    }
  }

  // 2. 检查是否找到了 prd.json
  // Check if prd.json was found
  if (!prdJsonPath || !progressTxtPath || !identifier) {
    // prd.json 不存在，直接返回（不执行归档）
    // prd.json doesn't exist, return directly (don't archive)
    return;
  }

  // 3. 读取 prd.json 并提取 branchName
  // Read prd.json and extract branchName
  let prdJsonContent: string;
  try {
    prdJsonContent = await readFile(prdJsonPath, 'utf-8');
  } catch {
    // 读取失败，直接返回
    // Failed to read, return directly
    return;
  }

  let prdData: { branchName?: string };
  try {
    prdData = JSON.parse(prdJsonContent);
  } catch {
    // JSON 解析失败，直接返回
    // Failed to parse JSON, return directly
    return;
  }

  const branchName = prdData.branchName;
  if (!branchName) {
    // 没有 branchName 字段，直接返回
    // No branchName field, return directly
    return;
  }

  // 4. 创建归档目录：archive/{identifier}-YYYY-MM-DD/
  // Create archive directory: archive/{identifier}-YYYY-MM-DD/
  const archiveBaseDir = join(projectRoot, 'archive');
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const archiveDir = join(archiveBaseDir, `${today}-${identifier}`);

  try {
    // 创建归档目录（包括父目录）
    // Create archive directory (including parent directories)
    await mkdir(archiveDir, { recursive: true });

    // 显示归档进度
    // Show archiving progress
    console.log(`📦 归档旧的 PRD: ${branchName} → ${archiveDir}`);

    // 5. 复制 prd.json 和 progress.txt 到归档目录
    // Copy prd.json and progress.txt to archive directory
    await copyFile(prdJsonPath, join(archiveDir, 'prd.json'));

    // 6. 复制 progress.txt（如果存在）
    // Copy progress.txt (if exists)
    try {
      await stat(progressTxtPath);
      await copyFile(progressTxtPath, join(archiveDir, 'progress.txt'));
    } catch {
      // progress.txt 不存在，跳过复制
      // progress.txt doesn't exist, skip copy
    }

    // 7. 删除 ralph/ 目录下的 PRD 文件
    // Delete PRD files in ralph/ directory
    const ralphDir = join(newRalphBaseDir, identifier);
    try {
      await rm(ralphDir, { recursive: true, force: true });
      console.log(`🗑️  已删除 ralph 目录: ${identifier}`);
    } catch (error) {
      // 删除失败，只警告不抛出错误
      // Deletion failed, warn only
      console.warn(`⚠️  删除 ralph 目录失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error) {
    // 归档过程中出错，抛出错误
    // Error during archiving, throw error
    throw new Error(
      `归档 PRD 失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 获取 Ralph 目录路径
 * Get Ralph directory path
 *
 * 计算 Ralph 目录的路径，用于存放 PRD 转换结果。
 * 路径格式为 <projectRoot>/ralph/<identifier>。
 *
 * Calculates the Ralph directory path for storing PRD conversion results.
 * Path format is <projectRoot>/ralph/<identifier>.
 *
 * @param projectRoot - 项目根目录 (Project root directory)
 * @param identifier - PRD 标识符，如 "talos-cli" (PRD identifier, e.g., "talos-cli")
 * @returns Ralph 目录路径 (Ralph directory path)
 *
 * @example
 * ```typescript
 * const path = getRalphDirectoryPath('/path/to/project', 'talos-cli');
 * // 返回: '/path/to/project/ralph/talos-cli'
 *
 * const path2 = getRalphDirectoryPath('/path/to/project', 'cli-prd-anywhere');
 * // 返回: '/path/to/project/ralph/cli-prd-anywhere'
 * ```
 */
export function getRalphDirectoryPath(projectRoot: string, identifier: string): string {
  return join(projectRoot, 'ralph', identifier);
}

/**
 * 确保创建 Ralph 目录结构
 * Ensure necessary Ralph directories are created
 *
 * 在 ralph/{name}/ 目录中创建必要的目录结构。
 * 如果目录已存在，不抛出错误。
 *
 * Creates necessary directory structure in ralph/{name}/ directory.
 * Does not throw error if directory already exists.
 *
 * @param ralphDir - Ralph 目录路径 (Ralph directory path)
 *
 * @example
 * ```typescript
 * // 创建 ralph/talos-cli/ 目录
 * ensureRalphDirectories('/path/to/project/ralph/talos-cli');
 * // 结果：确保 /path/to/project/ralph/talos-cli/ 目录存在
 * ```
 */
export function ensureRalphDirectories(ralphDir: string): void {
  // 使用 { recursive: true } 创建多级目录，如果目录已存在不报错
  // Use { recursive: true } to create multi-level directories, no error if exists
  mkdirSync(ralphDir, { recursive: true });
}


/**
 * 扫描 ralph/ 目录查找 PRD 目录
 * Scan ralph/ directory to find PRD directories
 *
 * 扫描 ralph/ 目录，查找所有包含 prd.json 文件的子目录。
 * 返回这些子目录的名称数组。
 *
 * Scans the ralph/ directory for subdirectories containing prd.json files.
 * Returns array of subdirectory names.
 *
 * @param projectRoot - 项目根目录 (Project root directory)
 * @returns Promise resolving to array of PRD directory names
 *
 * @example
 * ```typescript
 * const prdDirs = await scanRalphDirectories('/path/to/project');
 * // 返回: ['cli-ralph-intelligent-detection', 'talos-cli']
 * ```
 */
export async function scanRalphDirectories(projectRoot: string): Promise<string[]> {
  const ralphBaseDir = join(projectRoot, 'ralph');

  // 1. 检查 ralph/ 目录是否存在
  // Check if ralph/ directory exists
  try {
    await stat(ralphBaseDir);
  } catch {
    // 目录不存在，返回空数组
    // Directory doesn't exist, return empty array
    return [];
  }

  // 2. 读取 ralph/ 目录内容
  // Read ralph/ directory contents
  let entries: string[];
  try {
    entries = await readdir(ralphBaseDir);
  } catch {
    // 读取失败，返回空数组
    // Failed to read, return empty array
    return [];
  }

  // 3. 查找包含 prd.json 的子目录
  // Find subdirectories containing prd.json
  const prdDirs: string[] = [];

  for (const entry of entries) {
    const entryPath = join(ralphBaseDir, entry);
    try {
      const entryStats = await stat(entryPath);
      if (entryStats.isDirectory()) {
        // 检查是否包含 prd.json
        // Check if it contains prd.json
        const prdJsonPath = join(entryPath, 'prd.json');
        try {
          await stat(prdJsonPath);
          prdDirs.push(entry);
        } catch {
          // 没有 prd.json，跳过
          // No prd.json, skip
          continue;
        }
      }
    } catch {
      // 忽略错误，继续检查下一个
      // Ignore error and continue checking next
      continue;
    }
  }

  return prdDirs;
}


/**
 * 获取 PRD 完成状态摘要
 * Get PRD completion summary
 *
 * 读取 PRD 文件并统计完成状态，返回总故事数、已完成数、待完成数和是否完成。
 * 如果文件不存在或格式不正确，返回零值。
 *
 * Reads PRD file and calculates completion status, returns total stories,
 * completed count, pending count, and completion flag.
 * Returns zero values if file doesn't exist or format is incorrect.
 *
 * @param prdJsonPath - PRD JSON 文件路径 (PRD JSON file path)
 * @returns Promise resolving to completion summary
 *
 * @example
 * ```typescript
 * const summary = await getPRDCompletionSummary('/path/to/prd.json');
 * // 返回: { total: 5, completed: 3, pending: 2, isComplete: false }
 * ```
 */
export async function getPRDCompletionSummary(prdJsonPath: string): Promise<{
  total: number;
  completed: number;
  pending: number;
  isComplete: boolean;
}> {
  try {
    const content = await readFile(prdJsonPath, 'utf-8');
    const prd = JSON.parse(content);

    if (!prd.userStories || !Array.isArray(prd.userStories)) {
      return { total: 0, completed: 0, pending: 0, isComplete: false };
    }

    const total = prd.userStories.length;
    const completed = prd.userStories.filter((s: any) => s.passes === true).length;
    const pending = total - completed;

    return {
      total,
      completed,
      pending,
      isComplete: pending === 0
    };
  } catch {
    return { total: 0, completed: 0, pending: 0, isComplete: false };
  }
}
