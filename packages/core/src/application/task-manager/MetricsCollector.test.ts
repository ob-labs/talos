/**
 * MetricsCollector Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MetricsCollector } from "./MetricsCollector";

describe("MetricsCollector", () => {
  let metricsCollector: MetricsCollector;
  const taskId = "test-task-123";

  beforeEach(() => {
    metricsCollector = new MetricsCollector({ taskId });
  });

  describe("recordMetric", () => {
    it("should record a metric with value and automatic taskId tagging", async () => {
      await metricsCollector.recordMetric("storiesTotal", 10);

      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toEqual({
        name: "storiesTotal",
        value: 10,
        tags: { taskId },
        timestamp: expect.any(Date)
      });
    });

    it("should record multiple metrics", async () => {
      await metricsCollector.recordMetric("storiesTotal", 10);
      await metricsCollector.recordMetric("storiesPassed", 5);
      await metricsCollector.recordMetric("storiesFailed", 2);

      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toHaveLength(3);
    });

    it("should record metric with custom tags", async () => {
      await metricsCollector.recordMetric("executionDuration", 5000, { model: "sonnet-4", storyId: "US-001" });

      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].tags).toEqual({
        taskId,
        model: "sonnet-4",
        storyId: "US-001"
      });
    });

    it("should preserve timestamp order", async () => {
      await metricsCollector.recordMetric("metric1", 100);
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      await metricsCollector.recordMetric("metric2", 200);

      const metrics = await metricsCollector.getMetrics();
      expect(metrics[0].timestamp.getTime()).toBeLessThan(metrics[1].timestamp.getTime());
    });

    it("should handle zero and negative values", async () => {
      await metricsCollector.recordMetric("counter", 0);
      await metricsCollector.recordMetric("temperature", -10);

      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toHaveLength(2);
      expect(metrics[0].value).toBe(0);
      expect(metrics[1].value).toBe(-10);
    });
  });

  describe("incrementMetric", () => {
    it("should increment a counter from zero", async () => {
      await metricsCollector.incrementMetric("toolExecutionCount");

      const metrics = await metricsCollector.getMetrics({ name: "toolExecutionCount" });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(1);
    });

    it("should increment by custom delta", async () => {
      await metricsCollector.incrementMetric("storiesTotal", 5);

      const metrics = await metricsCollector.getMetrics({ name: "storiesTotal" });
      expect(metrics[0].value).toBe(5);
    });

    it("should increment existing metric value", async () => {
      await metricsCollector.incrementMetric("counter", 3);
      await metricsCollector.incrementMetric("counter", 2);

      const metrics = await metricsCollector.getMetrics({ name: "counter" });
      expect(metrics).toHaveLength(2);
      expect(metrics[0].value).toBe(3);
      expect(metrics[1].value).toBe(5); // 3 + 2
    });

    it("should create separate counters for different tags", async () => {
      await metricsCollector.incrementMetric("toolExecution", 1, { tool: "claude" });
      await metricsCollector.incrementMetric("toolExecution", 1, { tool: "cursor" });

      const claudeMetrics = await metricsCollector.getMetrics({ name: "toolExecution", tags: { tool: "claude" } });
      const cursorMetrics = await metricsCollector.getMetrics({ name: "toolExecution", tags: { tool: "cursor" } });

      expect(claudeMetrics).toHaveLength(1);
      expect(claudeMetrics[0].value).toBe(1);
      expect(cursorMetrics).toHaveLength(1);
      expect(cursorMetrics[0].value).toBe(1);
    });

    it("should increment counter with same tags", async () => {
      await metricsCollector.incrementMetric("counter", 2, { storyId: "US-001" });
      await metricsCollector.incrementMetric("counter", 3, { storyId: "US-001" });

      const metrics = await metricsCollector.getMetrics({ name: "counter", tags: { storyId: "US-001" } });
      expect(metrics).toHaveLength(2);
      expect(metrics[0].value).toBe(2);
      expect(metrics[1].value).toBe(5); // 2 + 3
    });
  });

  describe("getMetrics", () => {
    beforeEach(async () => {
      // Setup test data
      await metricsCollector.recordMetric("storiesTotal", 10);
      await metricsCollector.recordMetric("storiesPassed", 5, { status: "success" });
      await metricsCollector.recordMetric("storiesFailed", 2, { status: "failed" });
      await metricsCollector.recordMetric("executionDuration", 5000);
      await metricsCollector.recordMetric("toolExecutionCount", 15, { tool: "claude" });
      await metricsCollector.recordMetric("toolExecutionCount", 8, { tool: "cursor" });
    });

    it("should return all metrics when no filter provided", async () => {
      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toHaveLength(6);
    });

    it("should filter metrics by name", async () => {
      const metrics = await metricsCollector.getMetrics({ name: "storiesTotal" });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe("storiesTotal");
    });

    it("should filter metrics by tags", async () => {
      const metrics = await metricsCollector.getMetrics({ tags: { status: "success" } });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].tags.status).toBe("success");
    });

    it("should filter metrics by name and tags combined", async () => {
      const metrics = await metricsCollector.getMetrics({
        name: "toolExecutionCount",
        tags: { tool: "claude" }
      });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(15);
    });

    it("should filter metrics by start time", async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 10000);

      const metrics = await metricsCollector.getMetrics({ startTime: future });
      expect(metrics).toHaveLength(0); // All metrics are in the past
    });

    it("should filter metrics by end time", async () => {
      const past = new Date(Date.now() - 100000);

      const metrics = await metricsCollector.getMetrics({ endTime: past });
      expect(metrics).toHaveLength(0); // All metrics are recent
    });

    it("should filter metrics by time range", async () => {
      const now = new Date();
      const start = new Date(now.getTime() - 1000);
      const end = new Date(now.getTime() + 1000);

      const metrics = await metricsCollector.getMetrics({ startTime: start, endTime: end });
      expect(metrics.length).toBeGreaterThan(0); // All recent metrics should match
    });

    it("should return copies to prevent external mutation", async () => {
      const metrics = await metricsCollector.getMetrics();
      const originalValue = metrics[0].value;

      // Try to modify returned metric
      metrics[0].value = 999;
      metrics[0].tags.taskId = "hacked";

      // Original should be unchanged
      const metricsAgain = await metricsCollector.getMetrics();
      expect(metricsAgain[0].value).toBe(originalValue);
      expect(metricsAgain[0].tags.taskId).toBe(taskId);
    });
  });

  describe("getSummary", () => {
    it("should return message when no metrics collected", async () => {
      const summary = await metricsCollector.getSummary();
      expect(summary).toContain("No metrics collected");
      expect(summary).toContain(taskId);
    });

    it("should generate summary with story metrics", async () => {
      await metricsCollector.recordMetric("storiesTotal", 10);
      await metricsCollector.recordMetric("storiesPassed", 7);
      await metricsCollector.recordMetric("storiesFailed", 2);

      const summary = await metricsCollector.getSummary();
      expect(summary).toContain("Task test-task-123 Metrics Summary:");
      expect(summary).toContain("Stories: 7/10 passed, 2 failed");
    });

    it("should generate summary with execution duration", async () => {
      await metricsCollector.recordMetric("executionDuration", 5000);

      const summary = await metricsCollector.getSummary();
      expect(summary).toContain("Execution Duration: 5.00s");
    });

    it("should generate summary with tool execution metrics", async () => {
      await metricsCollector.recordMetric("toolExecutionCount", 25);
      await metricsCollector.recordMetric("averageToolExecutionTime", 2000);

      const summary = await metricsCollector.getSummary();
      expect(summary).toContain("Tool Executions: 25");
      expect(summary).toContain("Avg Tool Execution Time: 2.00s");
    });

    it("should include total metrics recorded count", async () => {
      await metricsCollector.recordMetric("metric1", 1);
      await metricsCollector.recordMetric("metric2", 2);
      await metricsCollector.recordMetric("metric3", 3);

      const summary = await metricsCollector.getSummary();
      expect(summary).toContain("Total Metrics Recorded: 3");
    });

    it("should use latest values when multiple entries exist", async () => {
      await metricsCollector.recordMetric("storiesTotal", 10);      await metricsCollector.recordMetric("storiesPassed", 3);
      await metricsCollector.recordMetric("storiesPassed", 5);
      await metricsCollector.recordMetric("storiesPassed", 7);

      const summary = await metricsCollector.getSummary();
      expect(summary).toContain("7/"); // Should use latest value (7)
    });

    it("should generate comprehensive summary with all metrics", async () => {
      await metricsCollector.recordMetric("storiesTotal", 20);
      await metricsCollector.recordMetric("storiesPassed", 15);
      await metricsCollector.recordMetric("storiesFailed", 3);
      await metricsCollector.recordMetric("executionDuration", 120000);
      await metricsCollector.recordMetric("toolExecutionCount", 50);
      await metricsCollector.recordMetric("averageToolExecutionTime", 3000);

      const summary = await metricsCollector.getSummary();
      expect(summary).toContain("Stories: 15/20 passed, 3 failed");
      expect(summary).toContain("Execution Duration: 120.00s");
      expect(summary).toContain("Tool Executions: 50");
      expect(summary).toContain("Avg Tool Execution Time: 3.00s");
      expect(summary).toContain("Total Metrics Recorded: 6");
    });
  });

  describe("resetMetrics", () => {
    beforeEach(async () => {
      // Setup test data
      await metricsCollector.recordMetric("metric1", 100, { type: "counter" });
      await metricsCollector.recordMetric("metric2", 200, { type: "gauge" });
      await metricsCollector.recordMetric("metric3", 300, { type: "counter" });
    });

    it("should clear all metrics when no filter provided", async () => {
      await metricsCollector.resetMetrics();

      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toHaveLength(0);
    });

    it("should reset metrics by name", async () => {
      await metricsCollector.resetMetrics({ name: "metric1" });

      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toHaveLength(2);
      expect(metrics.every(m => m.name !== "metric1")).toBe(true);
    });

    it("should reset metrics by tags", async () => {
      await metricsCollector.resetMetrics({ tags: { type: "counter" } });

      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe("metric2");
      expect(metrics[0].tags.type).toBe("gauge");
    });

    it("should reset metrics by name and tags combined", async () => {
      await metricsCollector.recordMetric("metric1", 150, { type: "gauge" });

      await metricsCollector.resetMetrics({ name: "metric1", tags: { type: "counter" } });

      const metrics = await metricsCollector.getMetrics();
      // Should keep: metric1 with type=gauge (type doesn't match), metric2 (name doesn't match), metric3 (name doesn't match)
      expect(metrics).toHaveLength(3);
      expect(metrics.filter(m => m.name === "metric1")).toHaveLength(1);
      expect(metrics.filter(m => m.name === "metric1")[0].tags.type).toBe("gauge");
    });

    it("should handle reset when no metrics match filter", async () => {
      const beforeCount = (await metricsCollector.getMetrics()).length;

      await metricsCollector.resetMetrics({ name: "nonexistent" });

      const afterCount = (await metricsCollector.getMetrics()).length;
      expect(afterCount).toBe(beforeCount);
    });

    it("should clear all and allow fresh recording", async () => {
      await metricsCollector.resetMetrics();

      await metricsCollector.recordMetric("newMetric", 999);

      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe("newMetric");
      expect(metrics[0].value).toBe(999);
    });
  });

  describe("integration scenarios", () => {
    it("should track PRD execution metrics lifecycle", async () => {
      // Start PRD execution
      await metricsCollector.recordMetric("storiesTotal", 10);
      await metricsCollector.recordMetric("executionDuration", 0);

      // Execute stories
      await metricsCollector.incrementMetric("storiesPassed", 1, { storyId: "US-001" });
      await metricsCollector.recordMetric("executionDuration", 5000);
      await metricsCollector.recordMetric("toolExecutionCount", 3, { storyId: "US-001" });

      await metricsCollector.incrementMetric("storiesPassed", 1, { storyId: "US-002" });
      await metricsCollector.recordMetric("executionDuration", 4000);
      await metricsCollector.recordMetric("toolExecutionCount", 2, { storyId: "US-002" });

      // Get summary
      const summary = await metricsCollector.getSummary();
      expect(summary).toContain("Stories: 2/10 passed");

      // Filter by story
      const us001Metrics = await metricsCollector.getMetrics({ tags: { storyId: "US-001" } });
      expect(us001Metrics.length).toBeGreaterThan(0);
    });

    it("should handle task restart with metrics reset", async () => {
      // First execution
      await metricsCollector.recordMetric("storiesPassed", 5);
      await metricsCollector.recordMetric("storiesTotal", 10);
      await metricsCollector.recordMetric("executionDuration", 10000);

      let summary = await metricsCollector.getSummary();
      expect(summary).toContain("5/");

      // Reset for new execution
      await metricsCollector.resetMetrics();

      // New execution
      await metricsCollector.recordMetric("storiesTotal", 10);
      await metricsCollector.recordMetric("storiesPassed", 3);
      await metricsCollector.recordMetric("executionDuration", 5000);

      summary = await metricsCollector.getSummary();
      expect(summary).toContain("3/");
    });

    it("should track tool usage across multiple executions", async () => {
      // Record tool executions
      await metricsCollector.incrementMetric("toolExecutionCount", 1, { tool: "claude" });
      await metricsCollector.incrementMetric("toolExecutionCount", 1, { tool: "claude" });
      await metricsCollector.incrementMetric("toolExecutionCount", 1, { tool: "cursor" });

      const claudeCount = await metricsCollector.getMetrics({
        name: "toolExecutionCount",
        tags: { tool: "claude" }
      });
      expect(claudeCount).toHaveLength(2);
      expect(claudeCount[1].value).toBe(2); // Incremented twice

      const cursorCount = await metricsCollector.getMetrics({
        name: "toolExecutionCount",
        tags: { tool: "cursor" }
      });
      expect(cursorCount).toHaveLength(1);
      expect(cursorCount[0].value).toBe(1);
    });
  });
});
