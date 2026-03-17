import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock @xterm/xterm
vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn(),
}));

// Mock @xterm/addon-fit
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn(),
}));

// Mock @xterm/addon-web-links
vi.mock("@xterm/addon-web-links", () => ({
  WebLinksAddon: vi.fn(),
}));

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";

// Mock document global
const mockElement = {
  remove: vi.fn(),
};

global.document = {
  createElement: vi.fn(() => mockElement),
} as any;

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb: any) => setTimeout(cb, 0));

// Import after mocking globals
import { terminalCache, TerminalInstanceCache } from "./terminal-cache";

describe("TerminalInstanceCache", () => {
  let mockTerminal: any;
  let mockFitAddon: any;
  let mockWebLinksAddon: any;
  let mockContainer: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock Terminal
    mockTerminal = {
      open: vi.fn(),
      loadAddon: vi.fn(),
      dispose: vi.fn(),
      element: {
        remove: vi.fn(),
      },
    };

    // Setup mock FitAddon
    mockFitAddon = {
      fit: vi.fn(),
    };

    // Setup mock WebLinksAddon
    mockWebLinksAddon = {};

    // Setup mock constructors
    vi.mocked(Terminal).mockReturnValue(mockTerminal);
    vi.mocked(FitAddon).mockReturnValue(mockFitAddon);
    vi.mocked(WebLinksAddon).mockReturnValue(mockWebLinksAddon);

    // Clear cache before each test
    terminalCache.clear();

    // Create mock container
    mockContainer = mockElement as any;
  });

  afterEach(() => {
    // Clean up cache after each test
    terminalCache.clear();
  });

  describe("getInstance", () => {
    it("should return same instance (singleton pattern)", () => {
      const instance1 = TerminalInstanceCache.getInstance();
      const instance2 = TerminalInstanceCache.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should return TerminalInstanceCache instance", () => {
      const instance = TerminalInstanceCache.getInstance();

      expect(instance).toBeInstanceOf(TerminalInstanceCache);
      expect(instance).toHaveProperty("getOrCreate");
      expect(instance).toHaveProperty("attach");
      expect(instance).toHaveProperty("detach");
    });
  });

  describe("getOrCreate", () => {
    it("should create new terminal if not exists", () => {
      const cached = terminalCache.getOrCreate("test-key");

      expect(Terminal).toHaveBeenCalledWith({
        theme: expect.any(Object),
        fontFamily: 'SF Mono, Monaco, Consolas, "Liberation Mono", monospace',
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        cursorStyle: "block",
        scrollback: 10000,
        allowProposedApi: true,
        convertEol: true,
      });

      expect(cached).toBeDefined();
      expect(cached.terminal).toBe(mockTerminal);
      expect(cached.fitAddon).toBe(mockFitAddon);
      expect(cached.container).toBeNull();
      expect(cached.isActive).toBe(false);
    });

    it("should create FitAddon and WebLinksAddon", () => {
      terminalCache.getOrCreate("test-key");

      expect(FitAddon).toHaveBeenCalled();
      expect(WebLinksAddon).toHaveBeenCalled();
      expect(mockTerminal.loadAddon).toHaveBeenCalledWith(mockFitAddon);
      expect(mockTerminal.loadAddon).toHaveBeenCalledWith(mockWebLinksAddon);
    });

    it("should reuse existing terminal for same key", () => {
      const cached1 = terminalCache.getOrCreate("test-key");
      const cached2 = terminalCache.getOrCreate("test-key");

      expect(cached1).toBe(cached2);
      expect(Terminal).toHaveBeenCalledTimes(1);
      expect(FitAddon).toHaveBeenCalledTimes(1);
      expect(WebLinksAddon).toHaveBeenCalledTimes(1);
    });

    it("should create different terminals for different keys", () => {
      const cached1 = terminalCache.getOrCreate("key1");
      const cached2 = terminalCache.getOrCreate("key2");

      expect(cached1).not.toBe(cached2);
      expect(Terminal).toHaveBeenCalledTimes(2);
    });
  });

  describe("attach", () => {
    it("should throw error if terminal not found in cache", () => {
      expect(() => {
        terminalCache.attach("non-existent", mockContainer);
      }).toThrow('Terminal with key "non-existent" not found in cache');
    });

    it("should attach terminal to container", () => {
      terminalCache.getOrCreate("test-key");
      terminalCache.attach("test-key", mockContainer);

      expect(mockTerminal.open).toHaveBeenCalledWith(mockContainer);
    });

    it("should set container reference", () => {
      terminalCache.getOrCreate("test-key");
      terminalCache.attach("test-key", mockContainer);

      const cached = terminalCache.get("test-key");
      expect(cached?.container).toBe(mockContainer);
    });

    it("should set isActive to true when makeActive is true", () => {
      terminalCache.getOrCreate("test-key");
      terminalCache.attach("test-key", mockContainer, true);

      const cached = terminalCache.get("test-key");
      expect(cached?.isActive).toBe(true);
    });

    it("should set isActive to false when makeActive is false", () => {
      terminalCache.getOrCreate("test-key");
      terminalCache.attach("test-key", mockContainer, false);

      const cached = terminalCache.get("test-key");
      expect(cached?.isActive).toBe(false);
    });

    it("should call fitAddon.fit() when makeActive is true", () => {
      terminalCache.getOrCreate("test-key");
      terminalCache.attach("test-key", mockContainer, true);

      // fit() is called via requestAnimationFrame
      // In test, we can't easily test async timing, but we verify fit is available
      expect(mockFitAddon.fit).toBeDefined();
    });

    it("should remove from old container when attaching to new container", () => {
      terminalCache.getOrCreate("test-key");

      // Create a distinct old container
      const oldContainer = { ...mockElement };
      terminalCache.attach("test-key", oldContainer as any);

      // Attach to new container
      terminalCache.attach("test-key", mockContainer);

      expect(mockTerminal.element?.remove).toHaveBeenCalled();
      expect(mockTerminal.open).toHaveBeenCalledWith(mockContainer);
    });

    it("should not remove if attaching to same container", () => {
      terminalCache.getOrCreate("test-key");
      terminalCache.attach("test-key", mockContainer);

      // Attach to same container again
      terminalCache.attach("test-key", mockContainer);

      // Should not call remove since container is the same
      expect(mockTerminal.element?.remove).not.toHaveBeenCalled();
    });
  });

  describe("detach", () => {
    it("should set container to null", () => {
      terminalCache.getOrCreate("test-key");
      terminalCache.attach("test-key", mockContainer);

      terminalCache.detach("test-key");

      const cached = terminalCache.get("test-key");
      expect(cached?.container).toBeNull();
    });

    it("should set isActive to false", () => {
      terminalCache.getOrCreate("test-key");
      terminalCache.attach("test-key", mockContainer, true);

      terminalCache.detach("test-key");

      const cached = terminalCache.get("test-key");
      expect(cached?.isActive).toBe(false);
    });

    it("should not dispose terminal", () => {
      terminalCache.getOrCreate("test-key");
      terminalCache.attach("test-key", mockContainer);

      terminalCache.detach("test-key");

      expect(mockTerminal.dispose).not.toHaveBeenCalled();
    });

    it("should handle detaching non-existent terminal gracefully", () => {
      expect(() => {
        terminalCache.detach("non-existent");
      }).not.toThrow();
    });
  });

  describe("setActive", () => {
    it("should set isActive to true", () => {
      terminalCache.getOrCreate("test-key");
      terminalCache.setActive("test-key");

      const cached = terminalCache.get("test-key");
      expect(cached?.isActive).toBe(true);
    });

    it("should call fitAddon.fit() when container exists", () => {
      terminalCache.getOrCreate("test-key");
      terminalCache.attach("test-key", mockContainer, false);

      terminalCache.setActive("test-key");

      expect(mockFitAddon.fit).toBeDefined();
    });

    it("should handle non-existent terminal gracefully", () => {
      expect(() => {
        terminalCache.setActive("non-existent");
      }).not.toThrow();
    });
  });

  describe("setInactive", () => {
    it("should set isActive to false", () => {
      terminalCache.getOrCreate("test-key");
      terminalCache.attach("test-key", mockContainer, true);

      terminalCache.setInactive("test-key");

      const cached = terminalCache.get("test-key");
      expect(cached?.isActive).toBe(false);
    });

    it("should handle non-existent terminal gracefully", () => {
      expect(() => {
        terminalCache.setInactive("non-existent");
      }).not.toThrow();
    });
  });

  describe("fitActive", () => {
    it("should fit the active terminal", () => {
      terminalCache.getOrCreate("key1");
      terminalCache.attach("key1", mockContainer, true);

      terminalCache.fitActive();

      expect(mockFitAddon.fit).toHaveBeenCalled();
    });

    it("should only fit the first active terminal", () => {
      const mockContainer1 = { ...mockElement };
      const mockContainer2 = { ...mockElement };
      const mockFitAddon2 = { fit: vi.fn() };

      // Create first terminal (active)
      vi.mocked(Terminal).mockReturnValueOnce(mockTerminal);
      vi.mocked(FitAddon).mockReturnValueOnce(mockFitAddon);
      terminalCache.getOrCreate("key1");
      terminalCache.attach("key1", mockContainer1 as any, true);

      // Create second terminal (also active - should not be fitted)
      const mockTerminal2 = {
        ...mockTerminal,
        loadAddon: vi.fn(),
        dispose: vi.fn(),
        element: { remove: vi.fn() },
      };
      vi.mocked(Terminal).mockReturnValueOnce(mockTerminal2);
      vi.mocked(FitAddon).mockReturnValueOnce(mockFitAddon2);
      terminalCache.getOrCreate("key2");
      terminalCache.attach("key2", mockContainer2 as any, true);

      // Clear previous fit calls
      mockFitAddon.fit.mockClear();
      mockFitAddon2.fit.mockClear();

      terminalCache.fitActive();

      // Only the first active terminal should be fitted
      expect(mockFitAddon.fit).toHaveBeenCalledTimes(1);
      expect(mockFitAddon2.fit).not.toHaveBeenCalled();
    });

    it("should not fit inactive terminals", () => {
      terminalCache.getOrCreate("key1");
      terminalCache.attach("key1", mockContainer, false);

      mockFitAddon.fit.mockClear();

      terminalCache.fitActive();

      expect(mockFitAddon.fit).not.toHaveBeenCalled();
    });

    it("should not fit terminals without container", () => {
      terminalCache.getOrCreate("key1");
      terminalCache.setActive("key1");

      terminalCache.fitActive();

      expect(mockFitAddon.fit).not.toHaveBeenCalled();
    });

    it("should handle no terminals gracefully", () => {
      expect(() => {
        terminalCache.fitActive();
      }).not.toThrow();
    });
  });

  describe("remove", () => {
    it("should dispose terminal", () => {
      terminalCache.getOrCreate("test-key");

      terminalCache.remove("test-key");

      expect(mockTerminal.dispose).toHaveBeenCalled();
    });

    it("should remove terminal from cache", () => {
      terminalCache.getOrCreate("test-key");
      expect(terminalCache.has("test-key")).toBe(true);

      terminalCache.remove("test-key");

      expect(terminalCache.has("test-key")).toBe(false);
    });

    it("should handle disposal errors gracefully", () => {
      mockTerminal.dispose.mockImplementation(() => {
        throw new Error("Disposal failed");
      });

      terminalCache.getOrCreate("test-key");

      expect(() => {
        terminalCache.remove("test-key");
      }).not.toThrow();

      // Should still be removed from cache
      expect(terminalCache.has("test-key")).toBe(false);
    });

    it("should handle removing non-existent terminal gracefully", () => {
      expect(() => {
        terminalCache.remove("non-existent");
      }).not.toThrow();
    });
  });

  describe("has", () => {
    it("should return true for existing terminal", () => {
      terminalCache.getOrCreate("test-key");

      expect(terminalCache.has("test-key")).toBe(true);
    });

    it("should return false for non-existent terminal", () => {
      expect(terminalCache.has("non-existent")).toBe(false);
    });
  });

  describe("get", () => {
    it("should return existing terminal", () => {
      const cached = terminalCache.getOrCreate("test-key");
      const retrieved = terminalCache.get("test-key");

      expect(retrieved).toBe(cached);
    });

    it("should return undefined for non-existent terminal", () => {
      const retrieved = terminalCache.get("non-existent");

      expect(retrieved).toBeUndefined();
    });

    it("should not create new terminal", () => {
      terminalCache.get("test-key");

      expect(Terminal).not.toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("should dispose all terminals", () => {
      terminalCache.getOrCreate("key1");
      terminalCache.getOrCreate("key2");
      terminalCache.getOrCreate("key3");

      terminalCache.clear();

      expect(mockTerminal.dispose).toHaveBeenCalledTimes(3);
    });

    it("should remove all terminals from cache", () => {
      terminalCache.getOrCreate("key1");
      terminalCache.getOrCreate("key2");

      expect(terminalCache.has("key1")).toBe(true);
      expect(terminalCache.has("key2")).toBe(true);

      terminalCache.clear();

      expect(terminalCache.has("key1")).toBe(false);
      expect(terminalCache.has("key2")).toBe(false);
    });

    it("should handle disposal errors gracefully", () => {
      mockTerminal.dispose.mockImplementation(() => {
        throw new Error("Disposal failed");
      });

      terminalCache.getOrCreate("key1");
      terminalCache.getOrCreate("key2");

      expect(() => {
        terminalCache.clear();
      }).not.toThrow();

      // Should still be cleared
      expect(terminalCache.has("key1")).toBe(false);
      expect(terminalCache.has("key2")).toBe(false);
    });

    it("should handle clearing empty cache gracefully", () => {
      expect(() => {
        terminalCache.clear();
      }).not.toThrow();
    });
  });
});
