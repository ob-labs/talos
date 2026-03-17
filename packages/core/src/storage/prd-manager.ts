import type { PRD } from "@talos/types";
import { promises as fs } from "fs";
import * as path from "path";

/**
 * PRD Manager
 *
 * 管理单个 PRD 文件的读取，封装路径逻辑
 *
 * @example
 * ```typescript
 * const prdManager = new PRDManager(workingDir, prdId);
 * const prd = await prdManager.getPRD();
 * const stats = await prdManager.getStats();
 * ```
 */
export class PRDManager {
  private workingDir: string;
  private prdId: string;

  /**
   * 创建 PRDManager
   *
   * @param workingDir - 工作目录（worktree 路径或全局路径）
   * @param prdId - PRD 标识符
   */
  constructor(workingDir: string, prdId: string) {
    this.workingDir = workingDir;
    this.prdId = prdId;
  }

  /**
   * 获取 PRD 文件的完整路径
   * @private
   */
  private getPRDPath(): string {
    return path.join(this.workingDir, "ralph", this.prdId, "prd.json");
  }

  /**
   * 获取 PRD
   *
   * @returns PRD 对象或 null（如果文件不存在）
   */
  async getPRD(): Promise<PRD | null> {
    return await this.readPRDFile(this.getPRDPath());
  }

  /**
   * 获取 PRD 文件统计信息
   *
   * @returns 文件统计信息或 null（如果文件不存在）
   */
  async getStats(): Promise<{
    createdAt: string;
    modifiedAt: string;
    size: number;
  } | null> {
    try {
      const stats = await fs.stat(this.getPRDPath());
      return {
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        size: stats.size,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 读取 PRD 文件
   * @private
   */
  private async readPRDFile(prdPath: string): Promise<PRD | null> {
    try {
      const content = await fs.readFile(prdPath, 'utf-8');
      return JSON.parse(content) as PRD;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}
