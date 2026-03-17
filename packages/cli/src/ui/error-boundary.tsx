import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Text } from 'ink';

export interface ErrorBoundaryProps {
  /** Children to render / 要渲染的子组件 */
  children: ReactNode;
  /** Fallback component to render on error / 错误时渲染的回退组件 */
  fallback?: ReactNode;
  /** Callback when error is caught / 捕获错误时的回调 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export interface ErrorBoundaryState {
  /** Whether an error has occurred / 是否发生错误 */
  hasError: boolean;
  /** The error that occurred / 发生的错误 */
  error?: Error;
}

/**
 * ErrorBoundary Component - Catches JavaScript errors anywhere in the child component tree
 * ErrorBoundary 组件 - 捕获子组件树中任何位置的 JavaScript 错误
 *
 * Features:
 * - Catches rendering errors and displays a friendly error message
 * - Logs errors to console for debugging
 * - Provides optional error callback for custom error handling
 * - Prevents the entire UI from crashing due to a single component error
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    // 更新状态以便下次渲染显示回退 UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console for debugging
    // 记录错误到控制台以便调试
    console.error('ErrorBoundary caught an error / ErrorBoundary 捕获到错误:');
    console.error('Error / 错误:', error);
    console.error('Error Info / 错误信息:', errorInfo);

    // Call the error callback if provided
    // 如果提供了错误回调，则调用它
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      // 如果提供了自定义回退组件，则使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      // 默认错误 UI
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="red">
            ❌ Error / 错误
          </Text>
          <Text color="gray">
            Something went wrong / 出现了问题
          </Text>
          {this.state.error && (
            <Text color="gray" dimColor>
              {this.state.error.message}
            </Text>
          )}
          <Text color="gray">
            Check the logs for details / 查看日志了解详情
          </Text>
        </Box>
      );
    }

    return this.props.children;
  }
}
