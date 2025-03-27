// frontend/src/components/LoadingSpinner.tsx
import React from 'react';
import '../styles/LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

/**
 * Consistent loading indicator component that can be used throughout the application.
 * 
 * Usage:
 * ```tsx
 * // Simple spinner
 * <LoadingSpinner />
 * 
 * // Spinner with custom message
 * <LoadingSpinner message="Loading events..." />
 * 
 * // Full screen overlay spinner
 * <LoadingSpinner fullScreen message="Processing your request..." />
 * 
 * // Small spinner inline with text
 * <button disabled={isLoading}>
 *   {isLoading ? <><LoadingSpinner size="small" /> Loading...</> : 'Submit'}
 * </button>
 * ```
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  message,
  fullScreen = false,
  className = '',
}) => {
  // Determine spinner container class
  const containerClass = fullScreen
    ? 'loading-spinner-fullscreen'
    : 'loading-spinner-container';

  // Determine spinner size class
  const spinnerSizeClass = `loading-spinner-${size}`;

  return (
    <div className={`${containerClass} ${className}`} role="status">
      <div className={`loading-spinner ${spinnerSizeClass}`}></div>
      {message && <p className="loading-message">{message}</p>}
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default LoadingSpinner;