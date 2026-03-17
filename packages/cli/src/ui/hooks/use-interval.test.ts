/**
 * useInterval Hook Tests
 * useInterval Hook 测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInterval } from './use-interval';

describe('useInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call callback at specified interval', () => {
    const callback = vi.fn();
    renderHook(() => useInterval(callback, 1000));

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should not call callback when delay is null', () => {
    const callback = vi.fn();
    renderHook(() => useInterval(callback, null));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should use the latest callback when callback changes', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { rerender } = renderHook(
      ({ callback, delay }) => useInterval(callback, delay),
      {
        initialProps: { callback: callback1, delay: 1000 },
      }
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).not.toHaveBeenCalled();

    rerender({ callback: callback2, delay: 1000 });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('should clear interval on unmount', () => {
    const callback = vi.fn();
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() => useInterval(callback, 1000));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback).toHaveBeenCalledTimes(1);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Callback should not be called again after unmount
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should restart interval when delay changes', () => {
    const callback = vi.fn();
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { rerender } = renderHook(
      ({ callback, delay }) => useInterval(callback, delay),
      {
        initialProps: { callback, delay: 1000 },
      }
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    rerender({ callback, delay: 500 });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should handle rapid delay changes', () => {
    const callback = vi.fn();

    const { rerender } = renderHook(
      ({ callback, delay }) => useInterval(callback, delay),
      {
        initialProps: { callback, delay: 1000 },
      }
    );

    // Change delay multiple times rapidly
    rerender({ callback, delay: 500 });
    rerender({ callback, delay: 100 });
    rerender({ callback, delay: 200 });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Should have been called at least once
    expect(callback).toHaveBeenCalled();
  });

  it('should handle zero delay gracefully', () => {
    const callback = vi.fn();

    renderHook(() => useInterval(callback, 0));

    act(() => {
      vi.advanceTimersByTime(0);
    });

    // Zero delay should still work (uses setInterval with 0)
    expect(callback).toHaveBeenCalled();
  });
});
