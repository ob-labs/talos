"use client";

import { useEffect, useRef } from "react";

export interface KeyboardShortcut {
  id: string;
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  preventDefault?: boolean;
  action: (event: KeyboardEvent) => void;
  // Condition to check if shortcut should be active
  when?: () => boolean;
  // Description for help display
  description: string;
  // Display shortcut (for UI)
  displayShortcut?: string;
}

export interface ShortcutContext {
  isTerminalFocused: boolean;
  isCommandPaletteOpen: boolean;
  isInputFocused: boolean;
}

// Default shortcut context
const defaultContext: ShortcutContext = {
  isTerminalFocused: false,
  isCommandPaletteOpen: false,
  isInputFocused: false,
};

// Check if an element is an input element
function isInputElement(element: Element | null): boolean {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element.getAttribute("contenteditable") === "true" ||
    element.classList.contains("xterm-helper-textarea")
  );
}

// Check if terminal is focused
function isTerminalFocused(): boolean {
  const activeElement = document.activeElement;
  return (
    activeElement?.classList.contains("xterm-helper-textarea") ?? false
  );
}

// Keyboard shortcuts manager class
export class KeyboardShortcutsManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private context: ShortcutContext = { ...defaultContext };
  private enabled = true;

  register(shortcut: KeyboardShortcut): void {
    const key = this.getShortcutKey(shortcut);
    this.shortcuts.set(key, shortcut);
  }

  unregister(id: string): void {
    for (const [key, shortcut] of this.shortcuts) {
      if (shortcut.id === id) {
        this.shortcuts.delete(key);
        break;
      }
    }
  }

  setContext(context: Partial<ShortcutContext>): void {
    this.context = { ...this.context, ...context };
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  private getShortcutKey(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    if (shortcut.ctrlKey) parts.push("ctrl");
    if (shortcut.metaKey) parts.push("meta");
    if (shortcut.shiftKey) parts.push("shift");
    if (shortcut.altKey) parts.push("alt");
    parts.push(shortcut.key.toLowerCase());
    return parts.join("+");
  }

  private matchShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
    const key = event.key.toLowerCase();
    const expectedKey = shortcut.key.toLowerCase();

    // Check modifier keys
    const ctrlMatch = !!shortcut.ctrlKey === (event.ctrlKey || event.metaKey);
    const metaMatch = !shortcut.metaKey; // meta is handled as ctrl on non-Mac
    const shiftMatch = !!shortcut.shiftKey === event.shiftKey;
    const altMatch = !!shortcut.altKey === event.altKey;

    // Check if key matches (handle special cases)
    const keyMatch = key === expectedKey;

    return ctrlMatch && metaMatch && shiftMatch && altMatch && keyMatch;
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) return;

    // Update context dynamically
    this.context.isTerminalFocused = isTerminalFocused();
    this.context.isInputFocused = isInputElement(document.activeElement);

    // Find matching shortcut
    for (const shortcut of this.shortcuts.values()) {
      if (this.matchShortcut(event, shortcut)) {
        // Check condition if provided
        if (shortcut.when && !shortcut.when()) {
          continue;
        }

        // Prevent default if specified
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }

        // Execute action
        shortcut.action(event);
        return;
      }
    }
  }

  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  getShortcutsByCategory(category: string): KeyboardShortcut[] {
    // Group by id prefix as category
    return this.getAllShortcuts().filter((s) => s.id.startsWith(category));
  }
}

// Global shortcuts manager instance
export const shortcutsManager = new KeyboardShortcutsManager();

// Hook to use keyboard shortcuts
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  deps: React.DependencyList = []
): void {
  useEffect(() => {
    // Register shortcuts
    shortcuts.forEach((shortcut) => shortcutsManager.register(shortcut));

    return () => {
      // Unregister shortcuts on cleanup
      shortcuts.forEach((shortcut) => shortcutsManager.unregister(shortcut.id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Hook to initialize global keyboard shortcuts
export function useGlobalKeyboardShortcuts(
  actions: {
    toggleLeftPanel: () => void;
    toggleRightPanel: () => void;
    goBack: () => void;
    focusTerminal: () => void;
    openCommandPalette: () => void;
    isCommandPaletteOpen: boolean;
    sidebarView?: string;
  }
): void {
  const actionsRef = useRef(actions);

  // Keep actions ref up to date
  useEffect(() => {
    actionsRef.current = actions;
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { isCommandPaletteOpen, sidebarView } = actionsRef.current;

      // Update manager context
      shortcutsManager.setContext({
        isTerminalFocused: isTerminalFocused(),
        isCommandPaletteOpen,
        isInputFocused: isInputElement(document.activeElement),
      });

      // Handle Escape key specially
      if (event.key === "Escape") {
        if (isCommandPaletteOpen) {
          // Close command palette first
          return;
        }
        if (sidebarView === "task") {
          event.preventDefault();
          actionsRef.current.goBack();
          return;
        }
      }

      // Don't process other shortcuts when command palette is open
      if (isCommandPaletteOpen) {
        return;
      }

      // Don't process shortcuts when typing in inputs (except terminal)
      if (isInputElement(document.activeElement) && !isTerminalFocused()) {
        return;
      }

      // Cmd/Ctrl + B: Toggle left panel
      if ((event.metaKey || event.ctrlKey) && event.key === "b" && !event.shiftKey) {
        event.preventDefault();
        actionsRef.current.toggleLeftPanel();
        return;
      }

      // Cmd/Ctrl + Shift + B: Toggle right panel
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "B") {
        event.preventDefault();
        actionsRef.current.toggleRightPanel();
        return;
      }

      // Cmd/Ctrl + Shift + K: Open command palette
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "K") {
        event.preventDefault();
        actionsRef.current.openCommandPalette();
        return;
      }

      // Cmd/Ctrl + K: Focus terminal (only when not in terminal)
      if ((event.metaKey || event.ctrlKey) && event.key === "k" && !event.shiftKey) {
        event.preventDefault();
        actionsRef.current.focusTerminal();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

// Format shortcut for display
export function formatShortcut(shortcut: string): string {
  if (typeof window === "undefined") return shortcut;

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  if (isMac) {
    return shortcut
      .replace("Ctrl+", "⌘")
      .replace("Alt+", "⌥")
      .replace("Shift+", "⇧")
      .replace("Cmd+", "⌘")
      .replace("Meta+", "⌘");
  }

  return shortcut.replace("Cmd+", "Ctrl+").replace("Meta+", "Ctrl+");
}

// Get all available shortcuts for help display
export function getAllShortcutsList(): Array<{
  category: string;
  shortcuts: Array<{ shortcut: string; description: string }>;
}> {
  return [
    {
      category: "导航",
      shortcuts: [
        { shortcut: "Esc", description: "返回上一级 / 关闭面板" },
        { shortcut: "Ctrl+K", description: "聚焦到 Terminal" },
      ],
    },
    {
      category: "视图",
      shortcuts: [
        { shortcut: "Ctrl+B", description: "切换左侧面板" },
        { shortcut: "Ctrl+Shift+B", description: "切换右侧面板" },
      ],
    },
    {
      category: "命令",
      shortcuts: [
        { shortcut: "Ctrl+Shift+K", description: "打开命令面板" },
      ],
    },
    {
      category: "Terminal",
      shortcuts: [
        { shortcut: "↑ / ↓", description: "浏览命令历史" },
        { shortcut: "Ctrl+C", description: "中断当前命令" },
        { shortcut: "Ctrl+A", description: "移动到行首" },
        { shortcut: "Ctrl+E", description: "移动到行尾" },
      ],
    },
  ];
}
