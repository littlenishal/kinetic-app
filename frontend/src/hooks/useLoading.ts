// frontend/src/hooks/useLoading.ts
import { useState, useCallback } from 'react';

/**
 * A custom hook for managing loading states with descriptive messages.
 * 
 * Usage:
 * ```
 * const { isLoading, loadingMessage, startLoading, stopLoading, withLoading } = useLoading();
 * 
 * // Direct usage
 * startLoading('Saving data...');
 * await saveData();
 * stopLoading();
 * 
 * // Wrapper function usage
 * const result = await withLoading(
 *   () => fetchData(),
 *   'Fetching data...'
 * );
 * ```
 */
export function useLoading(initialState = false, initialMessage = '') {
  const [isLoading, setIsLoading] = useState<boolean>(initialState);
  const [loadingMessage, setLoadingMessage] = useState<string>(initialMessage);

  // Start loading with an optional message
  const startLoading = useCallback((message = '') => {
    setIsLoading(true);
    if (message) {
      setLoadingMessage(message);
    }
  }, []);

  // Stop loading and clear the message
  const stopLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingMessage('');
  }, []);

  // Execute a function with loading state management
  const withLoading = useCallback(
    async <T>(
      fn: () => Promise<T>, 
      message = ''
    ): Promise<T> => {
      try {
        startLoading(message);
        const result = await fn();
        return result;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading]
  );

  return {
    isLoading,
    loadingMessage,
    startLoading,
    stopLoading,
    withLoading
  };
}

export default useLoading;