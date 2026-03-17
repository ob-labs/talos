"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * 500 Error Page
 *
 * This page is automatically rendered by Next.js when an unhandled error occurs
 * in a server component or during server-side rendering.
 *
 * @param error - The error object (automatically provided by Next.js)
 * @param reset - Function to reset the error boundary and retry
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log the error to console for debugging
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      {/* Error Icon */}
      <div className="mb-6 text-6xl">⚠️</div>

      {/* Error Message */}
      <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        Something Went Wrong
      </h1>

      <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 text-center max-w-md">
        We apologize for the inconvenience. An unexpected error occurred.
      </p>

      {/* Error Details (Development Only) */}
      {isDevelopment && error.message && (
        <div className="mb-8 w-full max-w-2xl">
          <details className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <summary className="cursor-pointer font-semibold text-red-900 dark:text-red-300 mb-2">
              Error Details
            </summary>
            <div className="mt-2 space-y-2">
              <p className="text-sm text-red-800 dark:text-red-400 font-mono break-words">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-red-700 dark:text-red-500 font-mono">
                  Error ID: {error.digest}
                </p>
              )}
              {error.stack && (
                <pre className="text-xs text-red-700 dark:text-red-500 overflow-x-auto whitespace-pre-wrap">
                  {error.stack}
                </pre>
              )}
            </div>
          </details>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button variant="primary" onClick={reset}>
          Reload Page
        </Button>
        <Link
          href="/"
          className="px-4 py-2 rounded-md font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Go to Home
        </Link>
      </div>

      {/* Help Text */}
      <p className="mt-8 text-sm text-gray-500 dark:text-gray-500">
        If the problem persists, please contact the system administrator.
      </p>
    </div>
  );
}
