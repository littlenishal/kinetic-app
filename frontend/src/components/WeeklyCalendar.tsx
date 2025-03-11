// frontend/src/components/WeeklyCalendar.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import * as dateUtils from '../utils/dateUtils';
import EventConfirmation from './EventConfirmation';
import '../styles/WeeklyCalendar.css';

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  location?: string;
  is_recurring: boolean;
  recurrence_pattern?: any;
}

interface Confirmation {
  show: boolean;
  type: 'created' | 'updated' | 'deleted';
  eventTitle: string;
}

interface WeeklyCalendarProps {
  onEventSelect?: (event: CalendarEvent) => void;
  initialConfirmation?: {
    type: 'created' | 'updated' | 'deleted';
    eventTitle: string;
  };
}

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({ 
  onEventSelect,
  initialConfirmation 
}) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getStartOfWeek(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>({
    show: initialConfirmation ? true : false,
    type: initialConfirmation?.type || 'created',
    eventTitle: initialConfirmation?.eventTitle || ''
  });

  // Function to get start of the week (Sunday)
  function getStartOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - day);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  // Get days of the week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(currentWeekStart);
    day.setDate(currentWeekStart.getDate() + i);
    return day;
  });

  // Format dates for display
  const formatDayHeader = (date: Date): string => {
    const today = new Date();
    
    // Check if date is today
    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    }
    
    return `${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
  };

  // Navigate to previous week
  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  // Navigate to next week
  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  // Jump to today
  const goToToday = () => {
    setCurrentWeekStart(getStartOfWeek(new Date()));
  };

  // Hide confirmation
  const dismissConfirmation = () => {
    setConfirmation({ ...confirmation, show: false });
  };

  // Get formatted time range
  const getTimeRange = (event: CalendarEvent): string => {
    const startTime = new Date(event.start_time);
    const formattedStart = dateUtils.formatTime(startTime);
    
    if (event.end_time) {
      const endTime = new Date(event.end_time);
      const formattedEnd = dateUtils.formatTime(endTime);
      return `${formattedStart} - ${formattedEnd}`;
    }
    
    return formattedStart;
  };

  // Format location display
  const formatLocation = (location?: string): string => {
    if (!location) return '';
    
    // If location is too long, truncate it
    if (location.length > 30) {
      return location.substring(0, 27) + '...';
    }
    
    return location;
  };

  // Select event handler
  const handleEventClick = (event: CalendarEvent) => {
    if (onEventSelect) {
      onEventSelect(event);
    }
  };

  // Fetch events from Supabase for the current week
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setLoading(false);
          return;
        }
        
        // Calculate week end date
        const weekEndDate = new Date(currentWeekStart);
        weekEndDate.setDate(weekEndDate.getDate() + 7);
        
        // Fetch events for the current week
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id)
          .gte('start_time', currentWeekStart.toISOString())
          .lt('start_time', weekEndDate.toISOString())
          .order('start_time');
          
        if (error) {
          throw error;
        }
        
        setEvents(data || []);
      } catch (error) {
        console.error('Error fetching events:', error);
        setError('Failed to load calendar events. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvents();
  }, [currentWeekStart]);

  // Get events for a specific day
  const getEventsForDay = (date: Date): CalendarEvent[] => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    
    return events.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate >= dayStart && eventDate <= dayEnd;
    });
  };

  // Check if a day is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="weekly-calendar">
      <div className="calendar-header">
        <h2>
          {currentWeekStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h2>
        <div className="calendar-controls">
          <button onClick={goToPreviousWeek} className="nav-button">
            <span>←</span>
          </button>
          <button onClick={goToToday} className="today-button">
            Today
          </button>
          <button onClick={goToNextWeek} className="nav-button">
            <span>→</span>
          </button>
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="calendar-grid">
        {weekDays.map((day, index) => (
          <div 
            key={index} 
            className={`calendar-day ${isToday(day) ? 'today' : ''}`}
          >
            <div className="day-header">{formatDayHeader(day)}</div>
            
            <div className="day-events">
              {loading ? (
                <div className="loading-events">Loading...</div>
              ) : (
                getEventsForDay(day).map(event => (
                  <div 
                    key={event.id} 
                    className="event-card"
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="event-time">{getTimeRange(event)}</div>
                    <div className="event-title">{event.title}</div>
                    {event.location && (
                      <div className="event-location">
                        <span className="location-icon">📍</span>
                        {formatLocation(event.location)}
                      </div>
                    )}
                    {event.is_recurring && (
                      <div className="event-recurring">
                        <span className="recurring-icon">🔄</span>
                      </div>
                    )}
                  </div>
                ))
              )}
              
              {!loading && getEventsForDay(day).length === 0 && (
                <div className="no-events">No events</div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Confirmation toast */}
      {confirmation.show && (
        <EventConfirmation
          type={confirmation.type}
          eventTitle={confirmation.eventTitle}
          onDismiss={dismissConfirmation}
        />
      )}
    </div>
  );
};

export default WeeklyCalendar;