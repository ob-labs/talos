/**
 * Metrics Collector Interface
 *
 * Collects and aggregates execution metrics.
 * Provides insights into task performance, resource usage, and execution patterns.
 */
export interface IMetricsCollector {
  /**
   * Record a metric value
   *
   * @param name - Metric name (e.g., "execution_time", "memory_usage")
   * @param value - Metric value (numeric)
   * @param tags - Optional tags for metric categorization (e.g., { taskId: "task-123", model: "sonnet-4" })
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): Promise<void>;

  /**
   * Increment a counter metric
   *
   * Helper method for updating counter metrics like story counts or tool execution counts.
   *
   * @param name - Metric name to increment
   * @param delta - Amount to increment (default: 1)
   * @param tags - Optional tags for the new entry
   */
  incrementMetric(name: string, delta?: number, tags?: Record<string, string>): Promise<void>;

  /**
   * Get metrics with optional filtering
   *
   * @param filter - Optional filter criteria
   * @returns Array of matching metrics
   */
  getMetrics(filter?: {
    name?: string;
    tags?: Record<string, string>;
    startTime?: Date;
    endTime?: Date;
  }): Promise<Array<{
    name: string;
    value: number;
    tags: Record<string, string>;
    timestamp: Date;
  }>>;

  /**
   * Get metrics summary
   *
   * Generates a formatted summary string of key metrics.
   *
   * @returns Formatted summary string
   */
  getSummary(): Promise<string>;

  /**
   * Reset all metrics
   *
   * Clears all collected metrics data.
   * Optionally filter by name or tags before reset.
   *
   * @param filter - Optional filter to selectively reset metrics
   */
  resetMetrics(filter?: { name?: string; tags?: Record<string, string> }): Promise<void>;
}
