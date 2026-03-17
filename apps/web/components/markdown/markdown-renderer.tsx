import { CodeBlock } from "./code-block";

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * MarkdownRenderer component for rendering Markdown content
 * Features:
 * - Code block parsing and rendering
 * - Header rendering (#, ##, ###)
 * - Bold text rendering (**text**)
 * - List rendering (-, *, 1.)
 * - Paragraph and line break handling
 *
 * Extracted from chat-message.tsx renderContent logic
 */
export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  // Split by code blocks
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const parts: Array<{
    type: "text" | "code";
    language?: string;
    content: string;
  }> = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
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
  if (lastIndex < content.length) {
    parts.push({
      type: "text",
      content: content.slice(lastIndex),
    });
  }

  return (
    <div className={className}>
      {parts.map((part, index) => {
        if (part.type === "code") {
          return <CodeBlock key={`code-${index}`} language={part.language || "text"} code={part.content} />;
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
      })}
    </div>
  );
}
