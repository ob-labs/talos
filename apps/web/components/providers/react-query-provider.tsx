'use client';

/**
 * React Query Provider 组件
 * React Query Provider Component
 *
 * 必须是客户端组件 ('use client')，因为 QueryClientProvider 使用 React context
 * Must be a client component ('use client') as QueryClientProvider uses React context
 */

import { QueryClientProvider as QCProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/api/query-client";

export function QueryClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <QCProvider client={queryClient}>{children}</QCProvider>;
}
