// Enhanced eventUtils.ts with improved edit detection

import { supabase } from '../services/supabaseClient';
import * as dateUtils from './dateUtils';

// Event preview data interface
export interface EventPreviewData {
  id?: string; // Optional ID for existing events
  title: string;
  date: Date;
  startTime?: string;
  endTime?: string;
  location?: string;
  isRecurring?: boolean;
  recurrencePattern?: string;
}

// Enhanced patterns for detecting edit commands in user input
export const EDIT_COMMAND_PATTERNS = [
  // Direct edit commands
  /\b(?:edit|modify|update|change)\s+(?:my|the)?\s+([a-z0-9\s'-]+?)(?:\s+event)?\s*$/i,
  /\bopen\s+(?:the)?\s+(?:editor|form|edit(?:\s+form)?)\s+for\s+([a-z0-9\s'-]+)(?:\s+event)?\s*$/i,
  /\bmake\s+changes\s+to\s+(?:my|the)?\s+([a-z0-9\s'-]+)(?:\s+event)?\s*$/i,
  /\blet\s+me\s+edit\s+(?:my|the)?\s+([a-z0-9\s'-]+)(?:\s+event)?\s*$/i,
  
  // Indirect edit patterns
  /\bneed\s+to\s+(?:update|change|modify)\s+(?:my|the)?\s+([a-z0-9\s'-]+)(?:\s+event)?\b/i,
  /\bwant\s+to\s+(?:update|change|modify)\s+(?:my|the)?\s+([a-z0-9\s'-]+)(?:\s+event)?\b/i,
  /\bcan\s+(?:you|I|we)\s+(?:update|change|modify)\s+(?:my|the)?\s+([a-z0-9\s'-]+)(?:\s+event)?\b/i,
  /\b(?:update|change|modify)\s+(?:the|my)?\s+(?:time|date|location|details)\s+(?:of|for)\s+(?:my|the)?\s+([a-z0-9\s'-]+)(?:\s+event)?\b/i,
  
  // Possessive forms
  /\b(?:edit|update|change|modify)\s+([a-z][a-z']*(?:'s))\s+([a-z0-9\s'-]+)(?:\s+event)?\b/i
];

/**
 * Check for edit requests in user message
 * Returns eventId if found, null otherwise
 */
export const checkForEditRequest = async (message: string): Promise<string | null> => {
  console.log("Checking for edit request in:", message);
  
  // Try each pattern to extract event title
  for (const pattern of EDIT_COMMAND_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      // Handle possessive form pattern (e.g., "edit Maya's soccer practice")
      if (pattern.toString().includes("'s")) {
        if (match[1] && match[2]) {
          const possessiveTitle = `${match[1]} ${match[2]}`.trim();
          console.log(`Detected possessive edit request: "${possessiveTitle}"`);
          const eventId = await findEventByTitle(possessiveTitle);
          if (eventId) return eventId;
        }
      }
      // Handle standard patterns
      else if (match[1]) {
        const eventTitle = match[1].trim();
        console.log(`Detected edit request for: "${eventTitle}"`);
        const eventId = await findEventByTitle(eventTitle);
        if (eventId) return eventId;
      }
    }
  }
  
  // Additional check for "reschedule" and similar terms
  const reschedulePatterns = [
    /\b(?:reschedule|postpone|move)\s+(?:my|the)?\s+([a-z0-9\s'-]+)(?:\s+event)?\b/i
  ];
  
  for (const pattern of reschedulePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const eventTitle = match[1].trim();
      console.log(`Detected reschedule request for: "${eventTitle}"`);
      const eventId = await findEventByTitle(eventTitle);
      if (eventId) return eventId;
    }
  }
  
  return null;
};

/**
 * Find event by title with improved fuzzy matching
 */
export const findEventByTitle = async (searchTitle: string): Promise<string | null> => {
  if (!searchTitle || searchTitle.trim().length < 2) {
    console.log("Search title too short or empty");
    return null;
  }
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("No authenticated user found");
      return null;
    }
    
    console.log(`Finding event with title similar to: "${searchTitle}"`);
    
    // Try exact match first (case-insensitive)
    let { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .ilike('title', searchTitle)
      .order('start_time', { ascending: false })
      .limit(1);
      
    if (error) {
      console.error('Error in exact match lookup:', error);
      return null;
    }
    
    // If no exact match, try partial match
    if (!events || events.length === 0) {
      const { data: partialEvents, error: partialError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .ilike('title', `%${searchTitle}%`)
        .order('start_time', { ascending: false })
        .limit(1);
        
      if (partialError) {
        console.error('Error in partial match lookup:', partialError);
        return null;
      }
      
      events = partialEvents;
    }
    
    // If still no match, try with individual words
    if (!events || events.length === 0) {
      // Split into words and filter out very short words
      const words = searchTitle.split(/\s+/).filter(word => word.length > 2);
      
      for (const word of words) {
        const { data: wordEvents, error: wordError } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id)
          .ilike('title', `%${word}%`)
          .order('start_time', { ascending: false })
          .limit(1);
          
        if (wordError) {
          console.error(`Error in word match lookup for "${word}":`, wordError);
          continue;
        }
        
        if (wordEvents && wordEvents.length > 0) {
          events = wordEvents;
          break;
        }
      }
    }
    
    // If we found an event, return its ID
    if (events && events.length > 0) {
      console.log(`Found event: "${events[0].title}" (ID: ${events[0].id})`);
      return events[0].id;
    }
    
    console.log(`No events found matching "${searchTitle}"`);
    return null;
    
  } catch (error) {
    console.error('Error in findEventByTitle:', error);
    return null;
  }
};

/**
 * Search for events that match a search term
 * Returns an array of matching events
 */
export const searchEvents = async (searchTerm: string, limit = 5): Promise<any[]> => {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return [];
  }
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("No authenticated user found");
      return [];
    }
    
    // Try a partial match
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .ilike('title', `%${searchTerm}%`)
      .order('start_time', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.error('Error searching events:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in searchEvents:', error);
    return [];
  }
};

/**
 * Extract potential event title from message text with improved precision
 */
export const extractEventTitleFromMessage = (message: string): string => {
  // Check for common edit patterns first
  for (const pattern of EDIT_COMMAND_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      // For possessive patterns
      if (pattern.toString().includes("'s") && match[2]) {
        return `${match[1]} ${match[2]}`.trim();
      }
      return match[1].trim();
    }
  }
  
  // Check for reschedule patterns
  const rescheduleMatch = message.match(
    /\b(?:reschedule|postpone|move)\s+(?:my|the)?\s+([a-z0-9\s'-]+)(?:\s+event)?\b/i
  );
  if (rescheduleMatch && rescheduleMatch[1]) {
    return rescheduleMatch[1].trim();
  }
  
  // Check for change patterns
  const changeMatch = message.match(
    /\b(?:change|update)\s+(?:the)?\s+(?:time|date|location|details)\s+(?:of|for)\s+(?:my|the)?\s+([a-z0-9\s'-]+)(?:\s+event)?\b/i
  );
  if (changeMatch && changeMatch[1]) {
    return changeMatch[1].trim();
  }
  
  // Fallback to original implementation
  const eventTitleMatches = message.match(
    /(?:update|change|move|reschedule|edit)(?:\s+the)?(?:\s+)(?:([a-z']+(?:'s|s))\s+([a-z\s]+))/i
  );
  
  if (eventTitleMatches && (eventTitleMatches[1] || eventTitleMatches[2])) {        
    return `${eventTitleMatches[1] || ''} ${eventTitleMatches[2] || ''}`.trim();
  }
  
  return '';
};

/**
 * Create event preview from API response data
 */
export const createEventPreviewFromApiData = (eventData: any): EventPreviewData | null => {
  if (!eventData) return null;
  
  // Create date object based on response
  let eventDateObj;
  
  // Handle various date formats that might be returned
  if (eventData.date === "tomorrow") {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    eventDateObj = tomorrow;
  } else if (eventData.date === "today") {
    eventDateObj = new Date();
  } else if (eventData.date) {
    // Try to parse the date string
    try {
      eventDateObj = dateUtils.parseNaturalDate(eventData.date);
    } catch (e) {
      console.error("Error parsing date:", e);
      eventDateObj = new Date(); // Default to today if parsing fails
    }
  } else {
    // If no date specified, default to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    eventDateObj = tomorrow;
  }
  
  // Create the event preview object
  return {
    id: eventData.id || undefined,
    title: eventData.title || "New Event",
    date: eventDateObj,
    startTime: eventData.start_time || "",
    endTime: eventData.end_time || "",
    location: eventData.location || "",
    isRecurring: eventData.is_recurring || false,
    recurrencePattern: eventData.recurrence_pattern || ""
  };
};

/**
 * Prepare event data from preview for database storage
 * Updated to support family events
 */
export const prepareEventForSaving = (
  eventPreview: EventPreviewData,
  userId: string,
  familyId: string | null = null
): any => {
  // Create a proper date object from the preview data
  const eventDate = eventPreview.date;
  
  // Extract start time or use default
  let startTime = eventDate;
  if (eventPreview.startTime) {
    // Try to parse the time from the string
    try {
      const timeParts = eventPreview.startTime.match(/(\d+):?(\d+)?\s*([AP]M)?/i);
      if (timeParts) {
        let hours = parseInt(timeParts[1], 10);
        const minutes = timeParts[2] ? parseInt(timeParts[2], 10) : 0;
        const period = timeParts[3] ? timeParts[3].toUpperCase() : null;
        
        // Convert 12-hour format to 24-hour if needed
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        
        startTime = new Date(eventDate);
        startTime.setHours(hours, minutes, 0, 0);
      }
    } catch (error) {
      console.error('Error parsing start time:', error);
      // Fall back to date without specific time
    }
  }
  
  // Calculate end time if available
  let endTime = null;
  if (eventPreview.endTime) {
    try {
      const timeParts = eventPreview.endTime.match(/(\d+):?(\d+)?\s*([AP]M)?/i);
      if (timeParts) {
        let hours = parseInt(timeParts[1], 10);
        const minutes = timeParts[2] ? parseInt(timeParts[2], 10) : 0;
        const period = timeParts[3] ? timeParts[3].toUpperCase() : null;
        
        // Convert 12-hour format to 24-hour if needed
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        
        endTime = new Date(eventDate);
        endTime.setHours(hours, minutes, 0, 0);
      }
    } catch (error) {
      console.error('Error parsing end time:', error);
    }
  }
  
  // Prepare recurrence pattern if needed
  let recurrencePattern = null;
  if (eventPreview.isRecurring && eventPreview.recurrencePattern) {
    try {
      // If it's a JSON string, parse it
      if (typeof eventPreview.recurrencePattern === 'string' && 
          eventPreview.recurrencePattern.startsWith('{')) {
        recurrencePattern = JSON.parse(eventPreview.recurrencePattern);
      } else {
        // Otherwise use it as a string description
        recurrencePattern = { description: eventPreview.recurrencePattern };
      }
    } catch (error) {
      console.error('Error parsing recurrence pattern:', error);
      recurrencePattern = { description: eventPreview.recurrencePattern };
    }
  }
  
  // Determine if we're updating an existing event or creating a new one
  const isUpdating = !!eventPreview.id;
  
  // Create the base event data, setting ownership based on selected family
  interface EventData {
    user_id: string | null;
    family_id: string | null;
    title: string;
    description: string;
    start_time: string;
    end_time: string | null;
    location: string | null;
    is_recurring: boolean;
    recurrence_pattern: any;
    updated_at: string;
    source?: string;
  }
  
  const eventData: EventData = {
    user_id: familyId ? null : userId,   // For personal events
    family_id: familyId,                 // For family events
    title: eventPreview.title,
    description: '', // Add a description field if needed
    start_time: startTime.toISOString(),
    end_time: endTime ? endTime.toISOString() : null,
    location: eventPreview.location || null,
    is_recurring: eventPreview.isRecurring || false,
    recurrence_pattern: recurrencePattern,
    updated_at: new Date().toISOString()
  };
  
  // Add source property only for new events
  if (!isUpdating) {
    eventData.source = 'chat';
  }
  
  return {
    data: eventData,
    isUpdating
  };
}; 