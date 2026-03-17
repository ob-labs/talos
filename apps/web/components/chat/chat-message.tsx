"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

export interface ChatMessageProps extends HTMLAttributes<HTMLDivElement> {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

/**
 * ChatMessage component for displaying chat messages
 * Shows user/AI messages with different styling and Markdown rendering
 */
export const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(
  ({ role, content, timestamp, className = "", ...props }, ref) => {
    const isUser = role === "user";
    const formattedTime = timestamp
      ? new Date(timestamp).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

    // Simple Markdown-like rendering
    const renderContent = (text: string) => {
      // Split by code blocks
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      const parts: Array<{
        type: "text" | "code";
        language?: string;
        content: string;
      }> = [];
      let lastIndex = 0;
      let match;

      while ((match = codeBlockRegex.exec(text)) !== null) {
        // Add text before code block
        if (match.index > lastIndex) {
          parts.push({
            type: "text",
            content: text.slice(lastIndex, match.index),
          });
        }
        // Add code block
        parts.push({
          type: "code",
          language: match[1] || "text",
          content: match[2],
        });
        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < text.length) {
        parts.push({
          type: "text",
          content: text.slice(lastIndex),
        });
      }

      return parts.map((part, index) => {
        if (part.type === "code") {
          return (
            <div key={`code-${index}`} className="relative my-2">
              <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-900 px-4 py-1 rounded-t-lg border border-gray-300 dark:border-gray-600">
                <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                  {part.language}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(part.content)}
                  className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Copy
                </button>
              </div>
              <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-b-lg overflow-x-auto border border-t-0 border-gray-300 dark:border-gray-600">
                <code className="text-sm text-gray-800 dark:text-gray-200">
                  {part.content}
                </code>
              </pre>
            </div>
          );
        }

        // Render markdown-like text
        const lines = part.content.split("\n");
        return (
          <div key={`text-${index}`} className="prose prose-sm dark:prose-invert max-w-none">
            {lines.map((line, lineIndex) => {
              // Headers
              if (line.startsWith("### ")) {
                return (
                  <h3 key={lineIndex} className="text-lg font-semibold mt-4 mb-2">
                    {line.slice(4)}
                  </h3>
                );
              }
              if (line.startsWith("## ")) {
                return (
                  <h2 key={lineIndex} className="text-xl font-semibold mt-4 mb-2">
                    {line.slice(3)}
                  </h2>
                );
              }
              if (line.startsWith("# ")) {
                return (
                  <h1 key={lineIndex} className="text-2xl font-bold mt-4 mb-2">
                    {line.slice(2)}
                  </h1>
                );
              }

              // Bold text
              if (line.startsWith("**") && line.includes("**")) {
                const parts = line.split("**");
                return (
                  <p key={lineIndex} className="my-1">
                    {parts.map((part, i) =>
                      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                    )}
                  </p>
                );
              }

              // Bullet points
              if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
                return (
                  <li key={lineIndex} className="ml-4 my-1">
                    {line.trim().slice(2)}
                  </li>
                );
              }

              // Numbered list
              if (/^\d+\.\s/.test(line.trim())) {
                return (
                  <li key={lineIndex} className="ml-4 my-1 list-decimal">
                    {line.trim().replace(/^\d+\.\s/, "")}
                  </li>
                );
              }

              // Regular paragraph
              if (line.trim()) {
                return (
                  <p key={lineIndex} className="my-1">
                    {line}
                  </p>
                );
              }

              return <br key={lineIndex} />;
            })}
          </div>
        );
      });
    };

    return (
      <div
        ref={ref}
        className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4 ${className}`}
        {...props}
      >
        <div
          className={`flex max-w-[80%] flex-col ${
            isUser ? "items-end" : "items-start"
          }`}
        >
          <div
            className={`px-4 py-2 rounded-lg ${
              isUser
                ? "bg-blue-500 text-white rounded-br-none"
                : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none"
            }`}
          >
            {renderContent(content)}
          </div>
          {formattedTime && (
            <span
              className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${
                isUser ? "mr-1" : "ml-1"
              }`}
            >
              {formattedTime}
            </span>
          )}
        </div>
      </div>
    );
  }
);

ChatMessage.displayName = "ChatMessage";
