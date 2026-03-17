import { TaskType, ModelProvider } from '@talos/types';

/**
 * Available model providers
 */
export const MODEL_PROVIDERS: ModelProvider[] = ["claude", "glm", "qwen", "openai"];

/**
 * Model capability score matrix
 * Scores range from 0-100, higher is better
 * Based on model capabilities for different task types
 */
export const MODEL_CAPABILITY_MATRIX: Record<
  ModelProvider,
  Record<TaskType, number>
> = {
  claude: {
    [TaskType.CODING]: 95,
    [TaskType.REVIEW]: 98,
    [TaskType.TRANSLATION]: 90,
    [TaskType.ANALYSIS]: 95,
    [TaskType.REFACTORING]: 92,
    [TaskType.DEBUGGING]: 93,
    [TaskType.DOCUMENTATION]: 95,
    [TaskType.TESTING]: 90,
  },
  glm: {
    [TaskType.CODING]: 75,
    [TaskType.REVIEW]: 80,
    [TaskType.TRANSLATION]: 95,
    [TaskType.ANALYSIS]: 85,
    [TaskType.REFACTORING]: 78,
    [TaskType.DEBUGGING]: 72,
    [TaskType.DOCUMENTATION]: 88,
    [TaskType.TESTING]: 70,
  },
  qwen: {
    [TaskType.CODING]: 82,
    [TaskType.REVIEW]: 85,
    [TaskType.TRANSLATION]: 85,
    [TaskType.ANALYSIS]: 88,
    [TaskType.REFACTORING]: 80,
    [TaskType.DEBUGGING]: 78,
    [TaskType.DOCUMENTATION]: 80,
    [TaskType.TESTING]: 75,
  },
  openai: {
    [TaskType.CODING]: 90,
    [TaskType.REVIEW]: 92,
    [TaskType.TRANSLATION]: 88,
    [TaskType.ANALYSIS]: 90,
    [TaskType.REFACTORING]: 88,
    [TaskType.DEBUGGING]: 85,
    [TaskType.DOCUMENTATION]: 85,
    [TaskType.TESTING]: 85,
  },
};

/**
 * Keyword patterns for automatic task classification
 */
const TASK_KEYWORDS: Record<TaskType, string[]> = {
  [TaskType.CODING]: [
    "implement",
    "create",
    "build",
    "develop",
    "write code",
    "add feature",
    "functionality",
  ],
  [TaskType.REVIEW]: [
    "review",
    "audit",
    "check",
    "verify",
    "inspect",
    "validate",
  ],
  [TaskType.TRANSLATION]: [
    "translate",
    "convert",
    "localize",
    "i18n",
    "internationalization",
  ],
  [TaskType.ANALYSIS]: [
    "analyze",
    "investigate",
    "research",
    "explore",
    "understand",
    "examine",
  ],
  [TaskType.REFACTORING]: [
    "refactor",
    "restructure",
    "reorganize",
    "clean up",
    "optimize code",
    "improve structure",
  ],
  [TaskType.DEBUGGING]: [
    "debug",
    "fix",
    "bug",
    "error",
    "issue",
    "resolve",
    "troubleshoot",
  ],
  [TaskType.DOCUMENTATION]: [
    "document",
    "readme",
    "comment",
    "docstring",
    "documentation",
  ],
  [TaskType.TESTING]: [
    "test",
    "unit test",
    "integration test",
    "test case",
    "coverage",
    "spec",
  ],
};

/**
 * Model selection result
 */
export interface ModelSelection {
  provider: ModelProvider;
  model: string;
  taskType: TaskType;
  score: number;
  reason: string;
}

/**
 * Model router options
 */
export interface ModelRouterOptions {
  manualModel?: ModelProvider;
  enabledModels?: ModelProvider[];
}

/**
 * Logger interface for dependency injection
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Default console logger
 */
const defaultLogger: Logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(`[ModelRouter] ${message}`, meta ? JSON.stringify(meta) : "");
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(`[ModelRouter] ${message}`, meta ? JSON.stringify(meta) : "");
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(`[ModelRouter] ${message}`, meta ? JSON.stringify(meta) : "");
  },
};

/**
 * Model Router class for intelligent model selection
 */
export class ModelRouter {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || defaultLogger;
  }

  /**
   * Classify task type from description using keyword matching
   */
  classifyTask(description: string): TaskType {
    const normalizedDesc = description.toLowerCase();

    // Count keyword matches for each task type
    const scores: Record<TaskType, number> = {
      [TaskType.CODING]: 0,
      [TaskType.REVIEW]: 0,
      [TaskType.TRANSLATION]: 0,
      [TaskType.ANALYSIS]: 0,
      [TaskType.REFACTORING]: 0,
      [TaskType.DEBUGGING]: 0,
      [TaskType.DOCUMENTATION]: 0,
      [TaskType.TESTING]: 0,
    };

    for (const [taskType, keywords] of Object.entries(TASK_KEYWORDS)) {
      for (const keyword of keywords) {
        if (normalizedDesc.includes(keyword)) {
          scores[taskType as TaskType]++;
        }
      }
    }

    // Find task type with highest score
    let maxScore = 0;
    let selectedType = TaskType.ANALYSIS; // Default to analysis

    for (const [taskType, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        selectedType = taskType as TaskType;
      }
    }

    // If no keywords matched, default to CODING for development tasks
    if (maxScore === 0) {
      selectedType = TaskType.CODING;
    }

    return selectedType;
  }

  /**
   * Select the best model for a given task
   */
  selectBestModel(
    description: string,
    model: string,
    options: ModelRouterOptions = {}
  ): ModelSelection {
    const { manualModel, enabledModels = MODEL_PROVIDERS } = options;

    // Classify the task type
    const taskType = this.classifyTask(description);

    // If manual model is specified and enabled, use it
    if (manualModel && enabledModels.includes(manualModel)) {
      const selection: ModelSelection = {
        provider: manualModel,
        model,
        taskType,
        score: MODEL_CAPABILITY_MATRIX[manualModel][taskType],
        reason: "Manual override",
      };
      this.logSelection(selection);
      return selection;
    }

    // Find the best model among enabled ones
    let bestProvider: ModelProvider = enabledModels[0];
    let bestScore = 0;

    for (const provider of enabledModels) {
      const score = MODEL_CAPABILITY_MATRIX[provider][taskType];
      if (score > bestScore) {
        bestScore = score;
        bestProvider = provider;
      }
    }

    const selection: ModelSelection = {
      provider: bestProvider,
      model,
      taskType,
      score: bestScore,
      reason: `Best fit for ${taskType} task`,
    };

    this.logSelection(selection);
    return selection;
  }

  /**
   * Get capability score for a specific model and task type
   */
  getCapabilityScore(provider: ModelProvider, taskType: TaskType): number {
    return MODEL_CAPABILITY_MATRIX[provider][taskType];
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): ModelProvider[] {
    return [...MODEL_PROVIDERS];
  }

  /**
   * Log model selection decision
   */
  private logSelection(selection: ModelSelection): void {
    this.logger.info("Model selected", {
      provider: selection.provider,
      model: selection.model,
      taskType: selection.taskType,
      score: selection.score,
      reason: selection.reason,
    });
  }
}

// Export default instance
export const modelRouter = new ModelRouter();
