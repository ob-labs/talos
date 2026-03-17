import { useEffect, useRef } from 'react';

/**
 * useInterval Hook - Periodic execution with React hooks
 * useInterval Hook - 使用 React hooks 的周期性执行
 *
 * Based on the pattern from Dan Abramov's blog:
 * https://overreacted.io/making-setinterval-declarative-with-react-hooks/
 *
 * @param callback - Function to execute periodically
 * @param delay - Interval in milliseconds (null to stop)
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef<() => void>(undefined as any);

  // Remember the latest callback
  // 记住最新的回调函数
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  // 设置定时器
  useEffect(() => {
    function tick() {
      savedCallback.current?.();
    }

    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}
