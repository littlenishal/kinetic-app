// frontend/src/hooks/index.ts
// Export all hooks for easier imports

export { default as useConversation } from './useConversation';
export { default as useEventManagement } from './useEventManagement';
export { default as useFormValidation } from './useFormValidation';
export { default as useFetch } from './useFetch';
export { default as useLoading } from './useLoading';
export { default as useLocalStorage } from './useLocalStorage';

// Also export types from hooks
export type { ValidationRule, ValidationRules } from './useFormValidation';