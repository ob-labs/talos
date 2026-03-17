/**
 * InMemoryEventBus - In-Memory Event Bus Implementation
 *
 * Simple in-memory event bus for inter-module communication.
 * Implements publish-subscribe pattern with error isolation.
 *
 * ARCHITECTURE NOTES:
 * - Event handlers execute asynchronously in parallel
 * - Errors in handlers are caught and logged, don't affect other handlers
 * - Uses subscription IDs for unsubscribe capability
 * - All handlers are executed via Promise.all() for parallelism
 *
 * USE CASES:
 * - Task status change notifications
 * - Story execution progress events
 * - Worktree lifecycle events
 * - Cross-module communication
 *
 * @example
 * ```typescript
 * const eventBus = new InMemoryEventBus({ logger });
 *
 * // Subscribe to events
 * const unsubscribe = eventBus.subscribe('task:started', (event) => {
 *   console.log('Task started:', event.payload.taskId);
 * });
 *
 * // Publish events
 * await eventBus.publish('task:started', { taskId: 'task-123' });
 *
 * // Unsubscribe
 * unsubscribe();
 * ```
 */

import type { ILogger } from "@talos/types";
import type {
  IEventBus,
  EventHandler,
  UnsubscribeFunction,
} from "@talos/types";

/**
 * Event interface
 * Represents an event with type, payload, and timestamp
 */
export interface Event<TPayload = unknown> {
  type: string;
  payload?: TPayload;
  timestamp: number;
}

/**
 * Event subscription metadata
 */
interface EventSubscription {
  id: string;
  event: string;
  handler: EventHandler;
  once: boolean;
}

/**
 * Subscription ID type
 */
export type SubscriptionId = string;

/**
 * InMemoryEventBus options
 */
export interface InMemoryEventBusOptions {
  logger?: ILogger;
}

/**
 * InMemoryEventBus - In-Memory Event Bus
 *
 * Implements IEventBus interface for local event-driven communication.
 *
 * FEATURES:
 * - Async handler execution (Promise.all)
 * - Error isolation (handler errors don't affect others)
 * - One-time listeners (once)
 * - Subscription-based unsubscribe
 * - Wildcard event matching (not implemented yet, reserved for future)
 *
 * ERROR HANDLING:
 * - Handler exceptions are caught and logged
 * - Failed handlers don't prevent other handlers from executing
 * - All handlers are awaited (Promise.all) before publish completes
 */
export class InMemoryEventBus implements IEventBus {
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private subscriptionCounter: number = 0;
  private logger?: ILogger;

  constructor(options?: InMemoryEventBusOptions) {
    this.logger = options?.logger;
  }

