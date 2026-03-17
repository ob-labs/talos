"use client";

import { useEffect, useRef } from "react";
import { ChatMessage } from "@/components/chat";

export interface StoryMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface StoryConversationProps {
  conversation: string; // Raw conversation string to parse
  storyId: string;
  autoScroll?: boolean;
}

/**
 * StoryConversation component for displaying story conversation history
 * Parses raw output and displays messages with user/AI distinction
 */
export function StoryConversation({
  conversation,
  storyId,
  autoScroll = true,
}: StoryConversationProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Parse conversation from raw output
  const parseConversation = (raw: string): StoryMessage[] => {
    const messages: StoryMessage[] = [];

    // Try to parse role markers from conversation
    // Format: "User:", "Assistant:", "Claude:"
    const lines = raw.split("\n");
    let currentRole: "user" | "assistant" | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      // Check for role markers
      if (/^(User:|user:)/.test(line)) {
        // Save previous message if exists
        if (currentRole && currentContent.length > 0) {
          messages.push({
            role: currentRole,
            content: currentContent.join("\n").trim(),
            timestamp: Date.now(),
          });
        }
        currentRole = "user";
        currentContent = [];
      } else if (/^(Assistant:|Claude:|assistant:)/.test(line)) {
        // Save previous message if exists
        if (currentRole && currentContent.length > 0) {
          messages.push({
            role: currentRole,
            content: currentContent.join("\n").trim(),
            timestamp: Date.now(),
          });
        }
        currentRole = "assistant";
        currentContent = [];
      } else if (currentRole) {
        currentContent.push(line);
      }
    }

    // Save last message
    if (currentRole && currentContent.length > 0) {
      messages.push({
        role: currentRole,
        content: currentContent.join("\n").trim(),
        timestamp: Date.now(),
      });
    }

    // If no messages parsed, treat entire conversation as assistant message
    if (messages.length === 0 && raw.trim()) {
      messages.push({
        role: "assistant",
        content: raw.trim(),
        timestamp: Date.now(),
      });
    }

    return messages;
  };

  const messages = parseConversation(conversation);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  if (messages.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        No conversation history available
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
      {messages.map((message, index) => (
        <ChatMessage
          key={`${storyId}-${index}`}
          role={message.role}
          content={message.content}
          timestamp={message.timestamp}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
