export { ChatMessage } from "./chat-message";

export type { ChatMessageProps } from "./chat-message";

// ChatMessageData type (for task conversation display)
export interface ChatMessageData {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}
