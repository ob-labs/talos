"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui";
import Link from "next/link";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary catches errors in its component tree and displays a fallback UI.
 * In development, shows detailed error information including stack traces.
 * In production, shows a user-friendly error message.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Log error details for debugging
    const errorMessage = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "unknown",
    };

    // In development, log full error details
    if (process.env.NODE_ENV === "development") {
      console.error("Error details:", errorMessage);
    }

    // Store error in state for display
    this.setState({
      error,
      errorInfo,
    });

    // Log to file via API endpoint
    if (typeof window !== "undefined") {
      fetch("/api/logs/errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(errorMessage),
      }).catch((err) => {
        // If logging fails, just log to console
        console.warn("Failed to log error to server:", err);
      });
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDevelopment = process.env.NODE_ENV === "development";
      const { error, errorInfo } = this.state;

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950 px-4">
          <div className="max-w-2xl w-full">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8">
              {/* Error Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-red-600 dark:text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
              </div>

              {/* Error Title */}
              <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
                Something Went Wrong
              </h1>

              {/* Error Message */}
              <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
                {isDevelopment && error?.message
                  ? error.message
                  : "An unexpected error occurred. Please retry or contact support if the problem persists."}
              </p>

              {/* Development Mode: Show Error Details */}
              {isDevelopment && error && (
                <div className="mb-8">
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 hover:text-gray-900 dark:hover:text-gray-100">
                      Error Details (Development Only)
                    </summary>
                    <div className="mt-4 space-y-4">
                      {/* Error Stack */}
                      {error.stack && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Error Stack:
                          </h3>
                          <pre className="bg-gray-100 dark:bg-gray-800 rounded p-4 text-xs text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap">
                            {error.stack}
                          </pre>
                        </div>
                      )}

                      {/* Component Stack */}
                      {errorInfo?.componentStack && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Component Stack:
                          </h3>
                          <pre className="bg-gray-100 dark:bg-gray-800 rounded p-4 text-xs text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap">
                            {errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="primary"
                  onClick={this.handleReset}
                  className="w-full sm:w-auto"
                >
                  Retry
                </Button>
                <Link
                  href="/"
                  className="w-full sm:w-auto px-4 py-2 rounded-md font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 text-center"
                >
                  Go to Home
                </Link>
              </div>

              {/* Help Text */}
              {isDevelopment && (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
                  Check the console for more details about this error.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
