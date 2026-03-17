"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant for styling */
  variant?: "default" | "primary" | "danger" | "ghost";
}

/**
 * Button component with variant support
 *
 * Variants:
 * - default: Gray background with hover effect
 * - primary: Blue background for primary actions
 * - danger: Red background for destructive actions
 * - ghost: Transparent background with border
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", className = "", children, ...props }, ref) => {
    const baseStyles =
      "px-4 py-2 rounded-md font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variantStyles: Record<string, string> = {
      default:
        "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600",
      primary:
        "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600",
      danger:
        "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-500 dark:hover:bg-red-600",
      ghost:
        "bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800",
    };

    const classes = `${baseStyles} ${variantStyles[variant]} ${className}`;

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
