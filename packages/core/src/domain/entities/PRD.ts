/**
 * PRD - Rich Domain Model for Product Requirements Document
 *
 * Implements the Entity pattern from Domain-Driven Design.
 * Encapsulates PRD business logic for story management and progress tracking.
 *
 * RELATIONSHIP:
 * - PRD contains multiple User Stories
 * - PRD is associated with a Git branch
 * - PRD execution creates Tasks for each story
 *
 * @example
 * ```typescript
 * const prd = PRD.create({
 *   id: 'prd-001',
 *   project: 'Talos',
 *   description: 'Complete system refactor',
 *   branchName: 'feature/refactor',
 *   userStories: [story1, story2]
 * });
 *
 * const nextStory = prd.getNextStory(completedStories);
 * prd.addStory(newStory);
 * console.log(prd.getCompletionPercentage()); // 50.0
 * ```
 */

import type {
  IPRD,
  IStory,
  PRDStatus,
} from "@talos/types";
import { Story } from "./Story";

/**
 * PRD entity properties
 * PRD 实体属性
 */
export interface PRDProperties {
  id: string;
  project: string;
  description: string;
  branchName?: string;
  userStories?: IStory[];
  status?: PRDStatus;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * PRD DTO for serialization
 * PRD DTO 用于序列化
 */
export interface PRDDTO {
  id: string;
  project: string;
  description: string;
  branchName?: string;
  userStories: IStory[];
  status: PRDStatus;
  createdAt: number;
  updatedAt?: number;
}

/**
 * PRD Entity - Rich domain model for PRD management
 * PRD 实体 - PRD 管理的富领域模型
 */
export class PRD implements IPRD {
  readonly id: string;
  readonly project: string;
  readonly description: string;
  readonly branchName?: string;
  userStories: IStory[];
  readonly createdAt: number;
  updatedAt?: number;
  status: PRDStatus;

  /**
   * Create a new PRD instance
   * 创建新的 PRD 实例
   *
   * @param props - PRD properties (PRD 属性)
   * @returns PRD entity (PRD 实体)
   */
  static create(props: PRDProperties): PRD {
    return new PRD(props);
  }

  /**
   * Create PRD from DTO
   * 从 DTO 创建 PRD
   *
   * @param dto - PRD DTO (PRD DTO)
   * @returns PRD entity (PRD 实体)
   */
  static fromDTO(dto: PRDDTO): PRD {
    return new PRD(dto);
  }

  private constructor(props: PRDProperties) {
    this.id = props.id;
    this.project = props.project;
    this.description = props.description;
    this.branchName = props.branchName;
    this.userStories = props.userStories || [];
    this.status = props.status ?? "draft";
    this.createdAt = props.createdAt ?? Date.now();
    this.updatedAt = props.updatedAt;
  }

  // ============================================
  // Domain Methods
  // ============================================

  /**
   * Get all completed stories
   * 获取所有已完成的用户故事
   *
   * @returns Array of completed stories (已完成的用户故事数组)
   */
  getCompletedStories(): IStory[] {
    return this.userStories.filter(story => story.passes);
  }

  /**
   * Get all pending stories
   * 获取所有待处理的用户故事
   *
   * @returns Array of pending stories (待处理的用户故事数组)
   */
  getPendingStories(): IStory[] {
    return this.userStories.filter(story => !story.passes);
  }

  /**
   * Get story by ID
   * 根据 ID 获取用户故事
   *
   * @param storyId - Story identifier (用户故事标识符)
   * @returns Story or undefined if not found (用户故事或未找到时返回 undefined)
   */
  getStory(storyId: string): IStory | undefined {
    return this.userStories.find(story => story.id === storyId);
  }

  /**
   * Get stories sorted by priority (lowest number = highest priority)
   * 按优先级获取用户故事（数字越小优先级越高）
   *
   * @returns Array of stories sorted by priority (按优先级排序的用户故事数组)
   */
  getStoriesByPriority(): IStory[] {
    return [...this.userStories].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get next story to work on (highest priority, dependencies met)
   * 获取下一个要处理的用户故事（最高优先级，依赖已满足）
   *
   * @param completedStories - Set of completed story IDs (已完成的用户故事 ID 集合)
   * @returns Next story or undefined if no eligible story (下一个用户故事或无符合条件的用户故事时返回 undefined)
   */
  getNextStory(completedStories: Set<string>): IStory | undefined {
    const pendingStories = this.getPendingStories();
    const eligibleStories = pendingStories.filter(story =>
      story.canStart(completedStories)
    );

    if (eligibleStories.length === 0) {
      return undefined;
    }

    // Return story with highest priority (lowest priority number)
    return eligibleStories.reduce((highest, current) =>
      current.priority < highest.priority ? current : highest
    );
  }

  /**
   * Calculate completion percentage
   * 计算完成百分比
   *
   * @returns Completion percentage (0-100) (完成百分比 0-100)
   */
  getCompletionPercentage(): number {
    if (this.userStories.length === 0) {
      return 0;
    }
    const completed = this.getCompletedStories().length;
    return Math.round((completed / this.userStories.length) * 100);
  }

  /**
   * Check if all stories are completed
   * 检查所有用户故事是否已完成
   *
   * @returns true if all stories are completed (如果所有用户故事已完成则返回 true)
   */
  isComplete(): boolean {
    return this.userStories.length > 0 &&
           this.userStories.every(story => story.passes);
  }

  /**
   * Add a user story to the PRD
   * 向 PRD 添加用户故事
   *
   * @param story - Story to add (要添加的用户故事)
   */
  addStory(story: IStory): void {
    // Check if story with same ID already exists
    if (this.userStories.some(s => s.id === story.id)) {
      throw new Error(`Story with ID '${story.id}' already exists in PRD '${this.id}'`);
    }
    this.userStories.push(story);
    this.updatedAt = Date.now();
  }

  /**
   * Update a user story
   * 更新用户故事
   *
   * @param storyId - Story ID to update (要更新的用户故事 ID)
   * @param updates - Fields to update (要更新的字段)
   */
  updateStory(storyId: string, updates: Partial<IStory>): void {
    const story = this.getStory(storyId);
    if (!story) {
      throw new Error(`Story with ID '${storyId}' not found in PRD '${this.id}'`);
    }

    // Update the story properties
    Object.assign(story, updates);
    this.updatedAt = Date.now();
  }

  /**
   * Mark PRD as completed
   * 标记 PRD 为已完成
   */
  markAsCompleted(): void {
    this.status = "completed";
    this.updatedAt = Date.now();
  }

  /**
   * Mark PRD as started
   * 标记 PRD 为已开始
   */
  markAsStarted(): void {
    this.status = "active";
    this.updatedAt = Date.now();
  }

  // ============================================
  // Business Methods
  // ============================================

  /**
   * Get progress summary
   * 获取进度摘要
   *
   * @returns Progress summary object (进度摘要对象)
   */
  getProgress(): {
    total: number;
    passing: number;
    incomplete: number;
    percentage: number;
  } {
    const total = this.userStories.length;
    const passing = this.getCompletedStories().length;
    const incomplete = total - passing;
    const percentage = this.getCompletionPercentage();

    return { total, passing, incomplete, percentage };
  }

  /**
   * Convert PRD to DTO for serialization
   * 将 PRD 转换为 DTO 用于序列化
   *
   * @returns PRD DTO (PRD DTO)
   */
  toDTO(): PRDDTO {
    return {
      id: this.id,
      project: this.project,
      description: this.description,
      branchName: this.branchName,
      userStories: [...this.userStories],
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
