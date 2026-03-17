/**
 * React Query 配置
 * React Query Configuration
 *
 * 提供 QueryClient 实例用于数据获取和缓存
 * Provides QueryClient instance for data fetching and caching
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * React Query Client 实例
 * React Query Client instance
 *
 * 配置说明：
 * - staleTime: 0 - 数据立即过期，确保每次轮询都获取新数据
 * - retry: 1 - 失败后重试 1 次
 * - refetchOnWindowFocus: false - 窗口聚焦时不重新获取数据
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
