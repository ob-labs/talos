/**
 * Simple Task Storage
 * 简单任务存储
 *
 * Provides persistent storage for SimpleTask items in .talos/tasks.json
 * 为 .talos/tasks.json 中的 SimpleTask 项提供持久化存储
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { SimpleTask } from '@talos/types';

/**
 * Simple Task Storage class
 * 简单任务存储类
 *
 * Manages loading and saving SimpleTask items to .talos/tasks.json
 * 管理将 SimpleTask 项加载和保存到 .talos/tasks.json
 */
export class SimpleTaskStorage {
  private repoRoot: string;

  /**
   * Create a new SimpleTaskStorage instance
   * 创建新的 SimpleTaskStorage 实例
   *
   * @param repoRoot - Repository root directory (仓库根目录)
   */
  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
  }

  /**
   * Get the tasks file path
   * 获取任务文件路径
   *
   * @returns Absolute path to .talos/tasks.json
   */
  getTasksFilePath(): string {
    return join(this.repoRoot, '.talos', 'tasks.json');
  }

  /**
   * Load tasks from storage
   * 从存储加载任务
   *
   * @returns Array of SimpleTask items (任务数组)
   * @throws Error with clear message if file cannot be read
   */
  async loadTasks(): Promise<SimpleTask[]> {
    const filePath = this.getTasksFilePath();

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as SimpleTask[];
    } catch (error) {
      // If file doesn't exist, return empty array
      // 如果文件不存在，返回空数组
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }

      // For other errors, throw with clear message
      // 对于其他错误，抛出清晰的错误消息
      throw new Error(
        `Failed to load tasks from ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Save tasks to storage
   * 保存任务到存储
   *
   * @param tasks - Array of SimpleTask items to save (要保存的任务数组)
   * @throws Error with clear message if file cannot be written
   */
  async saveTasks(tasks: SimpleTask[]): Promise<void> {
    const filePath = this.getTasksFilePath();
    const talosDir = join(this.repoRoot, '.talos');

    try {
      // Ensure .talos directory exists
      // 确保 .talos 目录存在
      await fs.mkdir(talosDir, { recursive: true });

      // Write tasks to file with pretty formatting
      // 将任务写入文件，使用美化格式
      await fs.writeFile(filePath, JSON.stringify(tasks, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to save tasks to ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
