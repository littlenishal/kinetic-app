// frontend/src/components/EventEditPreview.tsx
import React, { useState, useEffect } from 'react';
import * as dateUtils from '../utils/dateUtils';
import { supabase } from '../services/supabaseClient';
import '../styles/EventEditPreview.css';

interface EventEditPreviewProps {
  eventId: string;
  onSave: (event: any) => void;
  onCancel: () => void;
}

const EventEditPreview: React.FC<EventEditPreviewProps> = ({
  eventId,
  onSave,
  onCancel
}) => {
  console.log(`EventEditPreview mounted with eventId: ${eventId}`);
  
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  
  // Fetch the event details
  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) {
        setError('No event ID provided');
        setLoading(false);
        return;
      }
      
      console.log(`Fetching event details for ID: ${eventId}`);
      setLoading(true);
      setError(null);
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('Authentication required');
        }
        
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching event:', error);
          throw error;
        }
        
        if (!data) {
          console.error('Event not found');
          throw new Error('Event not found');
        }
        
        console.log('Successfully retrieved event:', data);
        
        // Store the full event data
        setEvent(data);
        
        // Set form values from event data
        const startDate = new Date(data.start_time);
        const endDate = data.end_time ? new Date(data.end_time) : null;
        
        setTitle(data.title);
        setDate(startDate.toISOString().split('T')[0]); // Format as YYYY-MM-DD
        setStartTime(startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
        if (endDate) {
          setEndTime(endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
        }
        setLocation(data.location || '');
        
      } catch (err) {
        console.error('Error in fetchEvent:', err);
        setError(err instanceof Error ? err.message : 'Failed to load event details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvent();
  }, [eventId]);
  
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!event) return;
    
    try {
      // Parse the date components
      const [year, month, day] = date.split('-').map(Number);
      
      // Create start time
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const startDateTime = new Date();
      startDateTime.setFullYear(year, month - 1, day);
      startDateTime.setHours(startHours, startMinutes, 0, 0);
      
      // Create end time if provided
      let endDateTime = null;
      if (endTime) {
        const [endHours, endMinutes] = endTime.split(':').map(Number);
        endDateTime = new Date();
        endDateTime.setFullYear(year, month - 1, day);
        endDateTime.setHours(endHours, endMinutes, 0, 0);
      }
      
      console.log('Saving updated event with data:', {
        title,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime ? endDateTime.toISOString() : null,
        location
      });
      
      // Create updated event object
      const updatedEvent = {
        ...event,
        title,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime ? endDateTime.toISOString() : null,
        location: location || null,
        updated_at: new Date().toISOString()
      };
      
      onSave(updatedEvent);
      
    } catch (err) {
      console.error('Error preparing event data:', err);
      setError('Error updating event. Please try again.');
    }
  };
  
  if (loading) {
    return (
      <div className="event-edit-preview loading">
        <div className="loading-spinner"></div>
        <p>Loading event details...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="event-edit-preview error">
        <p className="error-message">{error}</p>
        <button className="cancel-button" onClick={onCancel}>Close</button>
      </div>
    );
  }
  
  // Format date for display (e.g., "Friday, March 21, 2025")
  const formattedDate = date 
    ? new Date(date).toLocaleDateString(undefined, { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }) 
    : '';
  
  return (
    <div className="event-edit-preview">
      <h3>Update Event</h3>
      
      <form onSubmit={handleSave}>
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="date">Date</label>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <div className="date-display">{formattedDate}</div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="startTime">Start Time</label>
            <input
              type="time"
              id="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="endTime">End Time</label>
            <input
              type="time"
              id="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="location">Location</label>
          <input
            type="text"
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Optional"
          />
        </div>
        
        <div className="event-edit-actions">
          <button 
            type="button" 
            className="cancel-button" 
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="save-button"
          >
            Update Event
          </button>
        </div>
      </form>
    </div>
  );
};

export default EventEditPreview;