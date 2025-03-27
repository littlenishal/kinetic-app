// frontend/src/components/WeeklyCalendar.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import * as dateUtils from '../utils/dateUtils';
import EventConfirmation from './EventConfirmation';
import { useFamily } from '../contexts/FamilyContext';
import '../styles/WeeklyCalendar.css';

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  location?: string;
  is_recurring: boolean;
  recurrence_pattern?: any;
  user_id?: string;
  family_id?: string;
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
  const { currentFamilyId } = useFamily();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getStartOfWeek(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>({
    show: initialConfirmation ? true : false,
    type: initialConfirmation?.type || 'created',
    eventTitle: initialConfirmation?.eventTitle || ''
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(window.innerWidth > 768 ? 'grid' : 'list');
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const calendarRef = useRef<HTMLDivElement>(null);

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

  // Responsive layout handler
  useEffect(() => {
    const handleResize = () => {
      setViewMode(window.innerWidth > 768 ? 'grid' : 'list');
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Touch swipe navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
  }, [isDragging]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const endX = e.changedTouches[0].clientX;
    const diffX = endX - startX;
    
    // Threshold for swipe detection
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) {
        // Swipe right - go to previous week
        goToPreviousWeek();
      } else {
        // Swipe left - go to next week
        goToNextWeek();
      }
    }
    
    setIsDragging(false);
  }, [isDragging, startX]);

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
  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    if (onEventSelect) {
      onEventSelect(event);
    }
  };

  // Keyboard event handling for accessibility
  const handleEventKeyDown = (event: CalendarEvent, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onEventSelect) {
        onEventSelect(event);
      }
    }
  };

  // Create a reference to track component mounts
  const componentMountCount = useRef(0);
  
  // Fetch events from Supabase for the current week
  useEffect(() => {
    // Increment mount count
    componentMountCount.current += 1;
    
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
        
        let query = supabase
          .from('events')
          .select('*')
          .gte('start_time', currentWeekStart.toISOString())
          .lt('start_time', weekEndDate.toISOString())
          .order('start_time');
        
        // Filter based on current view (personal or family)
        if (currentFamilyId) {
          // Viewing family calendar
          query = query.eq('family_id', currentFamilyId);
        } else {
          // Viewing personal calendar
          query = query.eq('user_id', user.id);
        }
          
        const { data, error } = await query;
          
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
    
  }, [currentWeekStart, currentFamilyId]);

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

  // Render a single event card
  const renderEventCard = (event: CalendarEvent, includeDate = false) => (
    <div 
      key={event.id} 
      className={`event-card ${event.family_id ? 'family-event' : ''}`}
      onClick={(e) => handleEventClick(event, e)}
      onKeyDown={(e) => handleEventKeyDown(event, e)}
      tabIndex={0}
      role="button"
      aria-label={`${event.title} at ${getTimeRange(event)}${event.location ? ` at ${event.location}` : ''}`}
    >
      {includeDate && (
        <div className="event-date">
          {dateUtils.formatDate(new Date(event.start_time))}
        </div>
      )}
      <div className="event-time">{getTimeRange(event)}</div>
      <div className="event-title">
        {event.family_id && <span className="event-badge family">Family</span>}
        {event.title}
      </div>
      {event.location && (
        <div className="event-location">
          <span className="location-icon" aria-hidden="true">📍</span>
          {formatLocation(event.location)}
        </div>
      )}
      {event.is_recurring && (
        <div className="event-recurring">
          <span className="recurring-icon" aria-hidden="true">🔄</span>
          <span className="sr-only">Recurring event</span>
        </div>
      )}
    </div>
  );

  // Render calendar in grid mode
  const renderGridView = () => (
    <div 
      className="calendar-grid" 
      role="grid" 
      aria-label="Weekly calendar"
      ref={calendarRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {weekDays.map((day, index) => (
        <div 
          key={index} 
          className={`calendar-day ${isToday(day) ? 'today' : ''}`}
          role="gridcell"
          aria-label={formatDayHeader(day)}
        >
          <div className="day-header">{formatDayHeader(day)}</div>
          
          <div className="day-events">
            {loading ? (
              <div className="loading-events">Loading...</div>
            ) : (
              getEventsForDay(day).map(event => renderEventCard(event))
            )}
            
            {!loading && getEventsForDay(day).length === 0 && (
              <div className="no-events">No events</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // Render calendar in list mode
  const renderListView = () => (
    <div className="calendar-list" role="list" aria-label="Weekly events">
      {loading ? (
        <div className="loading-events">Loading events...</div>
      ) : (
        weekDays.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          
          return (
            <div 
              key={index} 
              className={`calendar-day-list ${isToday(day) ? 'today' : ''}`}
              role="listitem"
            >
              <div className="day-header-list">{formatDayHeader(day)}</div>
              
              <div className="day-events-list">
                {dayEvents.length > 0 ? (
                  dayEvents.map(event => renderEventCard(event))
                ) : (
                  <div className="no-events">No events</div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="weekly-calendar" aria-busy={loading}>
      <div className="calendar-header">
        <h2>
          Week of {currentWeekStart.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
        </h2>
        <div className="calendar-controls">
          <button 
            onClick={goToPreviousWeek} 
            className="nav-button"
            aria-label="Previous week"
          >
            <span aria-hidden="true">←</span>
          </button>
          <button 
            onClick={goToToday} 
            className="today-button"
            aria-label="Go to current week"
          >
            Today
          </button>
          <button 
            onClick={goToNextWeek} 
            className="nav-button"
            aria-label="Next week"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      
      <div className="view-toggle-container">
        <button 
          className={`view-toggle-button ${viewMode === 'grid' ? 'active' : ''}`}
          onClick={() => setViewMode('grid')}
          aria-pressed={viewMode === 'grid'}
          aria-label="Grid view"
        >
          <span className="view-icon grid-icon" aria-hidden="true">□□</span>
          <span className="sr-only">Grid view</span>
        </button>
        <button 
          className={`view-toggle-button ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => setViewMode('list')}
          aria-pressed={viewMode === 'list'}
          aria-label="List view"
        >
          <span className="view-icon list-icon" aria-hidden="true">≡</span>
          <span className="sr-only">List view</span>
        </button>
      </div>
      
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      
      {viewMode === 'grid' ? renderGridView() : renderListView()}
      
      {/* Confirmation toast */}
      {confirmation.show && (
        <EventConfirmation
          type={confirmation.type}
          eventTitle={confirmation.eventTitle}
          onDismiss={dismissConfirmation}
        />
      )}
      
      {/* Touch navigation hint */}
      <div className="swipe-hint">
        <span aria-hidden="true">← Swipe to navigate →</span>
      </div>
    </div>
  );
};

export default WeeklyCalendar;