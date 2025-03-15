// frontend/src/hooks/useEventManagement.ts - Enhanced version with family support
import { useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import * as eventService from '../services/eventService';
import { useFamily } from '../contexts/FamilyContext';
import { EventPreviewData, 
  checkForEditRequest, 
  prepareEventForSaving, 
  findEventByTitle,
  searchEvents,
  createEventPreviewFromApiData, 
  extractEventTitleFromMessage } from '../utils/eventUtils';

export default function useEventManagement() {
  const { currentFamilyId } = useFamily();
  const [eventPreview, setEventPreview] = useState<EventPreviewData | null>(null);
  const [eventEditId, setEventEditId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Reset all event-related states
  const resetEventStates = useCallback(() => {
    setEventPreview(null);
    setEventEditId(null);
    setSearchTerm(null);
    setShowSearchResults(false);
  }, []);
  
  // Check if a message contains a direct edit request
  // Return value indicates if message was handled as an edit request
  const checkMessageForEditRequest = useCallback(async (message: string) => {
    try {
      console.log("Checking message for edit request:", message);
      
      // Extract potential search term regardless of match result
      const extractedTitle = extractEventTitleFromMessage(message);
      console.log("Extracted potential event title:", extractedTitle);
      
      // Check for direct edit intent
      const eventId = await checkForEditRequest(message);
      
      if (eventId) {
        console.log("Found direct match for event ID:", eventId);
        // We found a direct match, open the edit form
        setEventEditId(eventId);
        setEventPreview(null);
        setSearchTerm(null);
        setShowSearchResults(false);
        return true;
      } else if (extractedTitle && extractedTitle.length >= 2) {
        console.log("No direct match, but found potential title:", extractedTitle);
        // We have a potential title but no direct match, show search results
        setSearchTerm(extractedTitle);
        setShowSearchResults(true);
        setEventEditId(null);
        setEventPreview(null);
        return true;
      }
      
      console.log("No edit request detected");
      return false;
    } catch (error) {
      console.error('Error checking for edit request:', error);
      return false;
    }
  }, []);
  
  // Handle selecting event from search results
  const handleSelectEventFromSearch = useCallback((eventId: string) => {
    console.log("Selected event from search results:", eventId);
    setEventEditId(eventId);
    setSearchTerm(null);
    setShowSearchResults(false);
  }, []);
  
  // Cancel showing search results
  const handleCancelSearch = useCallback(() => {
    console.log("Cancelling search results");
    setSearchTerm(null);
    setShowSearchResults(false);
  }, []);
  
  // Handle API response for potential event actions
  const handleEventFromApiResponse = useCallback(async (
    apiResponse: any,
    messageText: string,
    searchTitle?: string
  ) => {
    console.log("Processing API response for event actions:", apiResponse.intent);
    
    // Check for explicit edit/update intents
    if ((apiResponse.intent === 'update_event' || apiResponse.intent === 'edit_event')) {
      // First check if we have an explicit event ID from the API
      let eventId = apiResponse.existing_event_id || (apiResponse.event && apiResponse.event.id);
      
      if (eventId) {
        console.log(`API returned event ID for editing: ${eventId}`);
        setEventEditId(eventId);
        setEventPreview(null);
        setSearchTerm(null);
        setShowSearchResults(false);
        return { action: 'edit', eventId };
      } 
      // If no event ID but we have a title, try to find it
      else if (apiResponse.event && apiResponse.event.title) {
        console.log(`Looking up event by title from API: "${apiResponse.event.title}"`);
        const foundEventId = await findEventByTitle(apiResponse.event.title);
        
        if (foundEventId) {
          setEventEditId(foundEventId);
          setEventPreview(null);
          setSearchTerm(null);
          setShowSearchResults(false);
          return { action: 'edit', eventId: foundEventId };
        } else {
          // No direct match, show search results
          setSearchTerm(apiResponse.event.title);
          setShowSearchResults(true);
          return { action: 'search', searchTerm: apiResponse.event.title };
        }
      } 
      // Last resort: look through the message for clues
      else if (searchTitle) {
        console.log(`Looking up event by extracted title: "${searchTitle}"`);
        const foundEventId = await findEventByTitle(searchTitle);
        
        if (foundEventId) {
          setEventEditId(foundEventId);
          setEventPreview(null);
          setSearchTerm(null);
          setShowSearchResults(false);
          return { action: 'edit', eventId: foundEventId };
        } else {
          // No direct match, show search results
          setSearchTerm(searchTitle);
          setShowSearchResults(true);
          return { action: 'search', searchTerm: searchTitle };
        }
      }
    }
    
    // For new events, create a preview
    if (apiResponse.event && apiResponse.intent === 'create_event') {
      console.log("Event data received from API for creation:", apiResponse.event);
      const newEventPreview = createEventPreviewFromApiData(apiResponse.event);
      
      if (newEventPreview) {
        setEventPreview(newEventPreview);
        setEventEditId(null);
        setSearchTerm(null);
        setShowSearchResults(false);
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
      console.log("Confirming event from preview:", eventPreview);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');
      
      // Prepare event data for saving - pass currentFamilyId for proper ownership
      const preparedData = prepareEventForSaving(eventPreview, user.id, currentFamilyId);
      
      // Save the event
      const result = await eventService.saveEventFromPreview(eventPreview, preparedData, currentFamilyId);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      console.log("Event saved successfully:", result.data);
      
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
  }, [eventPreview, currentFamilyId]);
  
  // Handle saving an edited event
  const saveEditedEvent = useCallback(async (updatedEvent: any) => {
    try {
      console.log("Saving edited event:", updatedEvent);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');
      
      // Update the event in the database - pass currentFamilyId
      const result = await eventService.updateEvent(updatedEvent.id, updatedEvent, currentFamilyId);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      console.log("Event updated successfully:", result.data);
      
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
  }, [currentFamilyId]);
  
  // Cancel event preview or edit
  const cancelEvent = useCallback(() => {
    console.log("Cancelling event action");
    setEventPreview(null);
    setEventEditId(null);
    setSearchTerm(null);
    setShowSearchResults(false);
  }, []);
  
  return {
    eventPreview,
    eventEditId,
    searchTerm,
    showSearchResults,
    resetEventStates,
    checkMessageForEditRequest,
    handleEventFromApiResponse,
    handleSelectEventFromSearch,
    handleCancelSearch,
    confirmEvent,
    saveEditedEvent,
    cancelEvent
  };
}