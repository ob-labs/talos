/**
 * ErrorBoundary Component Tests
 * ErrorBoundary 组件测试
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { ErrorBoundary } from './error-boundary';

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Component that renders children normally
const NormalComponent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div>{children}</div>;
};

describe('ErrorBoundary', () => {
  describe('when no error occurs', () => {
    it('should render children normally', () => {
      const { lastFrame } = render(
        <ErrorBoundary>
          <NormalComponent>Test content</NormalComponent>
        </ErrorBoundary>
      );
      const output = lastFrame();

      expect(output).toContain('Test content');
    });

    it('should not render error UI', () => {
      const { lastFrame } = render(
        <ErrorBoundary>
          <NormalComponent>No error here</NormalComponent>
        </ErrorBoundary>
      );
      const output = lastFrame();

      expect(output).not.toContain('❌ Error');
      expect(output).not.toContain('错误');
    });
  });

  describe('when an error occurs', () => {
    it('should catch rendering errors and display error UI', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { lastFrame } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      const output = lastFrame();

      expect(output).toContain('❌ Error');
      expect(output).toContain('错误');
      expect(output).toContain('Something went wrong');
      expect(output).toContain('出现了问题');

      consoleErrorSpy.mockRestore();
    });

    it('should display the error message', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { lastFrame } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      const output = lastFrame();

      expect(output).toContain('Test error');

      consoleErrorSpy.mockRestore();
    });

    it('should log error to console', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'ErrorBoundary caught an error / ErrorBoundary 捕获到错误:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should call onError callback if provided', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));

      consoleErrorSpy.mockRestore();
    });
  });

  describe('with custom fallback', () => {
    it('should render custom fallback UI when error occurs', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const customFallback = <div>Custom error message</div>;

      const { lastFrame } = render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>
      );
      const output = lastFrame();

      expect(output).toContain('Custom error message');
      expect(output).not.toContain('Something went wrong');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('error recovery', () => {
    it('should not render children after error has occurred', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { rerender, lastFrame } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      let output = lastFrame();
      expect(output).toContain('❌ Error');

      // Try to render without error - should still show error UI
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      output = lastFrame();
      expect(output).toContain('❌ Error');
      expect(output).not.toContain('No error');

      consoleErrorSpy.mockRestore();
    });
  });
});
