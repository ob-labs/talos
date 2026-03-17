"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * 404 Not Found Page
 *
 * This page is automatically rendered by Next.js when a route is not found.
 * It provides a user-friendly error message with navigation options.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      {/* Error Icon */}
      <div className="mb-6 text-6xl">🔍</div>

      {/* Error Message */}
      <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        Page Not Found
      </h1>

      <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 text-center max-w-md">
        Sorry, we couldn't find the page you're looking for. It may have been moved or deleted.
      </p>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Link
          href="/"
          className="px-4 py-2 rounded-md font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Go to Home
        </Link>
        <Button
          variant="ghost"
          onClick={() => window.history.back()}
        >
          Go Back
        </Button>
      </div>

      {/* Help Text */}
      <p className="mt-8 text-sm text-gray-500 dark:text-gray-500">
        If you believe this is an error, please contact the system administrator.
      </p>
    </div>
  );
}
