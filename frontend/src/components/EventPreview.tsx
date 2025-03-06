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
  // Ensure date is treated as a proper Date object
  const eventDate = new Date(event.date);
  
  // Format the date using our utility function for consistent formatting
  const formattedDate = dateUtils.formatDate(eventDate);
  
  // Format times properly based on the date object instead of using passed strings
  // This ensures correct timezone handling
  const formattedStartTime = eventDate ? dateUtils.formatTime(eventDate) : '';
  
  // Handle end time if available
  let formattedEndTime = '';
  if (event.endTime) {
    // If we have a string end time, we need to parse it relative to the start date
    if (typeof event.endTime === 'string') {
      // Create a new date based on the start date
      const endDate = new Date(eventDate);
      
      // Parse the end time (assuming format like "13:00" or "1:00 PM")
      if (event.endTime.includes(':')) {
        // Handle 24-hour format
        const [hours, minutes] = event.endTime.split(':').map(num => parseInt(num, 10));
        endDate.setHours(hours, minutes);
      } else {
        // Try to parse other formats
        const endTimeDate = new Date(`${endDate.toDateString()} ${event.endTime}`);
        if (!isNaN(endTimeDate.getTime())) {
          endDate.setHours(endTimeDate.getHours(), endTimeDate.getMinutes());
        }
      }
      
      formattedEndTime = dateUtils.formatTime(endDate);
    } else {
      const endTimeDate = new Date(event.endTime);
      if (!isNaN(endTimeDate.getTime())) {
        formattedEndTime = dateUtils.formatTime(endTimeDate);
      }
    }
  }

  // Generate human-readable day name (e.g., "Friday")
  const dayName = eventDate.toLocaleDateString(undefined, { weekday: 'long' });

  return (
    <div className="event-preview-card">
      <h3>New Event</h3>
      <p><strong>{event.title}</strong></p>
      <p>Date: {dayName}, {formattedDate}</p>
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