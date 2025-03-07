// frontend/src/components/EventDetails.tsx
import React from 'react';
import * as dateUtils from '../utils/dateUtils';
import { supabase } from '../services/supabaseClient';
import '../styles/EventDetails.css';

interface EventDetailsProps {
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
  onClose: () => void;
  onDelete: () => void;
  onEdit?: () => void;
}

const EventDetails: React.FC<EventDetailsProps> = ({ 
  event, 
  onClose, 
  onDelete,
  onEdit 
}) => {
  const startDate = new Date(event.start_time);
  const endDate = event.end_time ? new Date(event.end_time) : null;
  
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', event.id);
        
        if (error) throw error;
        
        onDelete();
      } catch (error) {
        console.error('Error deleting event:', error);
        alert('Failed to delete event. Please try again.');
      }
    }
  };
  
  // Format recurrence pattern for display
  const formatRecurrencePattern = (pattern: any): string => {
    if (!pattern) return 'Not recurring';
    
    try {
      // Handle string or object pattern
      const patternObj = typeof pattern === 'string' 
        ? JSON.parse(pattern) 
        : pattern;
      
      if (patternObj.frequency === 'daily') {
        return 'Daily';
      } else if (patternObj.frequency === 'weekly') {
        if (patternObj.days && patternObj.days.length > 0) {
          const days = patternObj.days.join(', ');
          return `Weekly on ${days}`;
        }
        return 'Weekly';
      } else if (patternObj.frequency === 'monthly') {
        if (patternObj.day_of_month) {
          return `Monthly on day ${patternObj.day_of_month}`;
        }
        return 'Monthly';
      } else if (patternObj.frequency === 'yearly') {
        return 'Yearly';
      }
    } catch (e) {
      // If we can't parse it, just return the string version
      return typeof pattern === 'string' ? pattern : 'Recurring';
    }
    
    return 'Recurring';
  };
  
  return (
    <div className="event-details-modal">
      <div className="event-details-content">
        <button className="close-button" onClick={onClose}>×</button>
        
        <h2 className="event-title">{event.title}</h2>
        
        <div className="event-info-section">
          <div className="event-info-item">
            <div className="info-icon">🗓️</div>
            <div className="info-content">
              <div className="info-label">Date</div>
              <div className="info-value">{dateUtils.formatDate(startDate)}</div>
            </div>
          </div>
          
          <div className="event-info-item">
            <div className="info-icon">⏰</div>
            <div className="info-content">
              <div className="info-label">Time</div>
              <div className="info-value">
                {dateUtils.formatTime(startDate)}
                {endDate && ` - ${dateUtils.formatTime(endDate)}`}
              </div>
            </div>
          </div>
          
          {event.location && (
            <div className="event-info-item">
              <div className="info-icon">📍</div>
              <div className="info-content">
                <div className="info-label">Location</div>
                <div className="info-value">{event.location}</div>
              </div>
            </div>
          )}
          
          {event.is_recurring && (
            <div className="event-info-item">
              <div className="info-icon">🔄</div>
              <div className="info-content">
                <div className="info-label">Repeats</div>
                <div className="info-value">
                  {formatRecurrencePattern(event.recurrence_pattern)}
                </div>
              </div>
            </div>
          )}
          
          {event.description && (
            <div className="event-description">
              <div className="info-label">Description</div>
              <p>{event.description}</p>
            </div>
          )}
        </div>
        
        <div className="event-actions">
          {onEdit && (
            <button className="edit-button" onClick={onEdit}>
              Edit
            </button>
          )}
          <button className="delete-button" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;