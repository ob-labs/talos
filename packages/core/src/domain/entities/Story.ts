/**
 * Story - Rich Domain Model for User Story from PRD
 *
 * Implements the Entity pattern from Domain-Driven Design.
 * Encapsulates story state transition logic with dependency validation.
 *
 * RELATIONSHIP:
 * - Story belongs to a PRD
 * - Story execution creates Tasks
 * - Stories have acceptance criteria that must be met
 *
 * @example
 * ```typescript
 * const story = Story.create({
 *   id: 'US-001',
 *   title: 'Implement feature X',
 *   description: 'As a user, I want feature X...',
 *   acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
 *   priority: 1,
 *   dependsOn: ['US-000']
 * });
 *
 * story.start(); // pending → in_progress
 * story.markAsPassing(); // in_progress → completed
 * ```
 */

import type {
  IStory,
  StoryStatus,
  StoryResult,
} from "@talos/types";

/**
 * Story entity properties
 * 用户故事实体属性
 */
export interface StoryProperties {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  passes?: boolean;
  notes?: string;
  dependsOn?: string[];
  status?: StoryStatus;
  createdAt?: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Story DTO for serialization
 * 用户故事 DTO 用于序列化
 */
export interface StoryDTO {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  passes: boolean;
  notes: string;
  dependsOn: string[];
  status: StoryStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Story Entity - Rich domain model with state transition logic
 * 用户故事实体 - 带有状态转换逻辑的富领域模型
 */
export class Story implements IStory {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly acceptanceCriteria: string[];
  readonly priority: number;
  passes: boolean;
  notes: string;
  readonly dependsOn: string[];
  status: StoryStatus;
  readonly createdAt: number;
  startedAt?: number;
  completedAt?: number;

  /**
   * Create a new Story instance
   * 创建新的 Story 实例
   *
   * @param props - Story properties (用户故事属性)
   * @returns Story entity (用户故事实体)
   */
  static create(props: StoryProperties): Story {
    return new Story(props);
  }

  /**
   * Create Story from DTO
   * 从 DTO 创建用户故事
   *
   * @param dto - Story DTO (用户故事 DTO)
   * @returns Story entity (用户故事实体)
   */
  static fromDTO(dto: StoryDTO): Story {
    return new Story(dto);
  }

  private constructor(props: StoryProperties) {
    this.id = props.id;
    this.title = props.title;
    this.description = props.description;
    this.acceptanceCriteria = props.acceptanceCriteria;
    this.priority = props.priority;
    this.passes = props.passes ?? false;
    this.notes = props.notes ?? "";
    this.dependsOn = props.dependsOn ?? [];
    this.status = props.status ?? "pending";
    this.createdAt = props.createdAt ?? Date.now();
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
  }

  // ============================================
  // State Transition Methods (Domain Logic)
  // ============================================

  /**
   * Start story execution (pending/ready → in_progress)
   * 开始执行用户故事 (pending/ready → in_progress)
   *
   * @throws Error if dependencies are not met or story is not in a valid state
   */
  start(): void {
    if (this.status !== "pending" && this.status !== "ready") {
      throw new Error(
        `Cannot start story from status '${this.status}'. Story must be in 'pending' or 'ready' state.`
      );
    }
    this.status = "in_progress";
    this.startedAt = Date.now();
  }

  /**
   * Mark story as passing (in_progress → completed)
   * 标记用户故事为通过 (in_progress → completed)
   *
   * @throws Error if story has unmet dependencies
   */
  markAsPassing(): void {
    if (this.status !== "in_progress") {
      throw new Error(
        `Cannot mark story as passing from status '${this.status}'. Story must be in 'in_progress' state.`
      );
    }
    this.passes = true;
    this.status = "completed";
    this.completedAt = Date.now();
  }

  /**
   * Mark story as failing (any state → failed)
   * 标记用户故事为失败 (any state → failed)
   *
   * Unlike other state transitions, this can be called from any state.
   *
   * @param reason - Reason for failure (失败原因)
   */
  markAsFailing(reason: string): void {
    this.passes = false;
    this.status = "failed";
    this.completedAt = Date.now();
    this.notes = this.notes ? `${this.notes}\n\nFailure: ${reason}` : `Failure: ${reason}`;
  }

  /**
   * Check if all dependencies are satisfied
   * 检查所有依赖是否已满足
   *
   * @param completedStories - Set of completed story IDs (已完成的用户故事 ID 集合)
   * @returns true if all dependencies are met (如果所有依赖都已满足则返回 true)
   */
  areDependenciesSatisfied(completedStories: Set<string>): boolean {
    if (this.dependsOn.length === 0) {
      return true;
    }
    return this.dependsOn.every(depId => completedStories.has(depId));
  }

  /**
   * Add note to story
   * 向用户故事添加注释
   *
   * @param note - Note content (注释内容)
   */
  addNote(note: string): void {
    if (this.notes) {
      this.notes = `${this.notes}\n\n${note}`;
    } else {
      this.notes = note;
    }
  }

  /**
   * Get story duration in seconds
   * 获取用户故事持续时间（秒）
   *
   * @returns Duration in seconds, or undefined if story hasn't completed
   */
  getDuration(): number | undefined {
    if (!this.completedAt) {
      return undefined;
    }
    const startTime = this.startedAt || this.createdAt;
    return Math.floor((this.completedAt - startTime) / 1000);
  }

  /**
   * Check if story can be started
   * 检查用户故事是否可以开始
   *
   * @param completedStories - Set of completed story IDs (已完成的用户故事 ID 集合)
   * @returns true if story can be started (如果用户故事可以开始则返回 true)
   */
  canStart(completedStories: Set<string>): boolean {
    return (
      (this.status === "pending" || this.status === "ready") &&
      this.areDependenciesSatisfied(completedStories)
    );
  }

  // ============================================
  // Business Methods
  // ============================================

  /**
   * Add task to story's task list
   * 向用户故事的任务列表添加任务
   *
   * Note: This is a placeholder for future functionality.
   * The actual task management will be implemented in a future story.
   *
   * @param taskId - Task ID to add (要添加的任务 ID)
   */
  addTask(taskId: string): void {
    // Placeholder for task management
    // This will be implemented when we add task tracking to stories
  }

  /**
   * Update story progress
   * 更新用户故事进度
   *
   * Note: This is a placeholder for future functionality.
   * The actual progress tracking will be implemented in a future story.
   *
   * @param progress - Progress value (进度值)
   */
  updateProgress(progress: number): void {
    // Placeholder for progress tracking
    // This will be implemented when we add progress tracking to stories
  }

  /**
   * Convert story to DTO for serialization
   * 将用户故事转换为 DTO 用于序列化
   *
   * @returns Story DTO (用户故事 DTO)
   */
  toDTO(): StoryDTO {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      acceptanceCriteria: [...this.acceptanceCriteria],
      priority: this.priority,
      passes: this.passes,
      notes: this.notes,
      dependsOn: [...this.dependsOn],
      status: this.status,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
    };
  }

  /**
   * Convert story to StoryResult
   * 将用户故事转换为 StoryResult
   *
   * @returns Story result (用户故事结果)
   */
  toResult(): StoryResult {
    return {
      storyId: this.id,
      storyTitle: this.title,
      status: this.status,
      duration: this.getDuration(),
      error: this.status === "failed" ? this.notes : undefined,
    };
  }
}
