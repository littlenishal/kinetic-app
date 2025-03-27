import React, { useState } from 'react';
import * as dateUtils from '../utils/dateUtils';
import { useFamily } from '../contexts/FamilyContext';
import '../styles/EventPreview.css';

interface EventPreviewProps {
  event: {
    title: string;
    date: Date | string;
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
  const { families, currentFamilyId, setCurrentFamilyId } = useFamily();
  const [selectedFamily, setSelectedFamily] = useState<string | null>(currentFamilyId);
  
  // Parse the date for display
  const eventDate = event.date instanceof Date ? event.date : new Date(event.date);
  
  // Format the date using our utility function for consistent date display
  const formattedDate = dateUtils.formatDate(eventDate);
  
  // Get the day name (e.g., "Friday")
  const dayName = eventDate.toLocaleDateString(undefined, { weekday: 'long' });
  
  // For time display, we'll use the raw time strings if available
  const displayStartTime = event.startTime || 
    (eventDate instanceof Date ? dateUtils.formatTime(eventDate) : '');
    
  const displayEndTime = event.endTime || '';

  // Handle family selection change
  const handleFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedFamily(value === "personal" ? null : value);
  };

  // Handle confirm - will use the selected family
  const handleConfirm = () => {
    // If different from current context, update it
    if (selectedFamily !== currentFamilyId) {
      setCurrentFamilyId(selectedFamily);
    }
    onConfirm();
  };

  return (
    <div className="event-preview-card">
      <h3>New Event</h3>
      <p><strong>{event.title}</strong></p>
      <p>Date: {dayName}, {formattedDate}</p>
      
      {displayStartTime && (
        <p>Start: {displayStartTime}</p>
      )}
      
      {displayEndTime && (
        <p>End: {displayEndTime}</p>
      )}
      
      {event.location && (
        <p>Location: {event.location}</p>
      )}
      
      {event.isRecurring && (
        <p>
          <span className="recurring-badge">Recurring</span>
          {event.recurrencePattern && (
            <span> ({event.recurrencePattern})</span>
          )}
        </p>
      )}
      
      {/* Family selection dropdown */}
      {families.length > 0 && (
        <div className="event-family-selection">
          <label htmlFor="family-select">Add to:</label>
          <select 
            id="family-select" 
            value={selectedFamily === null ? "personal" : selectedFamily}
            onChange={handleFamilyChange}
          >
            <option value="personal">Personal Calendar</option>
            {families.map(family => (
              <option key={family.id} value={family.id}>
                {family.name} Family Calendar
              </option>
            ))}
          </select>
        </div>
      )}
      
      <div className="event-preview-actions">
        <button 
          className="confirm-button" 
          onClick={handleConfirm}
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