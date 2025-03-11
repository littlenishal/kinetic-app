// frontend/src/components/EventEditForm.tsx
import React, { useState } from 'react';
import * as dateUtils from '../utils/dateUtils';
import '../styles/EventEditForm.css';

interface EventEditFormProps {
  event: {
    id: string;
    title: string;
    start_time: string;
    end_time?: string;
    location?: string;
    description?: string;
    is_recurring: boolean;
    recurrence_pattern?: any;
  };
  onSave: (updatedEvent: any) => void;
  onCancel: () => void;
}

const EventEditForm: React.FC<EventEditFormProps> = ({ 
  event, 
  onSave, 
  onCancel 
}) => {
  // Parse dates from the event
  const startDate = new Date(event.start_time);
  const endDate = event.end_time ? new Date(event.end_time) : null;
  
  // Set up form state
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(startDate.toISOString().split('T')[0]); // YYYY-MM-DD format
  const [startTime, setStartTime] = useState(
    startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  );
  const [endTime, setEndTime] = useState(
    endDate ? endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ''
  );
  const [location, setLocation] = useState(event.location || '');
  const [description, setDescription] = useState(event.description || '');
  const [isRecurring, setIsRecurring] = useState(event.is_recurring);
  
  // Form validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!date) {
      newErrors.date = 'Date is required';
    }
    
    if (!startTime) {
      newErrors.startTime = 'Start time is required';
    }
    
    if (endTime) {
      // If end time is provided, validate it's after start time
      const startDateTime = new Date(`${date}T${startTime}`);
      const endDateTime = new Date(`${date}T${endTime}`);
      
      if (endDateTime <= startDateTime) {
        newErrors.endTime = 'End time must be after start time';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    // Create date objects
    const dateObj = new Date(date);
    
    // Parse start time
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const startDateTime = new Date(dateObj);
    startDateTime.setHours(startHours, startMinutes, 0, 0);
    
    // Parse end time if available
    let endDateTime = null;
    if (endTime) {
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      endDateTime = new Date(dateObj);
      endDateTime.setHours(endHours, endMinutes, 0, 0);
    }
    
    // Log times for debugging
    console.log('Form data:');
    console.log('- Date:', date);
    console.log('- Start time:', startTime, '→', startDateTime.toISOString());
    if (endTime) {
      console.log('- End time:', endTime, '→', endDateTime?.toISOString());
    }
    
    // Create updated event object
    const updatedEvent = {
      ...event, // Keep original event properties
      title,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime ? endDateTime.toISOString() : null,
      location: location || null,
      description: description || null,
      is_recurring: isRecurring,
      // Keep the existing recurrence_pattern but ensure it's not undefined
      recurrence_pattern: event.recurrence_pattern || null,
      // Ensure id is preserved
      id: event.id
    };
    
    console.log('Submitting updated event:', updatedEvent);
    
    // Pass the updated event to the parent component
    onSave(updatedEvent);
  };
  
  return (
    <div className="event-edit-modal">
      <div className="event-edit-content">
        <h2>Edit Event</h2>
        
        <form onSubmit={handleSubmit} className="event-edit-form">
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={errors.title ? 'error' : ''}
            />
            {errors.title && <div className="error-message">{errors.title}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="date">Date</label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={errors.date ? 'error' : ''}
            />
            {errors.date && <div className="error-message">{errors.date}</div>}
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startTime">Start Time</label>
              <input
                type="time"
                id="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={errors.startTime ? 'error' : ''}
              />
              {errors.startTime && <div className="error-message">{errors.startTime}</div>}
            </div>
            
            <div className="form-group">
              <label htmlFor="endTime">End Time (optional)</label>
              <input
                type="time"
                id="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={errors.endTime ? 'error' : ''}
              />
              {errors.endTime && <div className="error-message">{errors.endTime}</div>}
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="location">Location (optional)</label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              This is a recurring event
            </label>
            
            {isRecurring && (
              <div className="recurring-note">
                Note: Recurrence pattern can't be edited here. Use the chat interface to modify recurring events.
              </div>
            )}
          </div>
          
          <div className="form-actions">
            <button type="button" className="cancel-button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="save-button">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventEditForm;