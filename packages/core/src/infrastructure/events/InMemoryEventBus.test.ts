/**
 * InMemoryEventBus Unit Tests
 *
 * Tests cover:
 * - Basic publish-subscribe functionality
 * - Subscription and unsubscription
 * - One-time listeners (once)
 * - Error handling and isolation
 * - Async handler execution
 * - Event listener management (removeAllListeners, listenerCount, eventNames)
 * - IEventBus interface compliance
 * - Statistics and metadata
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InMemoryEventBus } from "./InMemoryEventBus";
import type { ILogger } from "@talos/types";

describe("InMemoryEventBus", () => {
  let eventBus: InMemoryEventBus;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      audit: vi.fn(),
      setLevel: vi.fn(),
      getLevel: vi.fn(),
    };
    eventBus = new InMemoryEventBus({ logger: mockLogger });
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  describe("Basic publish-subscribe", () => {
    it("should execute subscribed handlers when event is published", async () => {
      const handler = vi.fn();
      eventBus.subscribe("test:event", handler);

      await eventBus.publish("test:event", { data: "test" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "test:event",
          payload: { data: "test" },
          timestamp: expect.any(Number),
        })
      );
    });

    it("should execute multiple handlers for the same event", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe("test:event", handler1);
      eventBus.subscribe("test:event", handler2);

      await eventBus.publish("test:event", { data: "test" });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("should not execute handlers for different events", async () => {
      const handler = vi.fn();
      eventBus.subscribe("test:event", handler);

      await eventBus.publish("other:event", { data: "test" });

      expect(handler).not.toHaveBeenCalled();
    });

    it("should execute handlers asynchronously in parallel", async () => {
      let order: number[] = [];
      const handler1 = vi.fn(async () => {
        order.push(1);
        await new Promise((resolve) => setTimeout(resolve, 10));
        order.push(2);
      });
      const handler2 = vi.fn(async () => {
        order.push(3);
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push(4);
      });

      eventBus.subscribe("test:event", handler1);
      eventBus.subscribe("test:event", handler2);

      await eventBus.publish("test:event", {});

      // Both handlers should have completed
      expect(order).toEqual([1, 3, 4, 2]); // handler2 finishes first
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("Subscription and unsubscription", () => {
    it("should return unsubscribe function from subscribe", async () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe("test:event", handler);

      await eventBus.publish("test:event", {});
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      await eventBus.publish("test:event", {});
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it("should unsubscribe by subscription ID", async () => {
      const handler = vi.fn();
      eventBus.subscribe("test:event", handler);

      // Get subscription ID from stats
      const stats = eventBus.getStats();
      const subscriptions = eventBus["subscriptions"].get("test:event");
      const subscriptionId = subscriptions![0].id;

      await eventBus.publish("test:event", {});
      expect(handler).toHaveBeenCalledTimes(1);

      eventBus.unsubscribe(subscriptionId);
      await eventBus.publish("test:event", {});
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it("should handle unsubscribe of non-existent subscription gracefully", () => {
      expect(() => {
        eventBus.unsubscribe("non-existent-id");
      }).not.toThrow();
    });
  });

  describe("One-time listeners (once)", () => {
    it("should execute one-time listener only once", async () => {
      const handler = vi.fn();
      eventBus.once("test:event", handler);

      await eventBus.publish("test:event", {});
      await eventBus.publish("test:event", {});

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should unsubscribe one-time listener after execution", async () => {
      const handler = vi.fn();
      eventBus.once("test:event", handler);

      expect(eventBus.listenerCount("test:event")).toBe(1);

      await eventBus.publish("test:event", {});

      expect(eventBus.listenerCount("test:event")).toBe(0);
    });

    it("should allow unsubscribing one-time listener before execution", async () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.once("test:event", handler);

      unsubscribe();
      await eventBus.publish("test:event", {});

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("Error handling and isolation", () => {
    it("should catch handler errors and log them", async () => {
      const errorHandler = vi.fn(() => {
        throw new Error("Handler error");
      });
      const successHandler = vi.fn();

      eventBus.subscribe("test:event", errorHandler);
      eventBus.subscribe("test:event", successHandler);

      await eventBus.publish("test:event", {});

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error in event handler"),
        expect.objectContaining({
          subscriptionId: expect.any(String),
          error: expect.any(Error),
        })
      );
    });

    it("should continue executing handlers after one fails", async () => {
      const handler1 = vi.fn(() => {
        throw new Error("Handler 1 error");
      });
      const handler2 = vi.fn();
      const handler3 = vi.fn(() => {
        throw new Error("Handler 3 error");
      });

      eventBus.subscribe("test:event", handler1);
      eventBus.subscribe("test:event", handler2);
      eventBus.subscribe("test:event", handler3);

      await eventBus.publish("test:event", {});

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it("should handle async handler errors", async () => {
      const handler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error("Async handler error");
      });

      eventBus.subscribe("test:event", handler);

      await eventBus.publish("test:event", {});

      expect(handler).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("IEventBus interface compliance", () => {
    it("should support on/off pattern", async () => {
      const handler = vi.fn();
      eventBus.on("test:event", handler);

      await eventBus.emit("test:event", { data: "test" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ data: "test" });

      eventBus.off("test:event", handler);
      await eventBus.emit("test:event", {});

      expect(handler).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should support once pattern", async () => {
      const handler = vi.fn();
      eventBus.once("test:event", handler);

      await eventBus.emit("test:event", {});
      await eventBus.emit("test:event", {});

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should return unsubscribe function from on", async () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on("test:event", handler);

      await eventBus.emit("test:event", {});
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      await eventBus.emit("test:event", {});
      expect(handler).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should support removeAllListeners", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on("test:event", handler1);
      eventBus.on("test:event", handler2);

      expect(eventBus.listenerCount("test:event")).toBe(2);

      eventBus.removeAllListeners("test:event");

      expect(eventBus.listenerCount("test:event")).toBe(0);
    });

    it("should support removeAllListeners without event name", () => {
      eventBus.on("event1", vi.fn());
      eventBus.on("event2", vi.fn());
      eventBus.on("event3", vi.fn());

      expect(eventBus.eventNames().length).toBe(3);

      eventBus.removeAllListeners();

      expect(eventBus.eventNames().length).toBe(0);
    });

    it("should provide listenerCount", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      expect(eventBus.listenerCount("test:event")).toBe(0);

      eventBus.on("test:event", handler1);
      expect(eventBus.listenerCount("test:event")).toBe(1);

      eventBus.on("test:event", handler2);
      eventBus.on("test:event", handler3);
      expect(eventBus.listenerCount("test:event")).toBe(3);

      eventBus.off("test:event", handler1);
      expect(eventBus.listenerCount("test:event")).toBe(2);
    });

    it("should provide eventNames", () => {
      expect(eventBus.eventNames()).toEqual([]);

      eventBus.on("event1", vi.fn());
      eventBus.on("event2", vi.fn());
      eventBus.on("event3", vi.fn());

      const names = eventBus.eventNames();
      expect(names).toHaveLength(3);
      expect(names).toContain("event1");
      expect(names).toContain("event2");
      expect(names).toContain("event3");
    });
  });

  describe("Event listener management", () => {
    it("should remove all listeners for specific event", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on("event1", handler1);
      eventBus.on("event1", handler2);
      eventBus.on("event2", vi.fn());

      eventBus.removeAllListeners("event1");

      expect(eventBus.listenerCount("event1")).toBe(0);
      expect(eventBus.listenerCount("event2")).toBe(1);
    });

    it("should unsubscribe all from specific event type", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe("event1", handler1);
      eventBus.subscribe("event1", handler2);

      await eventBus.publish("event1", {});
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      eventBus.unsubscribeAll("event1");

      await eventBus.publish("event1", {});
      expect(handler1).toHaveBeenCalledTimes(1); // Still 1
      expect(handler2).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should unsubscribe all from all events", () => {
      eventBus.subscribe("event1", vi.fn());
      eventBus.subscribe("event2", vi.fn());
      eventBus.subscribe("event3", vi.fn());

      expect(eventBus.eventNames().length).toBe(3);

      eventBus.unsubscribeAll();

      expect(eventBus.eventNames().length).toBe(0);
    });
  });

  describe("Statistics and metadata", () => {
    it("should provide subscription statistics", () => {
      eventBus.subscribe("event1", vi.fn());
      eventBus.subscribe("event1", vi.fn());
      eventBus.subscribe("event2", vi.fn());
      eventBus.subscribe("event3", vi.fn());

      const stats = eventBus.getStats();

      expect(stats.totalEvents).toBe(3);
      expect(stats.totalSubscriptions).toBe(4);
      expect(stats.subscriptionsByEvent).toEqual({
        event1: 2,
        event2: 1,
        event3: 1,
      });
    });

    it("should provide empty statistics when no subscriptions", () => {
      const stats = eventBus.getStats();

      expect(stats.totalEvents).toBe(0);
      expect(stats.totalSubscriptions).toBe(0);
      expect(stats.subscriptionsByEvent).toEqual({});
    });

    it("should update statistics after unsubscription", () => {
      eventBus.subscribe("event1", vi.fn());
      eventBus.subscribe("event1", vi.fn());

      let stats = eventBus.getStats();
      expect(stats.totalSubscriptions).toBe(2);

      eventBus.removeAllListeners("event1");

      stats = eventBus.getStats();
      expect(stats.totalSubscriptions).toBe(0);
      expect(stats.totalEvents).toBe(0);
    });
  });

  describe("Edge cases", () => {
    it("should handle publish with no subscribers gracefully", async () => {
      await expect(eventBus.publish("non-existent", {})).resolves.not.toThrow();
    });

    it("should handle emit with no subscribers gracefully", () => {
      expect(() => {
        eventBus.emit("non-existent", {});
      }).not.toThrow();
    });

    it("should handle publish with undefined payload", async () => {
      const handler = vi.fn();
      eventBus.subscribe("test:event", handler);

      await eventBus.publish("test:event");

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "test:event",
          payload: undefined,
        })
      );
    });

    it("should generate unique subscription IDs", () => {
      const unsub1 = eventBus.subscribe("event1", vi.fn());
      const unsub2 = eventBus.subscribe("event2", vi.fn());
      const unsub3 = eventBus.subscribe("event3", vi.fn());

      const subscriptions = eventBus["subscriptions"];
      const ids = [
        ...subscriptions.get("event1")!,
        ...subscriptions.get("event2")!,
        ...subscriptions.get("event3")!,
      ];

      const uniqueIds = new Set(ids.map((sub) => sub.id));
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe("Fire and forget (emit)", () => {
    it("should not await emit calls", async () => {
      let handlerCompleted = false;
      const handler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        handlerCompleted = true;
      });

      eventBus.on("test:event", handler);
      eventBus.emit("test:event", {});

      // emit should return immediately, not wait for handler
      expect(handlerCompleted).toBe(false);

      // Wait for handler to complete
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(handlerCompleted).toBe(true);
    });
  });

  describe("unsubscribeAll alias", () => {
    it("should alias removeAllListeners correctly", () => {
      eventBus.subscribe("event1", vi.fn());
      eventBus.subscribe("event2", vi.fn());

      expect(eventBus.eventNames().length).toBe(2);

      eventBus.unsubscribeAll();

      expect(eventBus.eventNames().length).toBe(0);
    });
  });
});
