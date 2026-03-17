"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export interface CodeBlockProps {
  language: string;
  code: string;
}

/**
 * CodeBlock component for displaying code blocks with syntax highlighting
 * Features:
 * - Language label display
 * - One-click copy button with feedback
 * - Dark mode support
 */
export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-2">
      <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-900 px-4 py-1 rounded-t-lg border border-gray-300 dark:border-gray-600">
        <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          aria-label="复制代码"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>已复制!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-b-lg overflow-x-auto border border-t-0 border-gray-300 dark:border-gray-600">
        <code className="text-sm text-gray-800 dark:text-gray-200">
          {code}
        </code>
      </pre>
    </div>
  );
}
