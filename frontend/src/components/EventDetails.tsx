// frontend/src/components/EventDetails.tsx - Updated with family support
import React, { useState } from 'react';
import * as dateUtils from '../utils/dateUtils';
import { supabase } from '../services/supabaseClient';
import { convertEventOwnership } from '../services/eventService';
import { useFamily } from '../contexts/FamilyContext';
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
    user_id?: string;
    family_id?: string;
    family?: {
      id: string;
      name: string;
    };
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
  const { families, currentFamilyId, setCurrentFamilyId } = useFamily();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [showOwnershipMenu, setShowOwnershipMenu] = useState(false);
  
  const startDate = new Date(event.start_time);
  const endDate = event.end_time ? new Date(event.end_time) : null;
  
  // Determine if this is a personal or family event
  const isPersonalEvent = !!event.user_id;
  const isFamilyEvent = !!event.family_id;
  
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
  
  const handleConvertToFamily = async (familyId: string) => {
    setIsConverting(true);
    setShowOwnershipMenu(false);
    
    try {
      const result = await convertEventOwnership(event.id, familyId);
      
      if (result.success) {
        // Update the current family context if needed
        if (familyId !== currentFamilyId) {
          setCurrentFamilyId(familyId);
        }
        
        // Close the details modal and refresh the calendar
        if (onEdit) {
          const updatedEvent = {
            ...event,
            user_id: null,
            family_id: familyId
          };
          onEdit(updatedEvent);
        } else {
          onClose();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error converting event:', error);
      alert('Failed to convert event. Please try again.');
      setIsConverting(false);
    }
  };
  
  const handleConvertToPersonal = async () => {
    setIsConverting(true);
    setShowOwnershipMenu(false);
    
    try {
      const result = await convertEventOwnership(event.id, null);
      
      if (result.success) {
        // Update the current family context if needed
        if (currentFamilyId !== null) {
          setCurrentFamilyId(null);
        }
        
        // Close the details modal and refresh the calendar
        if (onEdit) {
          const { data: { user } } = await supabase.auth.getUser();
          const updatedEvent = {
            ...event,
            user_id: user?.id,
            family_id: null
          };
          onEdit(updatedEvent);
        } else {
          onClose();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error converting event:', error);
      alert('Failed to convert event. Please try again.');
      setIsConverting(false);
    }
  };
  
  const handleSaveEdit = async (updatedEvent: any) => {
    try {
      // Get current user for RLS
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Include all necessary fields for update
      const updateData = {
        user_id: isFamilyEvent ? null : user.id, // Maintain ownership type
        family_id: event.family_id,
        title: updatedEvent.title,
        start_time: updatedEvent.start_time,
        end_time: updatedEvent.end_time,
        location: updatedEvent.location,
        description: updatedEvent.description,
        is_recurring: updatedEvent.is_recurring,
        recurrence_pattern: updatedEvent.recurrence_pattern,
        updated_at: new Date().toISOString()
      };
      
      console.log('Updating event with data:', updateData);
      
      const { data, error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', event.id)
        .select('*')
        .single();
      
      if (error) throw error;
      
      console.log('Event updated successfully:', data);
      
      // Use the actual returned data from Supabase for the callback
      if (onEdit && data) {
        onEdit(data);
      } else {
        onClose(); // Fall back to closing if no onEdit handler or no data
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
        
        <div className="event-ownership">
          {isFamilyEvent ? (
            <span className="ownership-badge family">
              {event.family?.name || 'Family'} Calendar
            </span>
          ) : (
            <span className="ownership-badge personal">
              Personal Calendar
            </span>
          )}
          
          {/* Show convert option if there are families available */}
          {families.length > 0 && (
            <div className="ownership-menu-container">
              <button 
                className="convert-button"
                onClick={() => setShowOwnershipMenu(!showOwnershipMenu)}
                disabled={isConverting}
              >
                {isConverting ? 'Converting...' : 'Move To →'}
              </button>
              
              {showOwnershipMenu && (
                <div className="ownership-menu">
                  {/* Personal option */}
                  {!isPersonalEvent && (
                    <button 
                      className="ownership-option"
                      onClick={handleConvertToPersonal}
                    >
                      Personal Calendar
                    </button>
                  )}
                  
                  {/* Family options */}
                  {families.map(family => (
                    // Skip the current family if this is already a family event in this family
                    (isFamilyEvent && family.id === event.family_id) ? null : (
                      <button 
                        key={family.id}
                        className="ownership-option"
                        onClick={() => handleConvertToFamily(family.id)}
                      >
                        {family.name} Family
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
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
            disabled={isDeleting || isConverting}
          >
            Edit
          </button>
          <button 
            className="delete-button" 
            onClick={handleDelete}
            disabled={isDeleting || isConverting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;