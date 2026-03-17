/**
 * WorktreeRepository - Worktree 仓储接口和实现
 *
 * 职责：
 * - 持久化 worktree 元数据（path, branch）
 * - 提供基于路径的查询
 *
 * 注意：Worktree 是纯 Git 概念，其真实存在性由 Git 管理
 * Repository 只用于缓存元数据，提升查询性能
 *
 * @example
 * ```typescript
 * const repository = new WorktreeRepository();
 *
 * // 保存 worktree 元数据
 * const worktree = Worktree.fromProperties('/path/to/worktree', 'feature-branch');
 * await repository.save(worktree);
 *
 * // 查找 worktree
 * const found = await repository.findByPath('/path/to/worktree');
 * ```
 */

import { Worktree, type WorktreeDTO } from "../entities/Worktree";
import { LocalStorageEngine } from "@/storage/storage";
import { homedir } from "os";
import * as path from "path";

/**
 * WorktreeRepository 仓储接口
 */
export interface IWorktreeRepository {
  save(worktree: Worktree): Promise<void>;
  findByPath(worktreePath: string): Promise<Worktree | null>;
  findAll(): Promise<Worktree[]>;
  delete(worktreePath: string): Promise<void>;
  exists(worktreePath: string): Promise<boolean>;
}

/**
 * WorktreeRepository 实现
 *
 * 使用 ~/.talos 作为基础目录存储 worktree 元数据
 */
export class WorktreeRepository implements IWorktreeRepository {
  private storage: LocalStorageEngine;
  private readonly worktreesDir = "worktrees";

  constructor() {
    this.storage = new LocalStorageEngine(homedir() + "/.talos");
  }

  /**
   * 根据 worktree 路径生成存储 ID
   * 使用路径的 hash 作为 ID，避免路径中的特殊字符问题
   */
  private getStorageId(worktreePath: string): string {
    // 简单的 hash 函数
    let hash = 0;
    for (let i = 0; i < worktreePath.length; i++) {
      const char = worktreePath.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `wt_${Math.abs(hash)}`;
  }

  /**
   * 获取 worktree 存储路径
   */
  private getWorktreePath(storageId: string): string {
    return `${this.worktreesDir}/${storageId}.json`;
  }

  /**
   * 保存 worktree 元数据（创建或更新）
   *
   * @param worktree - Worktree 实体
   */
  async save(worktree: Worktree): Promise<void> {
    const storageId = this.getStorageId(worktree.path);
    const dto = worktree.toDTO();
    await this.storage.writeJSON(this.getWorktreePath(storageId), dto);
  }

  /**
   * 根据路径查找 worktree
   *
   * @param worktreePath - Worktree 路径
   * @returns Worktree 实体或 null
   */
  async findByPath(worktreePath: string): Promise<Worktree | null> {
    const storageId = this.getStorageId(worktreePath);
    const dto = await this.storage.readJSON<WorktreeDTO>(this.getWorktreePath(storageId));
    if (!dto) {
      return null;
    }

    return Worktree.fromDTO(dto);
  }

  /**
   * 查找所有 worktree
   *
   * @returns Worktree 数组
   */
  async findAll(): Promise<Worktree[]> {
    const files = await this.storage.listFiles(this.worktreesDir, ".json");
    const worktrees: Worktree[] = [];

    for (const file of files) {
      const dto = await this.storage.readJSON<WorktreeDTO>(`${this.worktreesDir}/${file}`);
      if (dto) {
        worktrees.push(Worktree.fromDTO(dto));
      }
    }

    return worktrees;
  }

  /**
   * 删除 worktree 元数据
   *
   * @param worktreePath - Worktree 路径
   */
  async delete(worktreePath: string): Promise<void> {
    const storageId = this.getStorageId(worktreePath);
    await this.storage.deleteFile(this.getWorktreePath(storageId));
  }

  /**
   * 检查 worktree 元数据是否存在
   *
   * @param worktreePath - Worktree 路径
   * @returns true 如果存在
   */
  async exists(worktreePath: string): Promise<boolean> {
    const storageId = this.getStorageId(worktreePath);
    return await this.storage.fileExists(this.getWorktreePath(storageId));
  }
}
