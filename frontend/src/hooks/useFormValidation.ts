// frontend/src/hooks/useFormValidation.ts
import { useState, useCallback } from 'react';

// Validation rule types
export type ValidationRule<T> = {
  validate: (value: any, formData?: T) => boolean;
  message: string;
};

export type ValidationRules<T> = {
  [K in keyof T]?: ValidationRule<T>[];
};

/**
 * Custom hook for form validation.
 * 
 * Usage:
 * ```typescript
 * interface LoginForm {
 *   email: string;
 *   password: string;
 * }
 * 
 * const { errors, validateField, validateForm } = useFormValidation<LoginForm>({
 *   email: [
 *     {
 *       validate: (email) => Boolean(email),
 *       message: 'Email is required'
 *     },
 *     {
 *       validate: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
 *       message: 'Invalid email format'
 *     }
 *   ],
 *   password: [
 *     {
 *       validate: (password) => Boolean(password),
 *       message: 'Password is required'
 *     },
 *     {
 *       validate: (password) => password.length >= 8,
 *       message: 'Password must be at least 8 characters'
 *     }
 *   ]
 * });
 * 
 * // In a form change handler
 * const handleChange = (e) => {
 *   const { name, value } = e.target;
 *   setFormData({...formData, [name]: value});
 *   validateField(name, value, formData);
 * };
 * 
 * // On form submission
 * const handleSubmit = (e) => {
 *   e.preventDefault();
 *   const isValid = validateForm(formData);
 *   if (isValid) {
 *     submitForm(formData);
 *   }
 * };
 * ```
 */
function useFormValidation<T extends Record<string, any>>(validationRules: ValidationRules<T>) {
  // Store validation errors
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  // Validate a single field
  const validateField = useCallback(
    (fieldName: keyof T, value: any, formData?: T): boolean => {
      const fieldRules = validationRules[fieldName];

      if (!fieldRules) {
        // No validation rules for this field
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[fieldName];
          return newErrors;
        });
        return true;
      }

      // Find the first rule that fails
      const failedRule = fieldRules.find(rule => !rule.validate(value, formData));

      if (failedRule) {
        // Field validation failed
        setErrors(prev => ({
          ...prev,
          [fieldName]: failedRule.message
        }));
        return false;
      } else {
        // Field validation passed
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[fieldName];
          return newErrors;
        });
        return true;
      }
    },
    [validationRules]
  );

  // Validate the entire form
  const validateForm = useCallback(
    (formData: T): boolean => {
      const newErrors: Partial<Record<keyof T, string>> = {};
      let isValid = true;

      // Check each field with rules
      Object.keys(validationRules).forEach(key => {
        const fieldName = key as keyof T;
        const fieldRules = validationRules[fieldName];
        const fieldValue = formData[fieldName];

        if (fieldRules) {
          // Find the first rule that fails
          const failedRule = fieldRules.find(rule => !rule.validate(fieldValue, formData));

          if (failedRule) {
            newErrors[fieldName] = failedRule.message;
            isValid = false;
          }
        }
      });

      setErrors(newErrors);
      return isValid;
    },
    [validationRules]
  );

  // Reset all errors
  const resetErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    errors,
    validateField,
    validateForm,
    resetErrors
  };
}

export default useFormValidation;