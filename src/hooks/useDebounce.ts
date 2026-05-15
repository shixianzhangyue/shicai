import { useRef, useCallback } from 'react';

/**
 * Debounce hook for delaying function execution.
 * Returns a debounced version of the callback that delays execution by `delay` ms.
 * If called again before delay expires, the previous call is cancelled.
 */
export function useDebounce<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  return debouncedFn;
}

export default useDebounce;