  /**
   * IEventBus implementation: Register event listener
   *
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on(event: string, handler: EventHandler): UnsubscribeFunction {
    const subscriptionId = this.addSubscription(event, handler, false);
    return () => this.unsubscribe(subscriptionId);
  }

  /**
   * IEventBus implementation: Register one-time event listener
   *
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  once(event: string, handler: EventHandler): UnsubscribeFunction {
    const subscriptionId = this.addSubscription(event, handler, true);
    return () => this.unsubscribe(subscriptionId);
  }

  /**
   * IEventBus implementation: Unregister event listener
   *
   * @param event - Event name
   * @param handler - Event handler function to remove
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.subscriptions.get(event);
    if (!handlers) {
      return;
    }

    // Remove all subscriptions with this handler
    const filtered = handlers.filter((sub) => sub.handler !== handler);
    if (filtered.length === 0) {
      this.subscriptions.delete(event);
    } else {
      this.subscriptions.set(event, filtered);
    }
  }

  /**
   * IEventBus implementation: Emit event to all subscribers
   *
   * @param event - Event name
   * @param data - Event payload data
   */
  emit(event: string, data?: unknown): void {
    // Fire and forget - don't await the async operation
    this.publish(event, data).catch((err) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger?.error(
        `Unexpected error in event publish: ${errorMessage}`,
        err,
        { event }
      );
    });
  }

  /**
   * IEventBus implementation: Remove all listeners for an event
   *
   * @param event - Optional event name
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.subscriptions.delete(event);
    } else {
      this.subscriptions.clear();
    }
  }

  /**
   * IEventBus implementation: Get listener count for an event
   *
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount(event: string): number {
    const handlers = this.subscriptions.get(event);
    return handlers ? handlers.length : 0;
  }

  /**
   * IEventBus implementation: Get all registered event names
   *
   * @returns Array of event names
   */
  eventNames(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Subscribe to event type
   *
   * @param eventType - Event type to subscribe to
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  subscribe<TPayload = unknown>(
    eventType: string,
    handler: (event: Event<TPayload>) => void | Promise<void>
  ): () => void {
    // Adapt Event handler to EventHandler (expects data, not full Event)
    const adaptedHandler: EventHandler = (data?: unknown) => {
      const event: Event<TPayload> = {
        type: eventType,
        payload: data as TPayload,
        timestamp: Date.now(),
      };
      return handler(event);
    };

    return this.on(eventType, adaptedHandler);
  }

  /**
   * Publish event to all subscribers
   *
   * @param event - Event type
   * @param payload - Event payload
   * @returns Promise that resolves when all handlers complete
   */
  async publish<TPayload = unknown>(
    event: string,
    payload?: TPayload
  ): Promise<void> {
    const subscriptions = this.subscriptions.get(event);
    if (!subscriptions || subscriptions.length === 0) {
      return;
    }

    // Mark all 'once' subscriptions for removal BEFORE executing handlers
    // This prevents them from being called again if emit() is called again before publish completes
    const onceSubscriptions: string[] = [];
    const regularSubscriptions: EventSubscription[] = [];

    subscriptions.forEach((sub) => {
      if (sub.once) {
        onceSubscriptions.push(sub.id);
      } else {
        regularSubscriptions.push(sub);
      }
    });

    // Remove 'once' subscriptions immediately (before execution)
    onceSubscriptions.forEach((subId) => {
      this.unsubscribe(subId);
    });

    // Execute all handlers asynchronously (once + regular)
    const promises = subscriptions.map(async (sub) => {
      try {
        await sub.handler(payload);
      } catch (err) {
        // Log error but don't propagate - error isolation
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorObj = err instanceof Error ? err : undefined;
        this.logger?.error(
          `Error in event handler for ${event}: ${errorMessage}`,
          errorObj,
          { subscriptionId: sub.id }
        );
      }
    });

    // Wait for all handlers to complete
    await Promise.all(promises);
  }

  /**
   * Unsubscribe by subscription ID
   *
   * @param subscriptionId - Subscription ID to remove
   */
  unsubscribe(subscriptionId: SubscriptionId): void {
    for (const [event, subscriptions] of Array.from(this.subscriptions.entries())) {
      const filtered = subscriptions.filter((sub) => sub.id !== subscriptionId);
      if (filtered.length !== subscriptions.length) {
        if (filtered.length === 0) {
          this.subscriptions.delete(event);
        } else {
          this.subscriptions.set(event, filtered);
        }
        break; // Subscription ID is unique, stop searching
      }
    }
  }

  /**
   * Unsubscribe all from event type (or all events)
   *
   * @param eventType - Optional event type to unsubscribe from
   */
  unsubscribeAll(eventType?: string): void {
    this.removeAllListeners(eventType);
  }

  /**
   * Get subscription statistics
   *
   * @returns Object with subscription statistics
   */
  getStats(): {
    totalEvents: number;
    totalSubscriptions: number;
    subscriptionsByEvent: Record<string, number>;
  } {
    const subscriptionsByEvent: Record<string, number> = {};
    let totalSubscriptions = 0;

    for (const [event, subscriptions] of Array.from(this.subscriptions.entries())) {
      subscriptionsByEvent[event] = subscriptions.length;
      totalSubscriptions += subscriptions.length;
    }

    return {
      totalEvents: this.subscriptions.size,
      totalSubscriptions,
      subscriptionsByEvent,
    };
  }

  /**
   * Add subscription to registry
   *
   * @param event - Event name
   * @param handler - Event handler
   * @param once - Whether this is a one-time subscription
   * @returns Subscription ID
   */
  private addSubscription(
    event: string,
    handler: EventHandler,
    once: boolean
  ): SubscriptionId {
    const subscriptionId = `sub-${this.subscriptionCounter++}`;

    const subscription: EventSubscription = {
      id: subscriptionId,
      event,
      handler,
      once,
    };

    const handlers = this.subscriptions.get(event) || [];
    handlers.push(subscription);
    this.subscriptions.set(event, handlers);

    return subscriptionId;
  }
}
