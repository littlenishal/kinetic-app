// frontend/src/pages/CalendarPage.tsx
import React, { useState, useEffect } from 'react';
import WeeklyCalendar from '../components/WeeklyCalendar';
import EventDetails from '../components/EventDetails';
import { useFamily } from '../contexts/FamilyContext';
import '../styles/CalendarPage.css';

interface CalendarEvent {
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
}

interface EventConfirmation {
  type: 'created' | 'updated' | 'deleted';
  eventTitle: string;
}

const CalendarPage: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [lastAction, setLastAction] = useState<EventConfirmation | null>(null);
  const [viewType, setViewType] = useState<'week' | 'month'>('week');
  const { currentFamilyId } = useFamily();
  
  // Handle event selection
  const handleEventSelect = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };
  
  // Close event details modal
  const handleCloseDetails = () => {
    setSelectedEvent(null);
  };
  
  // After event deletion, close modal and refresh the calendar
  const handleEventDeleted = () => {
    const eventTitle = selectedEvent?.title || 'Event';
    
    setLastAction({
      type: 'deleted',
      eventTitle: eventTitle
    });
    
    setSelectedEvent(null);
    // Trigger a refresh of the calendar by changing the key
    setRefreshKey(prev => prev + 1);
  };
  
  // After event edit, update state and refresh the calendar
  const handleEventEdited = (updatedEvent: CalendarEvent) => {
    console.log('Event edited in CalendarPage:', updatedEvent);
    
    // Set the confirmation message
    setLastAction({
      type: 'updated',
      eventTitle: updatedEvent.title
    });
    
    // Close the modal
    setSelectedEvent(null);
    
    // Trigger a refresh of the calendar by changing the key
    setRefreshKey(prev => prev + 1);
  };
  
  // Toggle between week and month view
  const handleViewTypeChange = (newViewType: 'week' | 'month') => {
    setViewType(newViewType);
  };

  // Handle escape key press to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedEvent) {
        handleCloseDetails();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEvent]);

  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (selectedEvent) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [selectedEvent]);
  
  return (
    <div className="calendar-page" aria-live="polite">
      <div className="calendar-page-header">
        <div className="calendar-page-title">
          <h1>{currentFamilyId ? 'Family Calendar' : 'Personal Calendar'}</h1>
          <p className="calendar-intro">
            View and manage your {currentFamilyId ? 'family' : 'personal'} events. Add events through chat or edit them directly here.
          </p>
        </div>
        
        <div className="calendar-view-controls">
          <div className="calendar-tabs" role="tablist" aria-label="Calendar views">
            <button 
              className={`calendar-tab ${viewType === 'week' ? 'active' : ''}`}
              onClick={() => handleViewTypeChange('week')}
              role="tab"
              aria-selected={viewType === 'week'}
              id="week-tab"
              aria-controls="week-view"
            >
              Week
            </button>
            <button 
              className={`calendar-tab ${viewType === 'month' ? 'active' : ''}`}
              onClick={() => handleViewTypeChange('month')}
              role="tab"
              aria-selected={viewType === 'month'}
              id="month-tab"
              aria-controls="month-view"
              disabled={true} // Future implementation
            >
              Month (Coming Soon)
            </button>
          </div>
        </div>
      </div>
      
      <div 
        id="week-view" 
        role="tabpanel" 
        aria-labelledby="week-tab"
        className={viewType === 'week' ? 'calendar-view-active' : 'calendar-view-hidden'}
      >
        <WeeklyCalendar 
          key={refreshKey}
          onEventSelect={handleEventSelect}
          initialConfirmation={lastAction || undefined}
        />
      </div>
      
      {/* Month view will be implemented in the future */}
      <div 
        id="month-view" 
        role="tabpanel" 
        aria-labelledby="month-tab"
        className={viewType === 'month' ? 'calendar-view-active' : 'calendar-view-hidden'}
      >
        <div className="coming-soon-placeholder">
          <p>Monthly view is coming soon!</p>
        </div>
      </div>
      
      {/* Event details modal with backdrop */}
      {selectedEvent && (
        <>
          <div className="modal-backdrop" onClick={handleCloseDetails} aria-hidden="true" />
          <EventDetails 
            event={selectedEvent} 
            onClose={handleCloseDetails}
            onDelete={handleEventDeleted}
            onEdit={handleEventEdited}
          />
        </>
      )}
    </div>
  );
};

export default CalendarPage;