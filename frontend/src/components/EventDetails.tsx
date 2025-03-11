// frontend/src/components/EventDetails.tsx
import React, { useState } from 'react';
import * as dateUtils from '../utils/dateUtils';
import { supabase } from '../services/supabaseClient';
import EventEditForm from './EventEditForm';
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
  onEdit?: (updatedEvent: any) => void;
}

const EventDetails: React.FC<EventDetailsProps> = ({ 
  event, 
  onClose, 
  onDelete,
  onEdit 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const startDate = new Date(event.start_time);
  const endDate = event.end_time ? new Date(event.end_time) : null;
  
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return;
    }
    
    setIsDeleting(true);
    
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
      setIsDeleting(false);
    }
  };
  
  const handleEditClick = () => {
    setIsEditing(true);
  };
  
  const handleEditCancel = () => {
    setIsEditing(false);
  };
  
  const handleSaveEdit = async (updatedEvent: any) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({
          title: updatedEvent.title,
          start_time: updatedEvent.start_time,
          end_time: updatedEvent.end_time,
          location: updatedEvent.location,
          description: updatedEvent.description,
          is_recurring: updatedEvent.is_recurring,
          updated_at: new Date().toISOString()
        })
        .eq('id', event.id);
      
      if (error) throw error;
      
      if (onEdit) {
        onEdit(updatedEvent);
      } else {
        onClose(); // Fall back to closing if no onEdit handler
      }
    } catch (error) {
      console.error('Error updating event:', error);
      alert('Failed to update event. Please try again.');
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
      } else if (patternObj.description) {
        return patternObj.description;
      }
    } catch (e) {
      // If we can't parse it, just return the string version
      return typeof pattern === 'string' ? pattern : 'Recurring';
    }
    
    return 'Recurring';
  };
  
  // If in edit mode, show the edit form
  if (isEditing) {
    return (
      <EventEditForm 
        event={event}
        onSave={handleSaveEdit}
        onCancel={handleEditCancel}
      />
    );
  }
  
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
          <button 
            className="edit-button" 
            onClick={handleEditClick}
            disabled={isDeleting}
          >
            Edit
          </button>
          <button 
            className="delete-button" 
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;