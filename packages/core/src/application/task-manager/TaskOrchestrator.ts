/**
 * Task Orchestrator
 *
 * Coordinates the execution of PRD user stories.
 * Manages story execution flow, pause/resume capabilities, and AI tool integration.
 *
 * RESPONSIBILITIES:
 * - Story execution coordination
 * - Session management for AI agent conversations
 * - Progress tracking and reporting
 * - Acceptance criteria validation
 * - Execution state management (pause/resume/stop)
 *
 * DEPENDENCIES:
 * - task: ITask - Task entity being executed
 * - prd: IPRD - PRD containing user stories
 * - sessionManager: ISessionManager - AI agent session management
 * - progressTracker: IProgressTracker - Progress tracking
 * - uiNotifier: IUINotifier - UI notifications
 * - metricsCollector: IMetricsCollector - Metrics collection
 * - auditLogger: IAuditLogger - Audit logging
 * - eventBus: IEventBus - Event emission
 * - logger: ILogger - Logging
 *
 * PHASE 3 DEPENDENCY (not yet implemented):
 * - toolExecutorFactory: Factory for creating AI tool executors
 */

import type {
  ITask,
  IPRD,
  IStory,
  ISessionManager,
  IProgressTracker,
  IUINotifier,
  IMetricsCollector,
  IAuditLogger,
  IEventBus,
  ILogger,
  ITaskOrchestrator
} from "@talos/types";

/**
 * Tool Executor Interface (placeholder for Phase 3)
 * Will be implemented in Phase 3 to abstract AI tool execution (Claude, Cursor, etc.)
 */
interface IToolExecutor {
  execute(prompt: string): Promise<{ success: boolean; output?: string }>;
  stop(): Promise<void>;
}

/**
 * Tool Executor Factory Interface (placeholder for Phase 3)
 */
interface IToolExecutorFactory {
  getExecutor(tool: string): IToolExecutor;
}

/**
 * Task Orchestrator Options
 */
export interface TaskOrchestratorOptions {
  task: ITask;
  prd: IPRD;
  sessionManager: ISessionManager;
  progressTracker: IProgressTracker;
  uiNotifier: IUINotifier;
  metricsCollector: IMetricsCollector;
  auditLogger: IAuditLogger;
  eventBus: IEventBus;
  logger: ILogger;
  toolExecutorFactory?: IToolExecutorFactory;
}

/**
 * Execution State
 */
type ExecutionState = "idle" | "running" | "paused" | "stopped";

/**
 * Task Orchestrator Class
 */
export class TaskOrchestrator implements ITaskOrchestrator {
  private task: ITask;
  private prd: IPRD;
  private sessionManager: ISessionManager;
  private progressTracker: IProgressTracker;
  private uiNotifier: IUINotifier;
  private metricsCollector: IMetricsCollector;
  private auditLogger: IAuditLogger;
  private eventBus: IEventBus;
  private logger: ILogger;
  private toolExecutorFactory?: IToolExecutorFactory;

  private sessionId?: string;
  private executionState: ExecutionState = "idle";
  private currentToolExecutor?: IToolExecutor;
  private currentStory?: IStory;

  constructor(options: TaskOrchestratorOptions) {
    this.task = options.task;
    this.prd = options.prd;
    this.sessionManager = options.sessionManager;
    this.progressTracker = options.progressTracker;
    this.uiNotifier = options.uiNotifier;
    this.metricsCollector = options.metricsCollector;
    this.auditLogger = options.auditLogger;
    this.eventBus = options.eventBus;
    this.logger = options.logger;
    this.toolExecutorFactory = options.toolExecutorFactory;
  }

  /**
   * Start task orchestration
   *
   * Creates session and starts execution loop.
   */
  async start(): Promise<void> {
    this.logger.info(`Starting task orchestration for task ${this.task.id}`);

    // Create session for AI agent
    const session = await this.sessionManager.createSession(
      this.prd.id,
      this.task.role || "ralph-executor",
      []
    );
    this.sessionId = session.sessionId;

    this.logger.info(`Created session ${this.sessionId} for task ${this.task.id}`);

    // Update task state
    this.task.start();

    // Notify UI
    await this.uiNotifier.notifyProgress(this.task.id, 0, "Task started");

    // Log audit
    await this.auditLogger.logAction("task_orchestration_started", {
      taskId: this.task.id,
      prdId: this.prd.id,
      sessionId: this.sessionId
    });

    // Emit event
    this.eventBus.emit("task:started", {
      taskId: this.task.id,
      prdId: this.prd.id,
      timestamp: Date.now()
    });

    this.executionState = "running";
  }

