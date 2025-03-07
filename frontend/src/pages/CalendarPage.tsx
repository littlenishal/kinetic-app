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

const CalendarPage: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  
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
    setSelectedEvent(null);
    // Trigger a refresh of the calendar by changing the key
    setRefreshKey(prev => prev + 1);
  };
  
  // Switch to chat view to edit the event
  const handleEditEvent = () => {
    // For now, just close the modal
    // In a future implementation, this could redirect to the chat interface
    // with a pre-filled message to edit the event
    setSelectedEvent(null);
    // You could also use a context or state management to communicate with the chat component
  };
  
  return (
    <div className="calendar-page">
      <div className="calendar-page-header">
        <h1>Calendar</h1>
        <p className="calendar-intro">
          View and manage your family events. To add or edit events, use the chat interface.
        </p>
      </div>
      
      {/* Weekly calendar with refresh key */}
      <WeeklyCalendar 
        key={refreshKey}
        onEventSelect={handleEventSelect} 
      />
      
      {/* Event details modal */}
      {selectedEvent && (
        <EventDetails 
          event={selectedEvent} 
          onClose={handleCloseDetails}
          onDelete={handleEventDeleted}
          onEdit={handleEditEvent}
        />
      )}
    </div>
  );
};

export default CalendarPage;