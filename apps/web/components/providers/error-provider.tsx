"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { ReactNode } from "react";

interface ErrorProviderProps {
  children: ReactNode;
}

/**
 * ErrorProvider wraps the application with ErrorBoundary
 * to catch and handle errors gracefully.
 */
export function ErrorProvider({ children }: ErrorProviderProps) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
