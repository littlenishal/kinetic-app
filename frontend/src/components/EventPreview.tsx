import React from 'react';
import * as dateUtils from '../utils/dateUtils';

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
  // Format the date using our utility function for consistent formatting
  const formattedDate = dateUtils.formatDate(event.date);
  
  // Use the already formatted time strings directly without reformatting
  const formattedStartTime = event.startTime || '';
  const formattedEndTime = event.endTime || '';

  return (
    <div className="event-preview-card">
      <h3>New Event</h3>
      <p><strong>{event.title}</strong></p>
      <p>Date: {formattedDate}</p>
      {formattedStartTime && <p>Time: {formattedStartTime}</p>}
      {formattedEndTime && <p>End: {formattedEndTime}</p>}
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