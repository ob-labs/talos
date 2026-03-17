import type { HTMLAttributes } from "react";

export interface MarkdownContentProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * MarkdownContent container component
 * Provides consistent styling for Markdown content using Tailwind's prose plugin
 * Features:
 * - Responsive typography
 * - Dark mode support
 * - Consistent spacing and visual hierarchy
 */
export function MarkdownContent({ children, className = "" }: MarkdownContentProps) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      {children}
    </div>
  );
}
