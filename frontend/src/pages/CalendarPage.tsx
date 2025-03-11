// frontend/src/pages/CalendarPage.tsx
import React, { useState } from 'react';
import WeeklyCalendar from '../components/WeeklyCalendar';
import EventDetails from '../components/EventDetails';
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
}

interface EventConfirmation {
  type: 'created' | 'updated' | 'deleted';
  eventTitle: string;
}

const CalendarPage: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [lastAction, setLastAction] = useState<EventConfirmation | null>(null);
  
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
    // This forces the WeeklyCalendar to remount and refetch data
    setRefreshKey(prevKey => {
      const newKey = prevKey + 1;
      console.log(`Incrementing refresh key: ${prevKey} → ${newKey}`);
      return newKey;
    });
  };
  
  return (
    <div className="calendar-page">
      <div className="calendar-page-header">
        <h1>Calendar</h1>
        <p className="calendar-intro">
          View and manage your family events. You can add events through the chat or edit them directly here.
        </p>
      </div>
      
      {/* Weekly calendar with refresh key and last action for confirmation */}
      <WeeklyCalendar 
        key={refreshKey}
        onEventSelect={handleEventSelect}
        initialConfirmation={lastAction || undefined}
      />
      
      {/* Event details modal */}
      {selectedEvent && (
        <EventDetails 
          event={selectedEvent} 
          onClose={handleCloseDetails}
          onDelete={handleEventDeleted}
          onEdit={handleEventEdited}
        />
      )}
    </div>
  );
};

export default CalendarPage;
