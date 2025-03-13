// frontend/src/hooks/useEventManagement.ts
import { useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import * as eventService from '../services/eventService';
import { EventPreviewData, 
  checkForEditRequest, 
  prepareEventForSaving, 
  findEventByTitle,
  createEventPreviewFromApiData } from '../utils/eventUtils';

export default function useEventManagement() {
  const [eventPreview, setEventPreview] = useState<EventPreviewData | null>(null);
  const [eventEditId, setEventEditId] = useState<string | null>(null);
  
  // Reset all event-related states
  const resetEventStates = useCallback(() => {
    setEventPreview(null);
    setEventEditId(null);
  }, []);
  
  // Check if a message contains a direct edit request
  const checkMessageForEditRequest = useCallback(async (message: string) => {
    try {
      const eventId = await checkForEditRequest(message);
      if (eventId) {
        setEventEditId(eventId);
        setEventPreview(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking for edit request:', error);
      return false;
    }
  }, []);
  
  // Handle API response for potential event actions
  const handleEventFromApiResponse = useCallback(async (
    apiResponse: any,
    messageText: string,
    searchTitle?: string
  ) => {
    // Check for explicit edit/update intents
    if ((apiResponse.intent === 'update_event' || apiResponse.intent === 'edit_event')) {
      // First check if we have an explicit event ID from the API
      let eventId = apiResponse.existing_event_id || (apiResponse.event && apiResponse.event.id);
      
      if (eventId) {
        console.log(`API returned event ID for editing: ${eventId}`);
        setEventEditId(eventId);
        setEventPreview(null);
        return { action: 'edit', eventId };
      } 
      // If no event ID but we have a title, try to find it
      else if (apiResponse.event && apiResponse.event.title) {
        console.log(`Looking up event by title from API: "${apiResponse.event.title}"`);
        const foundEventId = await findEventByTitle(apiResponse.event.title);
        if (foundEventId) {
          setEventEditId(foundEventId);
          setEventPreview(null);
          return { action: 'edit', eventId: foundEventId };
        }
      } 
      // Last resort: look through the message for clues
      else if (searchTitle) {
        console.log(`Looking up event by extracted title: "${searchTitle}"`);
        const foundEventId = await findEventByTitle(searchTitle);
        if (foundEventId) {
          setEventEditId(foundEventId);
          setEventPreview(null);
          return { action: 'edit', eventId: foundEventId };
        }
      }
    }
    
    // For new events, create a preview
    if (apiResponse.event) {
      console.log("Event data received from API:", apiResponse.event);
      const newEventPreview = createEventPreviewFromApiData(apiResponse.event);
      
      if (newEventPreview) {
        setEventPreview(newEventPreview);
        setEventEditId(null);
        return { action: 'preview', eventPreview: newEventPreview };
      }
    }
    
    // If no clear action detected
    return { action: 'none' };
  }, []);
  
  // Confirm and save event from preview
  const confirmEvent = useCallback(async () => {
    if (!eventPreview) return { success: false, error: 'No event preview to confirm' };
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');
      
      // Prepare event data for saving
      const preparedData = prepareEventForSaving(eventPreview, user.id);
      
      // Save the event
      const result = await eventService.saveEventFromPreview(eventPreview, preparedData);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // Clear the preview after successful save
      setEventPreview(null);
      
      return {
        success: true,
        isUpdate: !!eventPreview.id,
        title: eventPreview.title,
        data: result.data
      };
    } catch (error) {
      console.error('Error confirming event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save event'
      };
    }
  }, [eventPreview]);
  
  // Handle saving an edited event
  const saveEditedEvent = useCallback(async (updatedEvent: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');
      
      // Update the event in the database
      const result = await eventService.updateEvent(updatedEvent.id, updatedEvent);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // Clear the edit state
      setEventEditId(null);
      
      return {
        success: true,
        title: updatedEvent.title,
        data: result.data
      };
    } catch (error) {
      console.error('Error saving edited event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update event'
      };
    }
  }, []);
  
  // Cancel event preview or edit
  const cancelEvent = useCallback(() => {
    setEventPreview(null);
    setEventEditId(null);
  }, []);
  
  return {
    eventPreview,
    eventEditId,
    resetEventStates,
    checkMessageForEditRequest,
    handleEventFromApiResponse,
    confirmEvent,
    saveEditedEvent,
    cancelEvent
  };
}