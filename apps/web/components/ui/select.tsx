"use client";

import { SelectHTMLAttributes, forwardRef, useId } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Label text for the select */
  label?: string;
  /** Error message to display */
  error?: string;
  /** Helper text to display below select */
  helperText?: string;
  /** Options for the select dropdown */
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}

/**
 * Select component for dropdowns
 *
 * Features:
 * - Optional label with proper association
 * - Error state with red border and error message
 * - Helper text for additional context
 * - Options array with value, label, and optional disabled state
 * - Full TypeScript support for all select attributes
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      className = "",
      id,
      "aria-invalid": ariaInvalid,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || `select-${generatedId.replace(/:/g, "")}`;
    const isError = !!error;
    const invalidProp = ariaInvalid ?? isError;

    const baseStyles =
      "w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800";

    const normalStyles =
      "border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:focus:border-blue-400 dark:focus:ring-blue-400";

    const errorStyles =
      "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-400 dark:focus:border-red-400 dark:focus:ring-red-400";

    const classes = `${baseStyles} ${isError ? errorStyles : normalStyles} ${className}`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={classes}
          aria-invalid={invalidProp}
          aria-describedby={
            error
              ? `${selectId}-error`
              : helperText
                ? `${selectId}-helper`
                : undefined
          }
          {...props}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p
            id={`${selectId}-error`}
            className="mt-1 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            id={`${selectId}-helper`}
            className="mt-1 text-sm text-gray-500 dark:text-gray-400"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
