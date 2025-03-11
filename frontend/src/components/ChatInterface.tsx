// frontend/src/components/ChatInterface.tsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import EventPreview from './EventPreview';
import EventEditPreview from './EventEditPreview';
import * as dateUtils from '../utils/dateUtils';
import '../styles/ChatInterface.css';
import '../styles/EventEditPreview.css';

// Message type definition
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date | string;
}

// Optional event preview component that appears when events are detected
interface EventPreviewData {
  id?: string; // Optional ID for existing events
  title: string;
  date: Date;
  startTime?: string;
  endTime?: string;
  location?: string;
  isRecurring?: boolean;
  recurrencePattern?: string;
}

// Define conversation structure to match DB schema
interface Conversation {
  id?: string;
  user_id: string;
  messages: Message[];
  created_at?: string;
  updated_at?: string;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [eventPreview, setEventPreview] = useState<EventPreviewData | null>(null);
  const [eventEditId, setEventEditId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Define resetEventStates BEFORE it's used anywhere else
  const resetEventStates = () => {
    setEventPreview(null);
    setEventEditId(null);
  };

  // Load conversation history from Supabase on component mount
  useEffect(() => {
    const fetchConversation = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.log("No authenticated user found");
          return;
        }
        
        console.log("Fetching conversation for user:", user.id);
        
        const { data, error } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);
          
        if (error) {
          console.error('Error fetching conversation:', error);
          return;
        }
        
        console.log("Conversation fetch result:", data);
        
        if (data && data.length > 0 && Array.isArray(data[0].messages) && data[0].messages.length > 0) {
          console.log(`Found ${data[0].messages.length} messages in conversation`);
          
          // Store the conversation ID to use for future updates
          setConversationId(data[0].id);
          
          // Parse the messages and ensure timestamp is a Date object
          const parsedMessages = data[0].messages.map((msg: Message) => ({
            ...msg,
            timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
          }));
          
          setMessages(parsedMessages);
        } else {
          console.log("No previous conversation found, adding welcome message");
          // Add welcome message if no conversation exists
          const welcomeMessage: Message = {
            id: '1',
            role: 'assistant',
            content: 'Hello! I\'m your family assistant. You can create events by typing things like "Schedule soccer practice on Tuesday at 4pm" or ask me "What\'s happening this weekend?"',
            timestamp: new Date()
          };
          
          setMessages([welcomeMessage]);
          
          // Create a new conversation in the database with the welcome message
          const { data: newConversation, error: saveError } = await supabase
            .from('conversations')
            .insert({
              user_id: user.id,
              messages: [welcomeMessage],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select('id')
            .single();
            
          if (saveError) {
            console.error('Error creating initial conversation:', saveError);
          } else if (newConversation) {
            console.log('Created new conversation with ID:', newConversation.id);
            setConversationId(newConversation.id);
          }
        }
      } catch (error) {
        console.error('Error in fetchConversation:', error);
      } finally {
        setInitialized(true);
      }
    };
    
    fetchConversation();
  }, []);

  // Auto-scroll to bottom of message list when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
  };

  // Function to save conversation to database
  const saveConversation = async (messagesToSave: Message[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No authenticated user found when saving conversation');
        return false;
      }
      
      // Ensure message timestamps are serialized properly
      const processedMessages = messagesToSave.map(msg => ({
        ...msg,
        timestamp: msg.timestamp instanceof Date 
          ? msg.timestamp.toISOString() 
          : msg.timestamp
      }));
      
      console.log(`Saving ${processedMessages.length} messages to conversation. ConversationId: ${conversationId}`);
      
      // If we have a conversation ID, update that conversation
      if (conversationId) {
        const { error } = await supabase
          .from('conversations')
          .update({
            messages: processedMessages,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversationId)
          .eq('user_id', user.id);
          
        if (error) {
          console.error('Error updating conversation:', error);
          return false;
        }
        
        console.log('Conversation updated successfully');
        return true;
      } 
      // Otherwise create a new conversation
      else {
        const { data, error } = await supabase
          .from('conversations')
          .insert({
            user_id: user.id,
            messages: processedMessages,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();
          
        if (error) {
          console.error('Error creating new conversation:', error);
          return false;
        }
        
        if (data) {
          console.log('Created new conversation with ID:', data.id);
          setConversationId(data.id);
        }
        
        return true;
      }
    } catch (error) {
      console.error('Error in saveConversation:', error);
      return false;
    }
  };

  // Updated handleSendMessage function with fixes for event detection and preview
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) return;
    
    // Get user information
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please sign in to continue');
      return;
    }
    
    // Reset any existing event states
    resetEventStates();
    
    // Add user message to the chat
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setLoading(true);
    
    // Save conversation with user message before API call
    await saveConversation(updatedMessages);
    
    try {
      // Get a fresh JWT token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.error('No access token found in session');
        throw new Error('No valid session found');
      }
      
      // Look for event titles in the message for improved matching
      const eventTitleMatches = inputMessage.match(/(?:update|change|move|reschedule|edit)(?:\s+the)?(?:\s+)(?:([a-z']+(?:'s|s))\s+([a-z\s]+))/i);
      let searchTitle = '';
      
      if (eventTitleMatches && (eventTitleMatches[1] || eventTitleMatches[2])) {
        searchTitle = `${eventTitleMatches[1] || ''} ${eventTitleMatches[2] || ''}`.trim();
        console.log(`Detected potential event title for update: "${searchTitle}"`);
      }
      
      // Define the endpoint
      const endpoint = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/chat-processing`;
      
      // Call Supabase Edge Function with proper authentication
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: inputMessage,
          conversation_history: updatedMessages.slice(-10), // Send last 10 messages for context
          search_title: searchTitle // Pass potential event title for more accurate matching
        }),
      });
      
      if (!response.ok) {
        let errorMessage = `Server responded with status ${response.status}`;
        
        try {
          const errorData = await response.json();
          console.error('Error response:', errorData);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          console.error('Could not parse error response');
        }
        
        throw new Error(errorMessage);
      }
  
      const data = await response.json();
      console.log("Response from chat processing:", data);
      
      // Enhanced debug logging
      console.log("API response data:", {
        intent: data.intent,
        existing_event_id: data.existing_event_id,
        event: data.event ? {
          id: data.event.id,
          title: data.event.title
        } : null
      });
      
      // Add assistant response to the chat
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };
      
      const messagesWithResponse = [...updatedMessages, assistantMessage];
      setMessages(messagesWithResponse);
      
      // Save the conversation with the assistant's response
      await saveConversation(messagesWithResponse);
      
      // ---- IMPROVED EVENT HANDLING ----
      
      // First check for explicit edit/update intents with an event ID
      if ((data.intent === 'update_event' || data.intent === 'edit_event') && 
          (data.existing_event_id || (data.event && data.event.id))) {
        
        const eventId = data.existing_event_id || (data.event && data.event.id);
        console.log(`Event update detected with ID: ${eventId}`);
        
        if (eventId) {
          // Immediately fetch the event to verify it exists
          try {
            const { data: eventData, error: eventError } = await supabase
              .from('events')
              .select('*')
              .eq('id', eventId)
              .eq('user_id', user.id)
              .single();
              
            if (eventError || !eventData) {
              console.error('Error fetching event or event not found:', eventError);
              // If we can't find the event, try to manually find it by title
              await lookupEventByTitle(searchTitle || "swim lessons");
            } else {
              console.log('Successfully retrieved event for editing:', eventData.title);
              // Set the event edit ID to trigger the edit form
              setEventEditId(eventId);
              setEventPreview(null);
            }
          } catch (lookupError) {
            console.error('Error during event lookup:', lookupError);
          }
        } else {
          console.error("No event ID found for edit/update intent");
          // Try to manually find the event
          await lookupEventByTitle(searchTitle || "swim lessons");
        }
      } 
      else if (data.intent === 'update_event' && searchTitle) {
        // If we have an update intent but no ID, try to find the event by title
        await lookupEventByTitle(searchTitle);
      }
      else if (data.event) {
        // For new events or unidentified updates, show the preview
        console.log("Event data received for new event:", data.event);
        
        // Create event preview from the received data
        let eventDateObj;
        
        // Handle various date formats that might be returned
        if (data.event.date === "tomorrow") {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          eventDateObj = tomorrow;
        } else if (data.event.date === "today") {
          eventDateObj = new Date();
        } else if (data.event.date) {
          // Try to parse the date string
          try {
            eventDateObj = dateUtils.parseNaturalDate(data.event.date);
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
        const newEventPreview: EventPreviewData = {
          id: data.event.id || undefined,
          title: data.event.title || "New Event",
          date: eventDateObj,
          startTime: data.event.start_time || "",
          endTime: data.event.end_time || "",
          location: data.event.location || "",
          isRecurring: data.event.is_recurring || false,
          recurrencePattern: data.event.recurrence_pattern || ""
        };
        
        console.log("Creating event preview:", newEventPreview);
        setEventPreview(newEventPreview);
      }
      
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Add error message to the chat
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your message. Please try again.',
        timestamp: new Date()
      };
      
      // Update local state with error message
      const updatedMessagesWithError = [...updatedMessages, errorMessage];
      setMessages(updatedMessagesWithError);
      
      // Still save conversation with the error message
      try {
        await saveConversation(updatedMessagesWithError);
      } catch (saveError) {
        console.error('Failed to save conversation with error message:', saveError);
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper function to look up events by title
  const lookupEventByTitle = async (title: string) => {
    if (!title) return false;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      
      console.log(`Looking up event by title: "${title}"`);
      
      // Try to find events with similar titles
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .ilike('title', `%${title}%`)
        .order('start_time', { ascending: false })
        .limit(1);
        
      if (error) {
        console.error('Error looking up event by title:', error);
        return false;
      }
      
      if (events && events.length > 0) {
        console.log(`Found event by title: "${events[0].title}" (ID: ${events[0].id})`);
        setEventEditId(events[0].id);
        setEventPreview(null);
        return true;
      } else {
        console.log(`No events found with title containing "${title}"`);
        return false;
      }
    } catch (error) {
      console.error('Error in lookupEventByTitle:', error);
      return false;
    }
  };

  const handleConfirmEvent = async () => {
    // Logic to confirm and save the event to the database
    if (!eventPreview) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    try {
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
      
      console.log(isUpdating ? "Updating existing event:" : "Creating new event:", {
        title: eventPreview.title,
        start_time: startTime.toISOString(),
        end_time: endTime ? endTime.toISOString() : null,
        location: eventPreview.location,
        is_recurring: eventPreview.isRecurring,
        recurrence_pattern: recurrencePattern
      });
      
      let result;
      
      if (isUpdating) {
        // Update existing event
        result = await supabase
          .from('events')
          .update({
            title: eventPreview.title,
            description: '', // Add a description field if needed
            start_time: startTime.toISOString(),
            end_time: endTime ? endTime.toISOString() : null,
            location: eventPreview.location || null,
            is_recurring: eventPreview.isRecurring || false,
            recurrence_pattern: recurrencePattern,
            updated_at: new Date().toISOString()
          })
          .eq('id', eventPreview.id)
          .eq('user_id', user.id); // Ensure we're only updating user's own events
          
      } else {
        // Create new event
        result = await supabase
          .from('events')
          .insert({
            user_id: user.id,
            title: eventPreview.title,
            description: '', // Add a description field if needed
            start_time: startTime.toISOString(),
            end_time: endTime ? endTime.toISOString() : null,
            location: eventPreview.location || null,
            is_recurring: eventPreview.isRecurring || false,
            recurrence_pattern: recurrencePattern,
            source: 'chat'
          });
      }
      
      const { error } = result;
      if (error) throw error;
      
      // Add confirmation message
      const actionVerb = isUpdating ? "updated" : "added";
      const confirmationMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Event "${eventPreview.title}" has been ${actionVerb} to your calendar.`,
        timestamp: new Date()
      };
      
      // Update local state
      const updatedMessages = [...messages, confirmationMessage];
      setMessages(updatedMessages);
      setEventPreview(null);
      
      // Save the updated conversation to Supabase
      await saveConversation(updatedMessages);
      
    } catch (error) {
      console.error('Error saving event:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I couldn\'t save your event. Please try again.',
        timestamp: new Date()
      };
      
      // Update local state
      const updatedMessages = [...messages, errorMessage];
      setMessages(updatedMessages);
      
      // Even on error, save the conversation with the error message
      try {
        await saveConversation(updatedMessages);
      } catch (saveError) {
        console.error('Failed to save conversation after event error:', saveError);
      }
    }
  };

  const handleCancelEvent = () => {
    setEventPreview(null);
    setEventEditId(null);
  };
  
  const handleEventEditSave = async (updatedEvent: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Save the updated event to the database
      const { error } = await supabase
        .from('events')
        .update({
          title: updatedEvent.title,
          start_time: updatedEvent.start_time,
          end_time: updatedEvent.end_time,
          location: updatedEvent.location,
          is_recurring: updatedEvent.is_recurring || false,
          recurrence_pattern: updatedEvent.recurrence_pattern,
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedEvent.id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      // Add confirmation message
      const confirmationMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Event "${updatedEvent.title}" has been updated in your calendar.`,
        timestamp: new Date()
      };
      
      // Update local state with the new message
      const updatedMessages = [...messages, confirmationMessage];
      setMessages(updatedMessages);
      
      // Save the updated conversation to Supabase
      await saveConversation(updatedMessages);
      
      // Clear the edit state
      setEventEditId(null);
      
    } catch (error) {
      console.error('Error updating event:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I couldn\'t update your event. Please try again.',
        timestamp: new Date()
      };
      
      // Update local state
      const updatedMessages = [...messages, errorMessage];
      setMessages(updatedMessages);
      
      // Even on error, save the conversation with the error message
      try {
        await saveConversation(updatedMessages);
      } catch (saveError) {
        console.error('Failed to save conversation after event update error:', saveError);
      }
    }
  };

  // Render message bubbles based on role
  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
    
    return (
      <div 
        key={message.id} 
        className={`message-container ${isUser ? 'user-message' : 'assistant-message'}`}
      >
        <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
          {message.content}
        </div>
        <div className="message-timestamp">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    );
  };

  // Log before the return statement
  console.log("Rendering ChatInterface with states:", { 
    eventEditId, 
    eventPreview: eventPreview ? true : false,
    conversationId,
    messageCount: messages.length 
  });

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {messages.map(renderMessage)}
        
        {/* Event preview card for new events */}
        {eventPreview && (
          <EventPreview 
            event={eventPreview}
            onConfirm={handleConfirmEvent}
            onCancel={handleCancelEvent}
          />
        )}
        
        {/* Event edit form for updating existing events */}
        {eventEditId && (
          <EventEditPreview
            eventId={eventEditId}
            onSave={handleEventEditSave}
            onCancel={handleCancelEvent}
          />
        )}
        
        {/* Loading indicator */}
        {loading && (
          <div className="loading-indicator">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <form className="message-input-form" onSubmit={handleSendMessage}>
        <input 
          type="text"
          className="message-input"
          value={inputMessage}
          onChange={handleInputChange}
          placeholder="Type a message..."
          disabled={loading}
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={!inputMessage.trim() || loading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;