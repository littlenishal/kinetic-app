// frontend/src/services/eventService.ts
import { supabase } from './supabaseClient';
import { EventPreviewData } from '../utils/eventUtils';

/**
 * Create a new event in the database
 */
export const createEvent = async (eventData: any) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // Ensure user_id is set
    const finalEventData = {
      ...eventData,
      user_id: user.id
    };
    
    const { data, error } = await supabase
      .from('events')
      .insert(finalEventData)
      .select('*')
      .single();
      
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating event:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create event' 
    };
  }
};

/**
 * Update an existing event in the database
 */
export const updateEvent = async (eventId: string, eventData: any) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // Remove id from the update data if present
    const { id, ...updateData } = eventData;
    
    const { data, error } = await supabase
      .from('events')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId)
      .eq('user_id', user.id) // Ensure we're only updating user's own events
      .select('*')
      .single();
      
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating event:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update event' 
    };
  }
};

/**
 * Delete an event from the database
 */
export const deleteEvent = async (eventId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('user_id', user.id); // Ensure we're only deleting user's own events
      
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting event:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete event' 
    };
  }
};

/**
 * Fetch a single event by ID
 */
export const fetchEventById = async (eventId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .eq('user_id', user.id)
      .single();
      
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching event:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch event' 
    };
  }
};

/**
 * Save event from preview data
 */
export const saveEventFromPreview = async (preview: EventPreviewData, preparedData: any) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    const { data, isUpdating } = preparedData;
    let result;
    
    if (isUpdating && preview.id) {
      // Update existing event
      result = await updateEvent(preview.id, data);
    } else {
      // Create new event
      result = await createEvent(data);
    }
    
    return result;
  } catch (error) {
    console.error('Error saving event from preview:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save event' 
    };
  }
};