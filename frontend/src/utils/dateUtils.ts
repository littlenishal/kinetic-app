/**
 * Enhanced utility functions for working with dates in the app
 * with improved timezone handling
 */

/**
 * Format a date to display in a user-friendly format
 */
export const formatDate = (date: Date): string => {
  // Ensure we have a valid date object
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.error('Invalid date passed to formatDate:', date);
    return 'Invalid date';
  }

  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format a time to display in a user-friendly format (12-hour clock with AM/PM)
 */
export const formatTime = (date: Date): string => {
  // Ensure we have a valid date object
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.error('Invalid date passed to formatTime:', date);
    return 'Invalid time';
  }

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Format a date and time together
 */
export const formatDateTime = (date: Date): string => {
  return `${formatDate(date)} at ${formatTime(date)}`;
};

/**
 * Get a relative date description (Today, Tomorrow, etc.)
 */
export const getRelativeDateDescription = (date: Date): string => {
  // Ensure we have a valid date object
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.error('Invalid date passed to getRelativeDateDescription:', date);
    return 'Unknown date';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  
  if (dateOnly.getTime() === today.getTime()) {
    return 'Today';
  } else if (dateOnly.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  } else {
    // Get the day name (Monday, Tuesday, etc.)
    const dayName = date.toLocaleDateString(undefined, { weekday: 'long' });
    
    // If within the next 7 days, return day name
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    if (dateOnly < nextWeek) {
      return dayName;
    }
    
    // Otherwise, return the full date
    return `${dayName}, ${formatDate(date)}`;
  }
};

/**
 * Calculate event duration in minutes
 */
export const getEventDuration = (startDate: Date, endDate: Date): number => {
  // Ensure we have valid date objects
  if (!(startDate instanceof Date) || !(endDate instanceof Date) || 
      isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.error('Invalid dates passed to getEventDuration:', startDate, endDate);
    return 0;
  }

  const durationMs = endDate.getTime() - startDate.getTime();
  return Math.floor(durationMs / (1000 * 60)); // Convert ms to minutes
};

/**
 * Format event duration in a human-readable format
 */
export const formatDuration = (durationMinutes: number): string => {
  if (durationMinutes < 60) {
    return `${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}`;
  } else {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    let result = `${hours} hour${hours !== 1 ? 's' : ''}`;
    if (minutes > 0) {
      result += ` ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    
    return result;
  }
};

/**
 * Parse a date string safely, with fallback
 */
export const safeParseDate = (dateStr: string): Date => {
  try {
    const parsedDate = new Date(dateStr);
    
    // Check if the date is valid
    if (isNaN(parsedDate.getTime())) {
      console.error('Invalid date string:', dateStr);
      return new Date(); // Fallback to current date
    }
    
    return parsedDate;
  } catch (error) {
    console.error('Error parsing date:', error);
    return new Date(); // Fallback to current date
  }
};

/**
 * Parse a time string and apply it to a base date
 * Handles various formats like "3:30 PM", "15:30", etc.
 */
export const applyTimeToDate = (baseDate: Date, timeStr: string): Date => {
  try {
    const result = new Date(baseDate);
    
    // Check for 24-hour format (HH:MM)
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      let hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      
      // Check for AM/PM indicator
      const isPM = timeStr.toLowerCase().includes('pm');
      const isAM = timeStr.toLowerCase().includes('am');
      
      // Adjust hours for 12-hour format
      if (isPM && hours < 12) {
        hours += 12;
      } else if (isAM && hours === 12) {
        hours = 0;
      }
      
      result.setHours(hours, minutes, 0, 0);
    } else {
      // Try to use the browser's date parsing
      const fullTimeStr = `${baseDate.toDateString()} ${timeStr}`;
      const parsed = new Date(fullTimeStr);
      
      if (!isNaN(parsed.getTime())) {
        result.setHours(parsed.getHours(), parsed.getMinutes(), 0, 0);
      } else {
        console.error('Unable to parse time string:', timeStr);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error applying time to date:', error);
    return baseDate; // Return the original date if parsing fails
  }
};

/**
 * Check if a date is in the past
 */
export const isPastDate = (date: Date): boolean => {
  const now = new Date();
  return date < now;
};

/**
 * Get the start and end of the current week (Sunday to Saturday)
 */
export const getCurrentWeekRange = (): { start: Date, end: Date } => {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - currentDay);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  return { start: startOfWeek, end: endOfWeek };
};