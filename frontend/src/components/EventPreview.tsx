import React from 'react';

interface EventPreviewProps {
  event: {
    title: string;
    date: Date;
    startTime?: string;
    endTime?: string;
    location?: string;
    isRecurring?: boolean;
    recurrencePattern?: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
}

const EventPreview: React.FC<EventPreviewProps> = ({ event, onConfirm, onCancel }) => {
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="event-preview-card">
      <h3>New Event</h3>
      <p><strong>{event.title}</strong></p>
      <p>Date: {formatDate(event.date)}</p>
      {event.startTime && <p>Time: {event.startTime}</p>}
      {event.endTime && <p>End: {event.endTime}</p>}
      {event.location && <p>Location: {event.location}</p>}
      {event.isRecurring && (
        <p>
          <span className="recurring-badge">Recurring</span>
          {event.recurrencePattern && <span> ({event.recurrencePattern})</span>}
        </p>
      )}
      
      <div className="event-preview-actions">
        <button 
          className="confirm-button" 
          onClick={onConfirm}
        >
          Add to Calendar
        </button>
        <button 
          className="cancel-button" 
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default EventPreview;