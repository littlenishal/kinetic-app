/**
 * Utility functions for working with dates in the app
 */

/**
 * Format a date to display in a user-friendly format
 */
export const formatDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  /**
   * Format a time to display in a user-friendly format (12-hour clock with AM/PM)
   */
  export const formatTime = (date: Date): string => {
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
      return formatDate(date);
    }
  };
  
  /**
   * Calculate event duration in minutes
   */
  export const getEventDuration = (startDate: Date, endDate: Date): number => {
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
  
  /**
   * Get a date range for "this weekend" (Friday to Sunday)
   */
  export const getWeekendRange = (): { start: Date, end: Date } => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Calculate days until Friday (day 5)
    const daysUntilFriday = currentDay <= 5 ? 5 - currentDay : 5 + 7 - currentDay;
    
    const startOfWeekend = new Date(now);
    startOfWeekend.setDate(now.getDate() + daysUntilFriday);
    startOfWeekend.setHours(17, 0, 0, 0); // 5 PM on Friday
    
    const endOfWeekend = new Date(startOfWeekend);
    endOfWeekend.setDate(startOfWeekend.getDate() + 2); // Sunday
    endOfWeekend.setHours(23, 59, 59, 999);
    
    return { start: startOfWeekend, end: endOfWeekend };
  };
  
  /**
   * Parse a time string in format "HH:MM" or "H:MM" to Date object
   */
  export const parseTimeString = (timeStr: string, baseDate: Date): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    
    return date;
  };