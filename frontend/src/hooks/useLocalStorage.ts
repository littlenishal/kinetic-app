// frontend/src/hooks/useLocalStorage.ts
import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for using localStorage with automatic JSON serialization/deserialization.
 * Supports storing and retrieving objects and primitive values.
 * 
 * Usage:
 * ```typescript
 * // Simple value
 * const [theme, setTheme] = useLocalStorage('theme', 'light');
 * 
 * // Change the value (persists through page refreshes)
 * setTheme('dark');
 * 
 * // Object value with TypeScript
 * interface UserSettings {
 *   notifications: boolean;
 *   language: string;
 * }
 * 
 * const [settings, setSettings] = useLocalStorage<UserSettings>(
 *   'userSettings',
 *   { notifications: true, language: 'en' }
 * );
 * 
 * // Update a specific property
 * setSettings(prev => ({ ...prev, notifications: false }));
 * 
 * // Remove from storage
 * setSettings(null);
 * ```
 */
function useLocalStorage<T>(key: string, initialValue: T) {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If error also return initialValue
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update local storage when the state changes
  useEffect(() => {
    try {
      if (storedValue === null || storedValue === undefined) {
        // Remove the item from storage if value is null or undefined
        window.localStorage.removeItem(key);
      } else {
        // Save state to localStorage
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  // Wrap the setState function to handle special cases
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    setStoredValue(prev => {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(prev) : value;
      return valueToStore;
    });
  }, []);

  // Remove the item from localStorage
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue] as const;
}

export default useLocalStorage;