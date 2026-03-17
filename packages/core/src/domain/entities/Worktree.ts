/**
 * Worktree - Git 工作树实体
 *
 * 纯 Git 概念：封装 Git worktree 的操作
 *
 * 职责：
 * - 封装 worktree 的 Git 操作（创建、删除、检查）
 * - 不包含业务逻辑（PRD、日志等由 Task/TaskLifecycleManager 负责）
 *
 * @example
 * ```typescript
 * // 创建新的 worktree
 * const worktree = await Worktree.create('/path/to/repo', '/path/to/repo/worktrees/feature', 'feature-branch');
 *
 * // 从现有数据加载
 * const existing = Worktree.fromProperties('/path/to/repo/worktrees/feature', 'feature-branch');
 *
 * // Git 操作
 * const exists = await worktree.existsInGit();
 * await worktree.remove();
 * ```
 */

import { GitWorktree, GitBranch, GitRepository } from "@talos/git";

/**
 * Worktree 实体属性
 */
export interface WorktreeProperties {
  /**
   * Worktree 文件系统路径
   */
  path: string;

  /**
   * 关联的 Git 分支名
   */
  branch: string;
}

/**
 * Worktree DTO 用于序列化
 */
export interface WorktreeDTO {
  path: string;
  branch: string;
}

/**
 * Worktree Entity - Git 工作树实体（纯 Git 概念）
 */
export class Worktree {
  readonly path: string;
  readonly branch: string;

  private constructor(props: WorktreeProperties) {
    this.path = props.path;
    this.branch = props.branch;
  }

  // ==========================================
  // 工厂方法
  // ==========================================

  /**
   * 创建新的 worktree（含 Git 操作）
   *
   * @param repoRoot - 仓库根目录
   * @param worktreePath - worktree 路径
   * @param branch - 分支名
   * @returns Worktree 实体
   * @throws Error 如果 Git 操作失败
   */
  static async create(
    repoRoot: string,
    worktreePath: string,
    branch: string
  ): Promise<Worktree> {
    const worktree = new Worktree({ path: worktreePath, branch });
    await worktree.createInGit(repoRoot);
    return worktree;
  }

  /**
   * 从现有 worktree 加载（不执行 Git 操作）
   *
   * @param props - Worktree 属性
   * @returns Worktree 实体
   */
  static fromProperties(props: WorktreeProperties): Worktree {
    return new Worktree(props);
  }

  /**
   * 从 DTO 恢复 Worktree
   *
   * @param dto - Worktree DTO
   * @returns Worktree 实体
   */
  static fromDTO(dto: WorktreeDTO): Worktree {
    return new Worktree({
      path: dto.path,
      branch: dto.branch,
    });
  }

  // ==========================================
  // Git 操作方法
  // ==========================================

  /**
   * 检查 worktree 在 Git 中是否存在
   *
   * @param repoRoot - 仓库根目录
   * @returns true 如果 worktree 存在
   */
  async existsInGit(repoRoot: string): Promise<boolean> {
    const gitWorktree = new GitWorktree(repoRoot);
    const result = await gitWorktree.isWorktree(this.path);
    return result.success && result.data === true;
  }

  /**
   * 删除 worktree
   *
   * @param repoRoot - 仓库根目录
   * @returns Git 操作结果
   */
  async remove(repoRoot: string): Promise<{ success: boolean; error?: string }> {
    const gitWorktree = new GitWorktree(repoRoot);
    return await gitWorktree.remove(this.path, true);
  }

  /**
   * 切换到指定分支
   *
   * @returns Git 操作结果
   */
  async switchToBranch(): Promise<{ success: boolean; error?: string }> {
    const gitBranch = new GitBranch(this.path);
    const result = await gitBranch.switch(this.branch);

    if (result.success) {
      return { success: true };
    }
    return { success: false, error: result.error };
  }

  /**
   * 获取当前分支名
   *
   * @returns 当前分支名，失败返回 null
   */
  async getCurrentBranch(): Promise<string | null> {
    const gitRepo = new GitRepository(this.path);
    const result = await gitRepo.getCurrentBranch();

    if (result.success && result.data) {
      return result.data;
    }
    return null;
  }

  // ==========================================
  // 私有方法 - Git 操作实现
  // ==========================================

  /**
   * 在 Git 中创建 worktree（私有方法）
   *
   * @param repoRoot - 仓库根目录
   * @throws Error 如果创建失败
   */
  private async createInGit(repoRoot: string): Promise<void> {
    const gitWorktree = new GitWorktree(repoRoot);

    // 检查是否已存在
    const existing = await gitWorktree.isWorktree(this.path);
    if (existing.success && existing.data) {
      // 已存在，切换到正确分支
      await this.switchToBranch();
      return;
    }

    // 检查分支是否存在
    const gitBranch = new GitBranch(repoRoot);
    const branchExists = await gitBranch.exists(this.branch);

    let createResult: any;
    if (branchExists.success && branchExists.data) {
      // 分支存在，从分支创建
      createResult = await gitWorktree.createFromBranch(this.path, this.branch);
    } else {
      // 分支不存在，创建新分支
      createResult = await gitWorktree.create(this.path, this.branch);
    }

    if (!createResult.success) {
      throw new Error(`Failed to create worktree: ${createResult.error}`);
    }
  }

  // ==========================================
  // 序列化方法
  // ==========================================

  /**
   * 转换为 DTO（用于持久化）
   *
   * @returns Worktree DTO
   */
  toDTO(): WorktreeDTO {
    return {
      path: this.path,
      branch: this.branch,
    };
  }

  /**
   * 获取摘要信息
   *
   * @returns Worktree 摘要字符串
   */
  getSummary(): string {
    return `Worktree [${this.branch}] at ${this.path}`;
  }
}
