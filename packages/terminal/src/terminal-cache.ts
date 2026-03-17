/**
 * Terminal Instance Cache
 *
 * Singleton cache for xterm.js instances to preserve terminal state
 * (output logs, scroll position) when switching between tabs/features.
 *
 * Key behaviors:
 * - Each cached terminal has a unique key (e.g., tab ID or workspace path)
 * - Terminals are NOT disposed when unmounted, only removed from DOM
 * - Terminals can be reopened in a different container using .open()
 * - Only the active terminal should receive fit() calls
 */

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";

// VS Code Dark+ theme colors
const VS_CODE_THEME = {
  background: "#0d1117",
  foreground: "#e6edf3",
  cursor: "#e6edf3",
  cursorAccent: "#0d1117",
  selectionBackground: "#264f78",
  selectionForeground: "#e6edf3",
  black: "#000000",
  red: "#f85149",
  green: "#3fb950",
  yellow: "#d29922",
  blue: "#58a6ff",
  magenta: "#bc8cff",
  cyan: "#39c5cf",
  white: "#e6edf3",
  brightBlack: "#8b949e",
  brightRed: "#f85149",
  brightGreen: "#3fb950",
  brightYellow: "#d29922",
  brightBlue: "#58a6ff",
  brightMagenta: "#bc8cff",
  brightCyan: "#39c5cf",
  brightWhite: "#ffffff",
};

export interface CachedTerminal {
  terminal: Terminal;
  fitAddon: FitAddon;
  container: HTMLElement | null;
  isActive: boolean;
}

export class TerminalInstanceCache {
  private static instance: TerminalInstanceCache;
  private cache = new Map<string, CachedTerminal>();

  private constructor() {}

  static getInstance(): TerminalInstanceCache {
    if (!TerminalInstanceCache.instance) {
      TerminalInstanceCache.instance = new TerminalInstanceCache();
    }
    return TerminalInstanceCache.instance;
  }

  /**
   * Get or create a cached terminal instance
   * @param key - Unique identifier for this terminal (e.g., tab ID, workspace path)
   * @returns The cached terminal instance
   */
  getOrCreate(key: string): CachedTerminal {
    let cached = this.cache.get(key);

    if (!cached) {
      // Create new terminal instance
      const terminal = new Terminal({
        theme: VS_CODE_THEME,
        fontFamily: 'SF Mono, Monaco, Consolas, "Liberation Mono", monospace',
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        cursorStyle: "block",
        scrollback: 10000,
        allowProposedApi: true,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      cached = {
        terminal,
        fitAddon,
        container: null,
        isActive: false,
      };

      this.cache.set(key, cached);
    }

    return cached;
  }

  /**
   * Attach a cached terminal to a DOM container
   * @param key - Terminal cache key
   * @param container - DOM element to attach to
   * @param makeActive - Whether this terminal should be the active one
   */
  attach(key: string, container: HTMLElement, makeActive: boolean = true): void {
    const cached = this.cache.get(key);
    if (!cached) {
      throw new Error(`Terminal with key "${key}" not found in cache`);
    }

    // If terminal is already in a different container, remove it first
    if (cached.container && cached.container !== container) {
      cached.terminal.element?.remove();
    }

    // Open in the new container
    cached.terminal.open(container);
    cached.container = container;
    cached.isActive = makeActive;

    // Fit only if this is the active terminal
    if (makeActive) {
      // Use requestAnimationFrame to ensure container has dimensions
      requestAnimationFrame(() => {
        cached.fitAddon.fit();
      });
    }
  }

  /**
   * Detach a terminal from its container (without disposing)
   * @param key - Terminal cache key
   */
  detach(key: string): void {
    const cached = this.cache.get(key);
    if (cached) {
      cached.container = null;
      cached.isActive = false;
      // Don't dispose - keep for reuse
      // Don't remove from DOM - that's handled by React
    }
  }

  /**
   * Set a terminal as active (for fit() calls)
   * @param key - Terminal cache key
   */
  setActive(key: string): void {
    const cached = this.cache.get(key);
    if (cached) {
      cached.isActive = true;
      // Fit the now-active terminal
      requestAnimationFrame(() => {
        if (cached.container) {
          cached.fitAddon.fit();
        }
      });
    }
  }

  /**
   * Set a terminal as inactive
   * @param key - Terminal cache key
   */
  setInactive(key: string): void {
    const cached = this.cache.get(key);
    if (cached) {
      cached.isActive = false;
    }
  }

  /**
   * Fit the active terminal (call this on window resize)
   */
  fitActive(): void {
    for (const cached of this.cache.values()) {
      if (cached.isActive && cached.container) {
        cached.fitAddon.fit();
        break; // Only fit the first active terminal
      }
    }
  }

  /**
   * Remove and dispose a terminal from cache
   * @param key - Terminal cache key
   */
  remove(key: string): void {
    const cached = this.cache.get(key);
    if (cached) {
      try {
        cached.terminal.dispose();
      } catch (e) {
        // Ignore disposal errors
      }
      this.cache.delete(key);
    }
  }

  /**
   * Check if a terminal exists in cache
   * @param key - Terminal cache key
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get a cached terminal without creating
   * @param key - Terminal cache key
   */
  get(key: string): CachedTerminal | undefined {
    return this.cache.get(key);
  }

  /**
   * Clear all cached terminals
   */
  clear(): void {
    for (const cached of this.cache.values()) {
      try {
        cached.terminal.dispose();
      } catch (e) {
        // Ignore disposal errors
      }
    }
    this.cache.clear();
  }
}

// Export singleton instance
export const terminalCache = TerminalInstanceCache.getInstance();
