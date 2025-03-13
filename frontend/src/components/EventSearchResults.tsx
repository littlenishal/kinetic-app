import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import * as dateUtils from '../utils/dateUtils';

interface EventSearchResultsProps {
  searchTerm: string;
  onSelectEvent: (eventId: string) => void;
  onCancel: () => void;
}

const EventSearchResults: React.FC<EventSearchResultsProps> = ({
  searchTerm,
  onSelectEvent,
  onCancel
}) => {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const searchEvents = async () => {
      if (!searchTerm || searchTerm.trim().length < 2) {
        setEvents([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error('Authentication required');
        }

        // Try a partial match with the search term
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id)
          .ilike('title', `%${searchTerm}%`)
          .order('start_time', { ascending: false })
          .limit(5);

        if (error) throw error;
        setEvents(data || []);
      } catch (err) {
        console.error('Error searching events:', err);
        setError(err instanceof Error ? err.message : 'Failed to search events');
      } finally {
        setLoading(false);
      }
    };

    searchEvents();
  }, [searchTerm]);

  // Format date and time for display
  const formatEventDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return dateUtils.formatDateTime(date);
  };

  if (loading) {
    return (
      <div className="event-search-results loading">
        <div className="loading-spinner"></div>
        <p>Searching for events...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="event-search-results error">
        <p className="error-message">{error}</p>
        <button className="cancel-button" onClick={onCancel}>Close</button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="event-search-results empty">
        <p>No events found matching "{searchTerm}"</p>
        <p className="suggestion">Try searching with different terms or check your events in the calendar.</p>
        <div className="search-actions">
          <button className="cancel-button" onClick={onCancel}>Close</button>
          <button className="view-calendar-button" onClick={() => window.location.href = '#calendar'}>
            View Calendar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="event-search-results">
      <h3>Found {events.length} matching event{events.length !== 1 ? 's' : ''}</h3>
      <p className="suggestion">Select the event you want to edit:</p>
      
      <div className="event-search-list">
        {events.map(event => (
          <div 
            key={event.id} 
            className="event-search-item"
            onClick={() => onSelectEvent(event.id)}
          >
            <div className="event-search-title">{event.title}</div>
            <div className="event-search-time">{formatEventDateTime(event.start_time)}</div>
            {event.location && (
              <div className="event-search-location">
                <span className="location-icon">📍</span> {event.location}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="search-actions">
        <button className="cancel-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default EventSearchResults;