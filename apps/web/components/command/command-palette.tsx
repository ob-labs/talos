"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  useCommandPalette,
  useCommandSearch,
  groupCommandsByCategory,
  getSortedCategories,
  formatShortcut,
  type Command as CommandType,
} from "@/lib/ui/command-palette";
import { Search, Terminal, Layout, GitBranch, Settings, HelpCircle, Navigation } from "lucide-react";

interface CommandPaletteProps {
  onCommandExecute?: (command: CommandType) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  navigation: <Navigation className="w-4 h-4" />,
  execution: <Terminal className="w-4 h-4" />,
  view: <Layout className="w-4 h-4" />,
  git: <GitBranch className="w-4 h-4" />,
  settings: <Settings className="w-4 h-4" />,
  help: <HelpCircle className="w-4 h-4" />,
};

const categoryLabels: Record<string, string> = {
  navigation: "Navigation",
  execution: "Execute",
  view: "View",
  git: "Git",
  settings: "Settings",
  help: "Help",
};

export function CommandPalette({ onCommandExecute }: CommandPaletteProps) {
  const { isOpen, close } = useCommandPalette();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useCommandSearch(searchQuery);
  const groupedCommands = groupCommandsByCategory(commands);
  const sortedCategories = getSortedCategories().filter((cat) =>
    groupedCommands.has(cat.id)
  );

  // Flatten commands for keyboard navigation
  const flatCommands: CommandType[] = [];
  sortedCategories.forEach((cat) => {
    const catCommands = groupedCommands.get(cat.id);
    if (catCommands) {
      flatCommands.push(...catCommands);
    }
  });

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Execute command callback
  const executeCommand = useCallback((command: CommandType) => {
    command.action();
    onCommandExecute?.(command);
    close();
  }, [onCommandExecute, close]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < flatCommands.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          const command = flatCommands[selectedIndex];
          if (command && !command.disabled) {
            executeCommand(command);
          }
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, flatCommands, selectedIndex, executeCommand]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    selectedElement?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  let globalIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={close}
      />

      {/* Command Palette */}
      <div className="relative w-full max-w-[640px] bg-gradient-to-b from-[#1e1e1e] to-[#1a1a1a] rounded-xl shadow-2xl border border-[#30363d] overflow-hidden ring-1 ring-white/5">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#30363d] bg-[#252526]/50">
          <Search className="w-5 h-5 text-[#8b949e]" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-[#e6edf3] placeholder-[#6e7681] outline-none text-sm"
          />
          <kbd className="px-2 py-1 text-xs bg-[#30363d] text-[#8b949e] rounded-md border border-[#3c3c3c]">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div
          ref={listRef}
          className="max-h-[400px] overflow-y-auto py-2"
        >
          {commands.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#8b949e] text-sm">
              No matching commands found
            </div>
          ) : (
            sortedCategories.map((category) => {
              const catCommands = groupedCommands.get(category.id);
              if (!catCommands || catCommands.length === 0) return null;

              return (
                <div key={category.id} className="mb-2">
                  {/* Category Header */}
                  <div className="px-4 py-1.5 text-xs font-medium text-[#8b949e] flex items-center gap-2">
                    {categoryIcons[category.id]}
                    {categoryLabels[category.id]}
                  </div>

                  {/* Commands */}
                  {catCommands.map((command) => {
                    const index = globalIndex++;
                    const isSelected = index === selectedIndex;

                    return (
                      <button
                        key={command.id}
                        data-index={index}
                        onClick={() => executeCommand(command)}
                        disabled={command.disabled}
                        className={`
                          w-full px-4 py-2.5 flex items-center gap-3 text-left
                          transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]
                          ${
                            isSelected
                              ? "bg-gradient-to-r from-[#6366f1] to-[#5558e0] shadow-inner"
                              : "hover:bg-[#30363d]"
                          }
                          ${command.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-[0.99]"}
                        `}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-[#e6edf3] truncate">
                            {command.title}
                          </div>
                          {command.description && (
                            <div className="text-xs text-[#8b949e] truncate">
                              {command.description}
                            </div>
                          )}
                        </div>
                        {command.shortcut && (
                          <kbd
                            className={`
                              px-2 py-0.5 text-xs rounded-md border
                              ${
                                isSelected
                                  ? "bg-[#4f46e5]/80 border-[#6366f1] text-white"
                                  : "bg-[#30363d] border-[#3c3c3c] text-[#8b949e]"
                              }
                            `}
                          >
                            {formatShortcut(command.shortcut)}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#30363d] flex items-center justify-between text-xs text-[#8b949e] bg-[#252526]/30">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-[#30363d] rounded-md border border-[#3c3c3c]">↑↓</kbd>
              Navigation
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-[#30363d] rounded-md border border-[#3c3c3c]">↵</kbd>
              Execute
            </span>
          </div>
          <span className="text-[#6e7681]">
            {commands.length} command(s)
          </span>
        </div>
      </div>
    </div>
  );
}
