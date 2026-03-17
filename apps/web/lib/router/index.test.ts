import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ModelRouter,
  MODEL_CAPABILITY_MATRIX,
  modelRouter,
} from "./index";
import { TaskType, ModelProvider } from '@talos/types';

describe("ModelRouter", () => {
  let router: ModelRouter;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    router = new ModelRouter(mockLogger);
  });

  describe("classifyTask", () => {
    it("should classify coding tasks", () => {
      expect(router.classifyTask("Implement a new feature")).toBe(
        TaskType.CODING
      );
      expect(router.classifyTask("Create a user interface")).toBe(
        TaskType.CODING
      );
      expect(router.classifyTask("Build an API endpoint")).toBe(
        TaskType.CODING
      );
    });

    it("should classify review tasks", () => {
      expect(router.classifyTask("Review the code changes")).toBe(
        TaskType.REVIEW
      );
      expect(router.classifyTask("Validate the code quality")).toBe(
        TaskType.REVIEW
      );
      expect(router.classifyTask("Inspect the changes")).toBe(
        TaskType.REVIEW
      );
    });

    it("should classify debugging tasks", () => {
      expect(router.classifyTask("Fix the bug in authentication")).toBe(
        TaskType.DEBUGGING
      );
      expect(router.classifyTask("Debug the memory leak")).toBe(
        TaskType.DEBUGGING
      );
      expect(router.classifyTask("Resolve the error in production")).toBe(
        TaskType.DEBUGGING
      );
    });

    it("should classify refactoring tasks", () => {
      expect(router.classifyTask("Refactor the user service")).toBe(
        TaskType.REFACTORING
      );
      expect(router.classifyTask("Clean up the codebase")).toBe(
        TaskType.REFACTORING
      );
      expect(router.classifyTask("Optimize code structure")).toBe(
        TaskType.REFACTORING
      );
    });

    it("should classify analysis tasks", () => {
      expect(router.classifyTask("Analyze the requirements")).toBe(
        TaskType.ANALYSIS
      );
      expect(router.classifyTask("Investigate the performance issue")).toBe(
        TaskType.ANALYSIS
      );
      expect(router.classifyTask("Research the best approach")).toBe(
        TaskType.ANALYSIS
      );
    });

    it("should classify testing tasks", () => {
      expect(router.classifyTask("Write unit tests for the module")).toBe(
        TaskType.TESTING
      );
      expect(router.classifyTask("Add integration test coverage")).toBe(
        TaskType.TESTING
      );
      expect(router.classifyTask("Test the API endpoints")).toBe(
        TaskType.TESTING
      );
    });

    it("should classify documentation tasks", () => {
      expect(router.classifyTask("Document the API usage")).toBe(
        TaskType.DOCUMENTATION
      );
      expect(router.classifyTask("Write README for the project")).toBe(
        TaskType.DOCUMENTATION
      );
      expect(router.classifyTask("Add code comments")).toBe(
        TaskType.DOCUMENTATION
      );
    });

    it("should classify translation tasks", () => {
      expect(router.classifyTask("Translate the UI to Spanish")).toBe(
        TaskType.TRANSLATION
      );
      expect(router.classifyTask("Convert to i18n format")).toBe(
        TaskType.TRANSLATION
      );
      expect(router.classifyTask("Localize the application")).toBe(
        TaskType.TRANSLATION
      );
    });

    it("should default to CODING when no keywords match", () => {
      expect(router.classifyTask("Do something random")).toBe(
        TaskType.CODING
      );
    });

    it("should handle case-insensitive matching", () => {
      expect(router.classifyTask("IMPLEMENT THE FEATURE")).toBe(
        TaskType.CODING
      );
      expect(router.classifyTask("Fix The Bug")).toBe(TaskType.DEBUGGING);
    });
  });

  describe("selectBestModel", () => {
    it("should select Claude for coding tasks by default", () => {
      const result = router.selectBestModel(
        "Implement a new feature",
        "claude-sonnet-4"
      );

      expect(result.provider).toBe("claude");
      expect(result.taskType).toBe(TaskType.CODING);
      expect(result.score).toBe(95);
      expect(result.model).toBe("claude-sonnet-4");
    });

    it("should select Claude for review tasks", () => {
      const result = router.selectBestModel("Review the code", "claude-opus");

      expect(result.provider).toBe("claude");
      expect(result.taskType).toBe(TaskType.REVIEW);
      expect(result.score).toBe(98);
    });

    it("should select GLM for translation tasks", () => {
      const result = router.selectBestModel("Translate to Spanish", "glm-4");

      expect(result.provider).toBe("glm");
      expect(result.taskType).toBe(TaskType.TRANSLATION);
      expect(result.score).toBe(95);
    });

    it("should respect manual model override", () => {
      const result = router.selectBestModel("Implement a feature", "qwen-plus", {
        manualModel: "qwen",
      });

      expect(result.provider).toBe("qwen");
      expect(result.reason).toBe("Manual override");
    });

    it("should only use enabled models", () => {
      const result = router.selectBestModel("Review the code", "test-model", {
        enabledModels: ["openai"],
      });

      expect(result.provider).toBe("openai");
    });

    it("should log selection decision", () => {
      router.selectBestModel("Implement feature", "claude-sonnet-4");

      expect(mockLogger.info).toHaveBeenCalledWith("Model selected", {
        provider: "claude",
        model: "claude-sonnet-4",
        taskType: "coding",
        score: 95,
        reason: "Best fit for coding task",
      });
    });

    it("should handle empty enabled models array gracefully", () => {
      const result = router.selectBestModel("Implement feature", "test-model", {
        enabledModels: [],
      });

      expect(result).toBeDefined();
    });
  });

  describe("getCapabilityScore", () => {
    it("should return correct capability scores", () => {
      expect(router.getCapabilityScore("claude", TaskType.CODING)).toBe(95);
      expect(router.getCapabilityScore("glm", TaskType.TRANSLATION)).toBe(95);
      expect(router.getCapabilityScore("openai", TaskType.REVIEW)).toBe(92);
    });
  });

  describe("getAvailableProviders", () => {
    it("should return all available providers", () => {
      const providers = router.getAvailableProviders();

      expect(providers).toContain("claude");
      expect(providers).toContain("glm");
      expect(providers).toContain("qwen");
      expect(providers).toContain("openai");
      expect(providers).toHaveLength(4);
    });
  });

  describe("MODEL_CAPABILITY_MATRIX", () => {
    it("should have scores for all model and task combinations", () => {
      const providers = Object.keys(MODEL_CAPABILITY_MATRIX) as ModelProvider[];
      const taskTypes = Object.values(TaskType);

      for (const provider of providers) {
        for (const taskType of taskTypes) {
          expect(MODEL_CAPABILITY_MATRIX[provider][taskType]).toBeDefined();
          expect(MODEL_CAPABILITY_MATRIX[provider][taskType]).toBeGreaterThanOrEqual(0);
          expect(MODEL_CAPABILITY_MATRIX[provider][taskType]).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe("default export", () => {
    it("should export a default instance", () => {
      expect(modelRouter).toBeInstanceOf(ModelRouter);
      expect(modelRouter.classifyTask("Implement feature")).toBe(TaskType.CODING);
    });
  });
});
