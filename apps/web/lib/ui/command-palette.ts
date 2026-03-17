"use client";

import { useEffect, useState, useCallback } from "react";

export interface Command {
  id: string;
  title: string;
  description?: string;
  shortcut?: string;
  category: CommandCategory;
  icon?: string;
  action: () => void;
  disabled?: boolean;
}

export type CommandCategory =
  | "navigation"
  | "execution"
  | "view"
  | "git"
  | "help"
  | "settings";

export interface CommandCategoryConfig {
  id: CommandCategory;
  title: string;
  priority: number;
}

export const COMMAND_CATEGORIES: CommandCategoryConfig[] = [
  { id: "navigation", title: "导航", priority: 1 },
  { id: "execution", title: "执行", priority: 2 },
  { id: "view", title: "视图", priority: 3 },
  { id: "git", title: "Git", priority: 4 },
  { id: "settings", title: "设置", priority: 5 },
  { id: "help", title: "帮助", priority: 6 },
];

// Command registry
class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private listeners: Set<() => void> = new Set();

  register(command: Command): void {
    this.commands.set(command.id, command);
    this.notifyListeners();
  }

  unregister(commandId: string): void {
    this.commands.delete(commandId);
    this.notifyListeners();
  }

  getCommand(id: string): Command | undefined {
    return this.commands.get(id);
  }

  getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  getCommandsByCategory(category: CommandCategory): Command[] {
    return this.getAllCommands().filter((cmd) => cmd.category === category);
  }

  searchCommands(query: string): Command[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return this.getAllCommands();

    return this.getAllCommands().filter((cmd) => {
      const searchText = `${cmd.title} ${cmd.description || ""}`.toLowerCase();
      return searchText.includes(lowerQuery);
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }
}

// Global command registry instance
export const commandRegistry = new CommandRegistry();

// Hook to use commands
export function useCommands(): Command[] {
  const [commands, setCommands] = useState<Command[]>([]);

  useEffect(() => {
    setCommands(commandRegistry.getAllCommands());
    return commandRegistry.subscribe(() => {
      setCommands(commandRegistry.getAllCommands());
    });
  }, []);

  return commands;
}

// Hook to search commands
export function useCommandSearch(query: string): Command[] {
  const [results, setResults] = useState<Command[]>([]);

  useEffect(() => {
    setResults(commandRegistry.searchCommands(query));
  }, [query]);

  return results;
}

// Hook for command palette visibility
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Keyboard shortcut: Cmd/Ctrl + Shift + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.shiftKey && e.key === "k") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape" && isOpen) {
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, toggle, close]);

  return { isOpen, open, close, toggle };
}

// Group commands by category
export function groupCommandsByCategory(commands: Command[]): Map<CommandCategory, Command[]> {
  const grouped = new Map<CommandCategory, Command[]>();

  commands.forEach((cmd) => {
    const list = grouped.get(cmd.category) || [];
    list.push(cmd);
    grouped.set(cmd.category, list);
  });

  // Sort each group by title
  grouped.forEach((list) => {
    list.sort((a, b) => a.title.localeCompare(b.title));
  });

  return grouped;
}

// Get sorted categories
export function getSortedCategories(): CommandCategoryConfig[] {
  return [...COMMAND_CATEGORIES].sort((a, b) => a.priority - b.priority);
}

// Default commands factory
export function createDefaultCommands(actions: {
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  goBack: () => void;
  focusTerminal: () => void;
  openSettings: () => void;
  showHelp: () => void;
}): Command[] {
  return [
    // Navigation
    {
      id: "nav.back",
      title: "返回上一级",
      description: "返回到上一个视图",
      shortcut: "Esc",
      category: "navigation",
      action: actions.goBack,
    },
    {
      id: "nav.terminal",
      title: "聚焦 Terminal",
      description: "将焦点移动到 Terminal 输入框",
      shortcut: "Ctrl+K",
      category: "navigation",
      action: actions.focusTerminal,
    },

    // View
    {
      id: "view.toggleLeft",
      title: "切换左侧面板",
      description: "展开或折叠左侧面板",
      shortcut: "Ctrl+B",
      category: "view",
      action: actions.toggleLeftPanel,
    },
    {
      id: "view.toggleRight",
      title: "切换右侧面板",
      description: "展开或折叠右侧面板",
      shortcut: "Ctrl+Shift+B",
      category: "view",
      action: actions.toggleRightPanel,
    },

    // Settings
    {
      id: "settings.open",
      title: "打开设置",
      description: "打开应用设置",
      category: "settings",
      action: actions.openSettings,
    },

    // Help
    {
      id: "help.show",
      title: "显示帮助",
      description: "显示帮助信息",
      shortcut: "?",
      category: "help",
      action: actions.showHelp,
    },
  ];
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
      .replace("Cmd+", "⌘");
  }

  return shortcut.replace("Cmd+", "Ctrl+");
}
