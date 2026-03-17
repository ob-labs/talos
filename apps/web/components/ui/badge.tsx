import { HTMLAttributes, forwardRef } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Badge color variant */
  variant?: "gray" | "blue" | "green" | "yellow" | "red";
}

/**
 * Badge component for status indicators
 *
 * Variants:
 * - gray: Neutral status (default)
 * - blue: Info or active status
 * - green: Success or completed status
 * - yellow: Warning or pending status
 * - red: Error or failed status
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "gray", className = "", children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";

    const variantStyles: Record<string, string> = {
      gray:
        "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
      blue:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      green:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      yellow:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      red:
        "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };

    const classes = `${baseStyles} ${variantStyles[variant]} ${className}`;

    return (
      <span ref={ref} className={classes} {...props}>
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";
