"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement>;

/**
 * Card component for content grouping
 * Provides a consistent container with padding and shadow
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", children, ...props }, ref) => {
    const baseStyles =
      "bg-white dark:bg-gray-800/50 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 backdrop-blur-sm";

    const classes = `${baseStyles} ${className}`;

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
