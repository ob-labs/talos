/**
 * Workspace - Rich Domain Model for Workspace (Git Repository Level)
 *
 * Implements the Entity pattern from Domain-Driven Design.
 * Encapsulates workspace business logic for worktree and terminal management.
 *
 * RELATIONSHIP:
 * - Workspace contains Worktrees (Git branches)
 * - Workspace level configuration and metadata
 *
 * @example
 * ```typescript
 * const workspace = Workspace.create({
 *   id: 'ws-123',
 *   name: 'talos-project',
 *   path: '/Users/dev/projects/talos',
 *   branch: 'main',
 *   worktrees: ['wt-1', 'wt-2'],
 *   terminals: [],
 *   expanded: false
 * });
 *
 * workspace.addWorktree('wt-3');
 * console.log(workspace.hasWorktree('wt-3')); // true
 * ```
 */

import type {
  IWorkspace,
  TerminalSession,
} from "@talos/types";

/**
 * Workspace entity properties
 * 工作区实体属性
 */
export interface WorkspaceProperties {
  id: string;
  name: string;
  path: string;
  branch: string;
  worktrees?: string[];
  terminals?: TerminalSession[];
  expanded?: boolean;
}

/**
 * Workspace DTO for serialization
 * 工作区 DTO 用于序列化
 */
export interface WorkspaceDTO extends Required<WorkspaceProperties> {
  createdAt: number;
}

/**
 * Workspace Entity - Rich domain model for Git repository management
 * 工作区实体 - Git 仓库管理的富领域模型
 */
export class Workspace implements IWorkspace {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly branch: string;
  worktrees: string[];
  terminals: TerminalSession[];
  expanded: boolean;

  /**
   * Workspace creation timestamp
   * 工作区创建时间戳
   */
  readonly createdAt: number;

  /**
   * Create a new Workspace instance
   * 创建新的 Workspace 实例
   *
   * @param props - Workspace properties (工作区属性)
   * @returns Workspace entity (工作区实体)
   */
  static create(props: WorkspaceProperties): Workspace {
    return new Workspace(props);
  }

  /**
   * Create Workspace from DTO
   * 从 DTO 创建工作区
   *
   * @param dto - Workspace DTO (工作区 DTO)
   * @returns Workspace entity (工作区实体)
   */
  static fromDTO(dto: WorkspaceDTO): Workspace {
    return new Workspace({
      id: dto.id,
      name: dto.name,
      path: dto.path,
      branch: dto.branch,
      worktrees: dto.worktrees,
      terminals: dto.terminals,
      expanded: dto.expanded,
    }, dto.createdAt);
  }

  private constructor(props: WorkspaceProperties, createdAt?: number) {
    this.id = props.id;
    this.name = props.name;
    this.path = props.path;
    this.branch = props.branch;
    this.worktrees = props.worktrees || [];
    this.terminals = props.terminals || [];
    this.expanded = props.expanded ?? false;
    this.createdAt = createdAt || Date.now();
  }

  // ============================================
  // Domain Methods
  // ============================================

  /**
   * Add a worktree to this workspace
   * 向此工作区添加工作树
   *
   * @param worktreeId - Worktree ID to add (要添加的工作树 ID)
   */
  addWorktree(worktreeId: string): void {
    if (!this.worktrees.includes(worktreeId)) {
      this.worktrees.push(worktreeId);
    }
  }

  /**
   * Remove a worktree from this workspace
   * 从此工作区移除工作树
   *
   * @param worktreeId - Worktree ID to remove (要移除的工作树 ID)
   */
  removeWorktree(worktreeId: string): void {
    this.worktrees = this.worktrees.filter(id => id !== worktreeId);
  }

  /**
   * Check if workspace contains a specific worktree
   * 检查工作区是否包含特定工作树
   *
   * @param worktreeId - Worktree ID to check (要检查的工作树 ID)
   * @returns true if worktree exists (如果工作树存在则返回 true)
   */
  hasWorktree(worktreeId: string): boolean {
    return this.worktrees.includes(worktreeId);
  }

  // ============================================
  // Path Matching Methods (新增 - 替代 ConfigManager)
  // ============================================

  /**
   * 检查路径是否属于此 workspace
   *
   * 匹配规则：
   * - 精确匹配：path === workspace.path
   * - Worktree 匹配：path 以 workspace/worktrees/ 开头
   *
   * 此方法替代了 ConfigManager 中的路径匹配逻辑
   *
   * @param path - 要检查的路径
   * @returns true 如果路径属于此 workspace
   *
   * @example
   * ```typescript
   * const workspace = Workspace.create({
   *   id: 'ws-123',
   *   name: 'talos',
   *   path: '/Users/user/project'
   * });
   *
   * workspace.containsPath('/Users/user/project');          // true
   * workspace.containsPath('/Users/user/project/worktrees/wt-1');  // true
   * workspace.containsPath('/other/path');                  // false
   * ```
   */
  containsPath(path: string): boolean {
    if (this.path === path) return true;
    if (path.startsWith(`${this.path}/worktrees/`)) return true;
    return false;
  }

