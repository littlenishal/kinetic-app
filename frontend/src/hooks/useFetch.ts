// frontend/src/hooks/useFetch.ts
import { useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import useLoading from './useLoading';

interface FetchState<T> {
  data: T | null;
  error: string | null;
}

interface FetchOptions {
  loadingMessage?: string;
  errorMessage?: string;
  successCallback?: (data: any) => void;
  requiresAuth?: boolean;
}

/**
 * A custom hook for making API requests with loading and error state management.
 * 
 * Usage:
 * ```typescript
 * const { 
 *   data, 
 *   error, 
 *   isLoading, 
 *   fetchData, 
 *   clearError 
 * } = useFetch<UserProfile[]>();
 * 
 * // Call fetchData with any fetch function that returns a Promise
 * useEffect(() => {
 *   fetchData(
 *     () => fetchUserProfiles(), 
 *     { loadingMessage: 'Loading profiles...' }
 *   );
 * }, [fetchData]);
 * 
 * // Or with inline function
 * const handleSubmit = async (formData) => {
 *   const result = await fetchData(
 *     async () => {
 *       const response = await api.post('/endpoint', formData);
 *       return response.data;
 *     },
 *     { 
 *       loadingMessage: 'Saving...',
 *       errorMessage: 'Failed to save data',
 *       successCallback: (data) => {
 *         console.log('Success:', data);
 *       }
 *     }
 *   );
 *   
 *   if (result) {
 *     // Success handling
 *   }
 * };
 * ```
 */
function useFetch<T>() {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    error: null
  });
  
  const { isLoading, loadingMessage, startLoading, stopLoading } = useLoading();

  // Clear any error message
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Reset the entire state
  const resetState = useCallback(() => {
    setState({ data: null, error: null });
  }, []);

  // Main fetch function
  const fetchData = useCallback(
    async <R = T>(
      fetchFn: () => Promise<R>,
      options: FetchOptions = {}
    ): Promise<R | null> => {
      const {
        loadingMessage = 'Loading...',
        errorMessage = 'An error occurred. Please try again.',
        successCallback,
        requiresAuth = false
      } = options;

      try {
        // Check authentication if required
        if (requiresAuth) {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            setState(prev => ({
              ...prev,
              error: 'Authentication required'
            }));
            return null;
          }
        }

        // Start loading
        startLoading(loadingMessage);
        
        // Clear previous error
        clearError();
        
        // Execute the fetch function
        const result = await fetchFn();
        
        // Update state with the result
        setState({
          data: result as unknown as T,
          error: null
        });
        
        // Call success callback if provided
        if (successCallback) {
          successCallback(result);
        }
        
        return result;
      } catch (error) {
        console.error('Fetch error:', error);
        
        // Extract error message
        const errorMsg = error instanceof Error 
          ? error.message 
          : errorMessage;
        
        // Update state with error
        setState(prev => ({
          ...prev,
          error: errorMsg
        }));
        
        return null;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, clearError]
  );

  return {
    data: state.data,
    error: state.error,
    isLoading,
    loadingMessage,
    fetchData,
    clearError,
    resetState
  };
}

export default useFetch;