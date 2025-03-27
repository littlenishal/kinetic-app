// frontend/src/components/FormField.tsx
import React, { useId } from 'react';
import '../styles/FormField.css';

interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'textarea' | 'select';
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  required?: boolean;
  error?: string;
  placeholder?: string;
  children?: React.ReactNode; // For select options
  disabled?: boolean;
  className?: string;
  min?: string | number;
  max?: string | number;
}

/**
 * Reusable form field component with accessible label, error handling, and consistent styling.
 * 
 * Usage:
 * ```tsx
 * <FormField
 *   label="Email"
 *   name="email"
 *   type="email"
 *   value={formData.email}
 *   onChange={handleChange}
 *   required
 *   error={errors.email}
 * />
 * 
 * <FormField
 *   label="Select Family"
 *   name="familyId"
 *   type="select"
 *   value={selectedFamily}
 *   onChange={handleFamilyChange}
 *   required
 * >
 *   <option value="">Select a family</option>
 *   {families.map(family => (
 *     <option key={family.id} value={family.id}>{family.name}</option>
 *   ))}
 * </FormField>
 * ```
 */
const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  required = false,
  error,
  placeholder,
  children,
  disabled = false,
  className = '',
  min,
  max,
}) => {
  const id = useId();
  const fieldId = `${name}-${id}`;
  const hasError = !!error;

  const renderField = () => {
    switch (type) {
      case 'textarea':
        return (
          <textarea
            id={fieldId}
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            placeholder={placeholder}
            disabled={disabled}
            className={`form-textarea ${hasError ? 'has-error' : ''} ${className}`}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${fieldId}-error` : undefined}
          />
        );
      case 'select':
        return (
          <select
            id={fieldId}
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
            className={`form-select ${hasError ? 'has-error' : ''} ${className}`}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${fieldId}-error` : undefined}
          >
            {children}
          </select>
        );
      default:
        return (
          <input
            id={fieldId}
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            placeholder={placeholder}
            disabled={disabled}
            className={`form-input ${hasError ? 'has-error' : ''} ${className}`}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${fieldId}-error` : undefined}
            min={min}
            max={max}
          />
        );
    }
  };

  return (
    <div className="form-field">
      <label htmlFor={fieldId} className={required ? 'required' : ''}>
        {label}
      </label>
      {renderField()}
      {hasError && (
        <div id={`${fieldId}-error`} className="error-message" aria-live="polite">
          {error}
        </div>
      )}
    </div>
  );
};

export default FormField;