  /**
   * 从路径中提取 worktree ID（如果是 worktree 路径）
   *
   * @param path - 要解析的路径
   * @returns worktree ID 或 null（如果不是 worktree 路径）
   *
   * @example
   * ```typescript
   * workspace.extractWorktreeId('/Users/user/project');           // null
   * workspace.extractWorktreeId('/Users/user/project/worktrees/wt-1');  // 'wt-1'
   * workspace.extractWorktreeId('/Users/user/project/worktrees/wt-1/nested/file');  // 'wt-1'
   * ```
   */
  extractWorktreeId(path: string): string | null {
    if (!this.containsPath(path)) return null;
    if (path === this.path) return null;

    // 匹配 /worktrees/{worktreeId} 或 /worktrees/{worktreeId}/...
    const match = path.match(/\/worktrees\/([^/]+)(?:\/|$)/);
    return match ? match[1] : null;
  }

  /**
   * 获取 worktree 路径
   *
   * @param worktreeId - Worktree ID
   * @returns Worktree 完整路径
   *
   * @example
   * ```typescript
   * workspace.getWorktreePath('wt-1');  // '/Users/user/project/worktrees/wt-1'
   * ```
   */
  getWorktreePath(worktreeId: string): string {
    return `${this.path}/worktrees/${worktreeId}`;
  }

  /**
   * 获取 repo root（始终是 workspace.path）
   *
   * 此方法提供统一的访问接口，未来如果路径结构改变，只需修改此方法
   *
   * @returns 仓库根目录路径
   */
  getRepoRoot(): string {
    return this.path;
  }

  /**
   * 判断路径是否为 workspace 根目录
   *
   * @param path - 要检查的路径
   * @returns true 如果是 workspace 根目录
   */
  isWorkspaceRoot(path: string): boolean {
    return this.path === path;
  }

  /**
   * 判断路径是否为 worktree 路径
   *
   * @param path - 要检查的路径
   * @returns true 如果是 worktree 路径
   */
  isWorktreePath(path: string): boolean {
    return path.startsWith(`${this.path}/worktrees/`);
  }

  // ============================================
  // Terminal Session Management
  // ============================================

  /**
   * Add terminal session to history
   * 向历史记录添加终端会话
   *
   * @param terminal - Terminal session to add (要添加的终端会话)
   */
  addTerminal(terminal: TerminalSession): void {
    this.terminals.push(terminal);
  }

  /**
   * Get all terminal sessions
   * 获取所有终端会话
   *
   * @returns Array of terminal sessions (终端会话数组)
   */
  getTerminals(): TerminalSession[] {
    return [...this.terminals]; // Return copy to prevent mutation
  }

  /**
   * Clear terminal session history
   * 清除终端会话历史记录
   */
  clearTerminals(): void {
    this.terminals = [];
  }

  /**
   * Toggle expanded state
   * 切换展开状态
   */
  toggleExpanded(): void {
    this.expanded = !this.expanded;
  }

  // ============================================
  // Business Methods
  // ============================================

  /**
   * Check if workspace is valid (path exists and is accessible)
   * 检查工作区是否有效（路径存在且可访问）
   *
   * Note: This is a simple validation. In production, you might want to
   * check if the path is a valid Git repository.
   *
   * @returns true if workspace configuration is valid (如果工作区配置有效则返回 true)
   */
  isValid(): boolean {
    return (
      this.id.length > 0 &&
      this.name.length > 0 &&
      this.path.length > 0 &&
      this.branch.length > 0
    );
  }

  /**
   * Get the .git/worktrees path for a specific worktree ID
   * 获取特定工作树 ID 的 .git/worktrees 路径
   *
   * @param worktreeId - Worktree ID (工作树 ID)
   * @returns .git/worktrees path (.git/worktrees 路径)
   */
  getGitWorktreePath(worktreeId: string): string {
    // Worktrees are typically stored in .git/worktrees/<worktree-id>
    // The actual path depends on Git worktree configuration
    return `${this.path}/.git/worktrees/${worktreeId}`;
  }

  /**
   * Convert workspace to DTO for serialization
   * 将工作区转换为 DTO 用于序列化
   *
   * @returns Workspace DTO (工作区 DTO)
   */
  toDTO(): WorkspaceDTO {
    return {
      id: this.id,
      name: this.name,
      path: this.path,
      branch: this.branch,
      worktrees: [...this.worktrees],
      terminals: [...this.terminals],
      expanded: this.expanded,
      createdAt: this.createdAt,
    };
  }
}
