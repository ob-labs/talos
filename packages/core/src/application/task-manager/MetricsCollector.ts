/**
 * Metrics Collector
 *
 * Collects and aggregates task execution metrics.
 * Tracks performance indicators like story completion rates, execution duration, and tool usage.
 *
 * RESPONSIBILITIES:
 * - Record and store metric values with timestamps and tags
 * - Support incremental counter updates via incrementMetric
 * - Query metrics with optional filtering by name, tags, or time range
 * - Generate formatted summary reports
 * - Reset metrics for testing or task restart
 *
 * DEPENDENCIES:
 * - taskId: string - Task identifier for tagging metrics
 *
 * COMMON METRIC TYPES:
 * - storiesTotal: Total number of stories in PRD
 * - storiesPassed: Number of stories passing acceptance criteria
 * - storiesFailed: Number of stories failing acceptance criteria
 * - executionDuration: Total execution time in milliseconds
 * - toolExecutionCount: Number of tool executions (Claude, Cursor, etc.)
 * - averageToolExecutionTime: Average tool execution time in milliseconds
 */

import type { IMetricsCollector } from "@talos/types";

/**
 * Metric Entry
 *
 * Internal representation of a recorded metric.
 */
interface MetricEntry {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: Date;
}

/**
 * Metrics Collector Options
 */
export interface MetricsCollectorOptions {
  taskId: string;
}

/**
 * Metrics Collector Class
 *
 * Implements IMetricsCollector interface for collecting task execution metrics.
 * All metrics are automatically tagged with the taskId.
 */
export class MetricsCollector implements IMetricsCollector {
  private taskId: string;
  private metrics: MetricEntry[] = [];

  constructor(options: MetricsCollectorOptions) {
    this.taskId = options.taskId;
  }

  /**
   * Record a metric value
   *
   * Stores metric with timestamp and automatic taskId tagging.
   * Additional tags can be provided for categorization and filtering.
   *
   * @param name - Metric name
   * @param value - Metric value
   * @param tags - Optional tags for categorization
   */
  async recordMetric(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    const entry: MetricEntry = {
      name,
      value,
      tags: {
        taskId: this.taskId,
        ...(tags || {})
      },
      timestamp: new Date()
    };

    this.metrics.push(entry);
  }

  /**
   * Increment a counter metric
   *
   * Helper method for updating counter metrics like story counts or tool execution counts.
   * Creates new metric entry with incremented value.
   * If tags are provided, also records an untagged total for summary aggregation.
   *
   * @param name - Metric name to increment
   * @param delta - Amount to increment (default: 1)
   * @param tags - Optional tags for the new entry
   */
  async incrementMetric(name: string, delta = 1, tags?: Record<string, string>): Promise<void> {
    // Step 1: Find the most recent value for this metric (with matching tags if provided)
    let lastValue = 0;

    if (this.metrics.length > 0) {
      const matchingMetrics = this.metrics.filter(m => {
        if (m.name !== name) return false;
        if (tags) {
          return Object.entries(tags).every(([key, val]) => m.tags[key] === val);
        }
        return true;
      });

      if (matchingMetrics.length > 0) {
        // Get the most recent matching metric
        const sortedByTimestamp = [...matchingMetrics].sort((a, b) =>
          b.timestamp.getTime() - a.timestamp.getTime()
        );
        lastValue = sortedByTimestamp[0].value;
      }
    }

    // Step 2: If tags were provided, find the most recent untagged value BEFORE adding the tagged metric
    let untaggedLastValue = 0;
    if (tags) {
      // Find the most recent untagged value (only has taskId tag)
      // Search BEFORE we add the new tagged metric to avoid including it
      const untaggedMetrics = this.metrics.filter(m => {
        if (m.name !== name) return false;
        // Check if this metric has ONLY the taskId tag (no additional tags beyond taskId)
        const tagKeys = Object.keys(m.tags);
        return tagKeys.length === 1 && tagKeys[0] === "taskId";
      });

      if (untaggedMetrics.length > 0) {
        const sortedByTimestamp = [...untaggedMetrics].sort((a, b) =>
          b.timestamp.getTime() - a.timestamp.getTime()
        );
        untaggedLastValue = sortedByTimestamp[0].value;
      }
    }

    // Step 3: Record incremented value with tags (if tags provided) or without tags
    await this.recordMetric(name, lastValue + delta, tags);

    // Step 4: If tags were provided, also record an untagged total for summary aggregation
    if (tags) {
      // Record untagged total (this will be used by getSummary)
      // This records WITHOUT additional tags, so only taskId is present
      await this.recordMetric(name, untaggedLastValue + delta);
    }
  }

