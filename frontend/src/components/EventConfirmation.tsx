// frontend/src/components/EventConfirmation.tsx
import React, { useEffect } from 'react';
import '../styles/EventConfirmation.css';

interface EventConfirmationProps {
  type: 'created' | 'updated' | 'deleted';
  eventTitle: string;
  onDismiss: () => void;
  autoDismissTime?: number; // In milliseconds
}

const EventConfirmation: React.FC<EventConfirmationProps> = ({
  type,
  eventTitle,
  onDismiss,
  autoDismissTime = 3000 // Default to 3 seconds
}) => {
  // Auto-dismiss after specified time
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, autoDismissTime);
    
    // Clean up timer on unmount
    return () => clearTimeout(timer);
  }, [onDismiss, autoDismissTime]);
  
  const getMessage = () => {
    switch (type) {
      case 'created':
        return `Event "${eventTitle}" has been added to your calendar`;
      case 'updated':
        return `Event "${eventTitle}" has been updated`;
      case 'deleted':
        return `Event "${eventTitle}" has been deleted`;
      default:
        return `Event "${eventTitle}" has been processed`;
    }
  };
  
  const getIcon = () => {
    switch (type) {
      case 'created':
        return '✅';
      case 'updated':
        return '✓';
      case 'deleted':
        return '🗑️';
      default:
        return '✓';
    }
  };
  
  return (
    <div className={`event-confirmation ${type}`}>
      <div className="confirmation-icon">{getIcon()}</div>
      <div className="confirmation-message">{getMessage()}</div>
      <button className="confirmation-dismiss" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
};

export default EventConfirmation;