  /**
   * Execute a user story
   *
   * @param prdId - PRD identifier
   * @param storyId - Story identifier to execute
   * @returns Execution result with success status and optional output
   */
  async executeStory(prdId: string, storyId: string): Promise<{ success: boolean; output?: string }> {
    if (this.executionState !== "running") {
      throw new Error(`Cannot execute story in ${this.executionState} state`);
    }

    if (prdId !== this.prd.id) {
      throw new Error(`PRD ID mismatch: expected ${this.prd.id}, got ${prdId}`);
    }

    // Get story from PRD
    const story = this.prd.getStory(storyId);
    if (!story) {
      throw new Error(`Story ${storyId} not found in PRD ${prdId}`);
    }

    this.currentStory = story;
    const startTime = Date.now();

    this.logger.info(`Executing story ${storyId}: ${story.title}`);
    await this.auditLogger.logAction("story_execution_started", {
      taskId: this.task.id,
      prdId,
      storyId,
      storyTitle: story.title
    });

    try {
      // Start story
      story.start();
      this.eventBus.emit("story:started", {
        storyId,
        storyTitle: story.title,
        prdId,
        timestamp: startTime
      });

      // Update progress
      await this.progressTracker.updateProgress(prdId, storyId, 0, "Starting story execution");
      await this.uiNotifier.notifyProgress(this.task.id, 0, `Executing: ${story.title}`);

      // Build prompt for AI executor
      const prompt = this.buildPrompt(story);

      // Get executor (if toolExecutorFactory is available)
      if (!this.toolExecutorFactory) {
        // Phase 3 not yet implemented - use placeholder
        this.logger.warn("Tool executor factory not available, skipping execution");
        return {
          success: false,
          output: "Tool executor factory not implemented (Phase 3)"
        };
      }

      this.currentToolExecutor = this.toolExecutorFactory.getExecutor("claude");

      // Execute story
      await this.progressTracker.updateProgress(prdId, storyId, 0.5, "Executing story");
      const result = await this.currentToolExecutor.execute(prompt);

      if (!result.success) {
        throw new Error(result.output || "Story execution failed");
      }

      // Validate acceptance criteria
      await this.progressTracker.updateProgress(prdId, storyId, 0.8, "Validating acceptance criteria");
      const acceptancePassed = await this.validateAcceptanceCriteria(story);

      if (acceptancePassed) {
        // Mark story as passing
        story.markAsPassing();
        await this.progressTracker.markStoryComplete(prdId, storyId, true);
        await this.metricsCollector.recordMetric("story_execution_time", Date.now() - startTime, {
          taskId: this.task.id,
          storyId,
          status: "completed"
        });

        this.logger.info(`Story ${storyId} completed successfully`);
        await this.auditLogger.logAction("story_completed", {
          taskId: this.task.id,
          prdId,
          storyId,
          duration: Date.now() - startTime
        });

        this.eventBus.emit("story:completed", {
          storyId,
          storyTitle: story.title,
          prdId,
          timestamp: Date.now(),
          duration: Date.now() - startTime
        });

        return { success: true, output: result.output };
      } else {
        // Mark story as failing
        story.markAsFailing("Acceptance criteria not met");
        await this.progressTracker.markStoryComplete(prdId, storyId, false, "Acceptance criteria not met");
        await this.metricsCollector.recordMetric("story_execution_time", Date.now() - startTime, {
          taskId: this.task.id,
          storyId,
          status: "failed"
        });

        this.logger.error(`Story ${storyId} failed acceptance criteria`);
        await this.auditLogger.logAction("story_failed", {
          taskId: this.task.id,
          prdId,
          storyId,
          reason: "Acceptance criteria not met"
        });

        this.eventBus.emit("story:failed", {
          storyId,
          storyTitle: story.title,
          prdId,
          timestamp: Date.now(),
          error: "Acceptance criteria not met"
        });

        return { success: false, output: "Acceptance criteria not met" };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Mark story as failing
      story.markAsFailing(errorMessage);
      await this.progressTracker.markStoryComplete(prdId, storyId, false, errorMessage);
      await this.uiNotifier.notifyError(this.task.id, errorMessage, { storyId });
      await this.metricsCollector.recordMetric("story_execution_time", Date.now() - startTime, {
        taskId: this.task.id,
        storyId,
        status: "error"
      });

      this.logger.error(`Story ${storyId} execution error: ${errorMessage}`);
      await this.auditLogger.logAction("story_failed", {
        taskId: this.task.id,
        prdId,
        storyId,
        error: errorMessage
      });

      this.eventBus.emit("story:failed", {
        storyId,
        storyTitle: story.title,
        prdId,
        timestamp: Date.now(),
        error: errorMessage
      });

      return { success: false, output: errorMessage };
    } finally {
      this.currentStory = undefined;
      this.currentToolExecutor = undefined;
    }
  }

  /**
   * Pause current execution
   *
   * Gracefully pauses ongoing story execution.
   * Allows resumption from the current state.
   */
  async pauseExecution(): Promise<void> {
    if (this.executionState !== "running") {
      throw new Error(`Cannot pause in ${this.executionState} state`);
    }

    this.logger.info(`Pausing execution for task ${this.task.id}`);

    // Stop current AI tool execution
    if (this.currentToolExecutor) {
      await this.currentToolExecutor.stop();
    }

    // Save execution state
    const pausedState = {
      taskId: this.task.id,
      sessionId: this.sessionId,
      currentStoryId: this.currentStory?.id,
      pausedAt: Date.now()
    };

    this.executionState = "paused";

    await this.auditLogger.logAction("task_paused", {
      taskId: this.task.id,
      sessionId: this.sessionId,
      currentStoryId: this.currentStory?.id
    });

    await this.uiNotifier.notifyProgress(this.task.id, 0, "Task paused");

    this.logger.info(`Task ${this.task.id} paused`, pausedState);
  }

  /**
   * Resume paused execution
   *
   * Continues execution from where it was paused.
   */
  async resumeExecution(): Promise<void> {
    if (this.executionState !== "paused") {
      throw new Error(`Cannot resume in ${this.executionState} state`);
    }

    this.logger.info(`Resuming execution for task ${this.task.id}`);

    this.executionState = "running";

    await this.auditLogger.logAction("task_resumed", {
      taskId: this.task.id,
      sessionId: this.sessionId
    });

    await this.uiNotifier.notifyProgress(this.task.id, 0, "Task resumed");

    this.logger.info(`Task ${this.task.id} resumed`);
  }

  /**
   * Stop task orchestration
   *
   * Stops AI tool execution, closes session, publishes 'task:stopped' event.
   */
  async stop(): Promise<void> {
    if (this.executionState === "stopped" || this.executionState === "idle") {
      return;
    }

    this.logger.info(`Stopping task orchestration for task ${this.task.id}`);

    // Stop current AI tool execution
    if (this.currentToolExecutor) {
      await this.currentToolExecutor.stop();
    }

    // Close session
    if (this.sessionId) {
      await this.sessionManager.closeSession(this.sessionId);
      this.logger.info(`Closed session ${this.sessionId}`);
    }

    // Update task state
    this.task.stop();

    // Notify UI
    await this.uiNotifier.notifyCompletion(this.task.id, false, { reason: "Task stopped" });

    // Log audit
    await this.auditLogger.logAction("task_orchestration_stopped", {
      taskId: this.task.id,
      sessionId: this.sessionId
    });

    // Emit event
    this.eventBus.emit("task:stopped", {
      taskId: this.task.id,
      prdId: this.prd.id,
      timestamp: Date.now()
    });

    this.executionState = "stopped";

    this.logger.info(`Task ${this.task.id} orchestration stopped`);
  }

  /**
   * Build prompt for AI executor
   *
   * Creates a comprehensive prompt from story details.
   */
  private buildPrompt(story: IStory): string {
    const promptParts = [
      `# User Story: ${story.id} - ${story.title}`,
      "",
      `## Description`,
      story.description,
      "",
      `## Acceptance Criteria`,
      ...story.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`),
      "",
      `## Context`,
      `- PRD: ${this.prd.id} - ${this.prd.project}`,
      `- Task: ${this.task.id}`,
      `- Priority: ${story.priority}`,
      story.dependsOn && story.dependsOn.length > 0 ? `- Dependencies: ${story.dependsOn.join(", ")}` : "",
      "",
      `## Instructions`,
      "1. Implement the story according to the acceptance criteria",
      "2. Follow the project's coding standards and patterns",
      "3. Run tests to ensure quality",
      "4. Commit changes with descriptive commit messages",
      "5. Report progress and any issues encountered"
    ];

    return promptParts.filter(Boolean).join("\n");
  }

  /**
   * Validate acceptance criteria
   *
   * Runs tests and code checks to validate story completion.
   */
  private async validateAcceptanceCriteria(story: IStory): Promise<boolean> {
    this.logger.info(`Validating acceptance criteria for story ${story.id}`);

    try {
      // Phase 3: Implement actual validation logic
      // For now, return true as placeholder
      // In Phase 3, this will:
      // - Run tests (if applicable)
      // - Run lint/typecheck
      // - Verify code quality
      // - Check that acceptance criteria are met

      this.logger.warn("Acceptance criteria validation not yet implemented (Phase 3)");
      return true;
    } catch (error) {
      this.logger.error(`Acceptance criteria validation error: ${error}`);
      return false;
    }
  }

  /**
   * Get current execution state
   */
  getExecutionState(): ExecutionState {
    return this.executionState;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Get current story being executed
   */
  getCurrentStory(): IStory | undefined {
    return this.currentStory;
  }
}
