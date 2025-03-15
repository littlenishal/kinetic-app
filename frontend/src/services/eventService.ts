// frontend/src/services/eventService.ts - Updated for family support
import { supabase } from './supabaseClient';
import { EventPreviewData } from '../utils/eventUtils';

/**
 * Create a new event in the database
 */
export const createEvent = async (eventData: any, familyId: string | null = null) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // Set owner based on whether this is a personal or family event
    const finalEventData = {
      ...eventData,
      user_id: familyId ? null : user.id, // Set user_id only for personal events
      family_id: familyId               // Set family_id only for family events
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
export const updateEvent = async (eventId: string, eventData: any, familyId: string | null = null) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // Remove id from the update data if present
    const { id, user_id, family_id, ...updateData } = eventData;
    
    // Prepare the update query
    let query = supabase
      .from('events')
      .update({
        ...updateData,
        user_id: familyId ? null : user.id,   // Update ownership if needed
        family_id: familyId,                  // Update family association
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId)
      .select('*')
      .single();
    
    // Apply appropriate filters based on current mode
    if (familyId) {
      // If editing a family event, ensure it belongs to this family
      query = query.eq('family_id', familyId);
    } else {
      // If editing a personal event, ensure it belongs to this user
      query = query.eq('user_id', user.id);
    }
      
    const { data, error } = await query;
      
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
export const deleteEvent = async (eventId: string, familyId: string | null = null) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // Build delete query with appropriate filters
    let query = supabase
      .from('events')
      .delete()
      .eq('id', eventId);
    
    // Apply appropriate filters based on current mode
    if (familyId) {
      // If deleting a family event, ensure it belongs to this family
      query = query.eq('family_id', familyId);
    } else {
      // If deleting a personal event, ensure it belongs to this user
      query = query.eq('user_id', user.id);
    }
      
    const { error } = await query;
      
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
    
    // Query for the event - either personal (user_id) or family (family_id in user's families)
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        family:family_id (
          id,
          name
        )
      `)
      .eq('id', eventId)
      .or(`user_id.eq.${user.id},family_id.in.(${getFamilyIdsQuery()})`)
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
export const saveEventFromPreview = async (
  preview: EventPreviewData, 
  preparedData: any,
  familyId: string | null = null
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    const { data, isUpdating } = preparedData;
    let result;
    
    // Adding family_id or user_id to the data
    const eventData = {
      ...data,
      user_id: familyId ? null : user.id,
      family_id: familyId
    };
    
    if (isUpdating && preview.id) {
      // Update existing event
      result = await updateEvent(preview.id, eventData, familyId);
    } else {
      // Create new event
      result = await createEvent(eventData, familyId);
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

/**
 * Convert an event from family to personal or vice versa
 */
export const convertEventOwnership = async (
  eventId: string, 
  toFamilyId: string | null
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // First fetch the event to verify ownership
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .or(`user_id.eq.${user.id},family_id.in.(${getFamilyIdsQuery()})`)
      .single();
      
    if (fetchError || !event) {
      throw new Error('Event not found or you do not have permission to modify it');
    }
    
    // Update ownership
    const { error: updateError } = await supabase
      .from('events')
      .update({
        user_id: toFamilyId ? null : user.id,
        family_id: toFamilyId,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId);
      
    if (updateError) throw updateError;
    
    return { success: true };
  } catch (error) {
    console.error('Error converting event ownership:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update event ownership' 
    };
  }
};

/**
 * Helper function to generate the SQL for querying family IDs
 * Returns a query fragment for family IDs the user belongs to
 */
const getFamilyIdsQuery = () => {
  return `
    SELECT family_id FROM family_members 
    WHERE user_id = auth.uid() 
    AND invitation_accepted = true
  `;
};