  /**
   * Get metrics with optional filtering
   *
   * Returns array of metrics matching the filter criteria.
   * If no filter provided, returns all metrics.
   *
   * @param filter - Optional filter criteria
   * @returns Array of matching metrics
   */
  async getMetrics(filter?: {
    name?: string;
    tags?: Record<string, string>;
    startTime?: Date;
    endTime?: Date;
  }): Promise<Array<{
    name: string;
    value: number;
    tags: Record<string, string>;
    timestamp: Date;
  }>> {
    let filtered = [...this.metrics];

    if (filter) {
      // Filter by name
      if (filter.name) {
        filtered = filtered.filter(m => m.name === filter.name);
      }

      // Filter by tags
      if (filter.tags) {
        filtered = filtered.filter(m =>
          Object.entries(filter.tags!).every(([key, val]) => m.tags[key] === val)
        );
      }

      // Filter by time range
      if (filter.startTime) {
        filtered = filtered.filter(m => m.timestamp >= filter.startTime!);
      }

      if (filter.endTime) {
        filtered = filtered.filter(m => m.timestamp <= filter.endTime!);
      }
    }

    // Return copies to prevent external mutation
    return filtered.map(m => ({
      name: m.name,
      value: m.value,
      tags: { ...m.tags },
      timestamp: new Date(m.timestamp)
    }));
  }

  /**
   * Get metrics summary
   *
   * Generates a formatted summary string of key metrics.
   * Includes storiesTotal, storiesPassed, storiesFailed, and executionDuration if available.
   *
   * @returns Formatted summary string
   */
  async getSummary(): Promise<string> {
    const allMetrics = await this.getMetrics();

    if (allMetrics.length === 0) {
      return `No metrics collected for task ${this.taskId}`;
    }

    const summaryParts: string[] = [`Task ${this.taskId} Metrics Summary:`];

    // Helper to get latest value for a metric name (ignores tags, finds latest across all tags)
    const getLatestValue = (name: string): number | null => {
      const matching = allMetrics.filter(m => m.name === name);
      if (matching.length === 0) return null;
      // Sort by timestamp descending, then by value descending to break ties
      return matching.sort((a, b) => {
        const timestampDiff = b.timestamp.getTime() - a.timestamp.getTime();
        if (timestampDiff !== 0) return timestampDiff;
        return b.value - a.value; // Tie-breaker: prefer higher value
      })[0].value;
    };

    // Story metrics - show if we have any story-related metrics
    const storiesTotal = getLatestValue("storiesTotal");
    const storiesPassed = getLatestValue("storiesPassed");
    const storiesFailed = getLatestValue("storiesFailed");

    if (storiesTotal !== null || storiesPassed !== null || storiesFailed !== null) {
      if (storiesTotal !== null) {
        summaryParts.push(`  Stories: ${storiesPassed || 0}/${storiesTotal} passed, ${storiesFailed || 0} failed`);
      } else if (storiesPassed !== null) {
        summaryParts.push(`  Stories Passed: ${storiesPassed}`);
      } else if (storiesFailed !== null) {
        summaryParts.push(`  Stories Failed: ${storiesFailed}`);
      }
    }

    // Execution duration
    const duration = getLatestValue("executionDuration");
    if (duration !== null) {
      const durationSec = (duration / 1000).toFixed(2);
      summaryParts.push(`  Execution Duration: ${durationSec}s`);
    }

    // Tool execution metrics
    const toolCount = getLatestValue("toolExecutionCount");
    if (toolCount !== null) {
      summaryParts.push(`  Tool Executions: ${toolCount}`);
    }

    const avgToolTime = getLatestValue("averageToolExecutionTime");
    if (avgToolTime !== null) {
      summaryParts.push(`  Avg Tool Execution Time: ${(avgToolTime / 1000).toFixed(2)}s`);
    }

    // Total metrics collected
    summaryParts.push(`  Total Metrics Recorded: ${allMetrics.length}`);

    return summaryParts.join("\n");
  }

  /**
   * Reset metrics
   *
   * Clears all collected metrics.
   * Optionally filter by name or tags before reset.
   *
   * @param filter - Optional filter to selectively reset metrics
   */
  async resetMetrics(filter?: { name?: string; tags?: Record<string, string> }): Promise<void> {
    if (!filter) {
      // Clear all metrics
      this.metrics = [];
      return;
    }

    // Filter out metrics that match the criteria
    this.metrics = this.metrics.filter(m => {
      // Check if metric matches all filter criteria
      let matchesAllCriteria = true;

      // Must match name if specified
      if (filter.name && m.name !== filter.name) {
        matchesAllCriteria = false;
      }

      // Must match all tags if specified
      if (matchesAllCriteria && filter.tags) {
        const tagsMatch = Object.entries(filter.tags).every(([key, val]) => m.tags[key] === val);
        if (!tagsMatch) {
          matchesAllCriteria = false;
        }
      }

      // Keep (don't delete) if it doesn't match ALL criteria
      return !matchesAllCriteria;
    });
  }
}
