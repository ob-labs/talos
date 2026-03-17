"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "./card";

export interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * CollapsibleSection component for creating collapsible content sections
 * Features:
 * - Expand/collapse with animation
 * - Icon rotation effect
 * - Configurable default state
 * - Smooth height transitions
 *
 * Usage:
 *   <CollapsibleSection title="描述" defaultOpen={true} icon={<Icon />}>
 *     <Content />
 *   </CollapsibleSection>
 */
export function CollapsibleSection({
  title,
  defaultOpen = true,
  icon,
  children,
  className = "",
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={className}>
      <div className="space-y-3">
        {/* Header */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg px-3 py-2 transition-colors"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2">
            {icon && <div className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>{icon}</div>}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
          </div>
          <ChevronRight
            className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 flex-shrink-0 ${
              isOpen ? "rotate-90" : ""
            }`}
          />
        </button>

        {/* Content */}
        <div
          className={`overflow-hidden transition-all duration-200 ease-in-out ${
            isOpen ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="px-3 pb-3">
            {children}
          </div>
        </div>
      </div>
    </Card>
  );
}
