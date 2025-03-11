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
  timestamp: Date;
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

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [eventPreview, setEventPreview] = useState<EventPreviewData | null>(null);
  const [eventEditId, setEventEditId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Define resetEventStates BEFORE it's used anywhere else
  const resetEventStates = () => {
    setEventPreview(null);
    setEventEditId(null);
  };

  // Load conversation history from Supabase on component mount
  useEffect(() => {
    const fetchConversation = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;
      
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (error) {
        console.error('Error fetching conversation:', error);
        return;
      }
      
      if (data && data.length > 0 && data[0].messages) {
        setMessages(data[0].messages);
      } else {
        // Add welcome message if no conversation exists
        setMessages([
          {
            id: '1',
            role: 'assistant',
            content: 'Hello! I\'m your family assistant. You can create events by typing things like "Schedule soccer practice on Tuesday at 4pm" or ask me "What\'s happening this weekend?"',
            timestamp: new Date()
          }
        ]);
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
    
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInputMessage('');
    setLoading(true);
    
    try {
      // Get a fresh JWT token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.error('No access token found in session');
        throw new Error('No valid session found');
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
          conversation_history: messages.slice(-10) // Send last 10 messages for context
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
      
      // Add this debug log here
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
      
      setMessages(prevMessages => [...prevMessages, assistantMessage]);
      
      // Handle different event-related intents
      if ((data.intent === 'update_event' || data.intent === 'edit_event') && 
        (data.existing_event_id || (data.event && data.event.id))) {
        // For update/edit intents with identified events, show the edit form
        const eventId = data.existing_event_id || (data.event && data.event.id);
        console.log(`Showing edit form for event ID: ${eventId}`);
        console.log(`Setting eventEditId to: ${eventId}`);
        console.log(`Current eventEditId before update: ${eventEditId}`);
        
        if (eventId) {
          setEventEditId(eventId);
          console.log(`EventEditId state set to: ${eventId}`);
          setEventPreview(null);
        } else {
          console.error("No event ID found for edit/update intent");
        }
      } 
      else if (data.event) {
        // For new events or unidentified updates, show the preview
        console.log("Event data received for new event:", data.event);
        
        // Create a base date object from the date string or description
        let eventDate: Date;
  
        try {
          if (typeof data.event.date === 'string') {
            if (data.event.date.includes('-')) {
              // Parse YYYY-MM-DD format
              const [year, month, day] = data.event.date.split('-').map(Number);
              eventDate = new Date(year, month - 1, day);
            } else {
              // Try to parse natural language date reference
              eventDate = dateUtils.parseNaturalDate(data.event.date);
            }
          } else if (typeof data.event.date === 'object' && data.event.date instanceof Date) {
            eventDate = new Date(data.event.date);
          } else if (data.event.start_time && data.event.start_time instanceof Date) {
            eventDate = new Date(data.event.start_time);
          } else {
            // Look for day names in the user message and assistant response
            const combinedText = `${inputMessage} ${data.message}`.toLowerCase();
            
            if (combinedText.includes('sunday')) {
              eventDate = dateUtils.getNextDayOfWeek('sunday');
            } else if (combinedText.includes('monday')) {
              eventDate = dateUtils.getNextDayOfWeek('monday');
            } else if (combinedText.includes('tuesday')) {
              eventDate = dateUtils.getNextDayOfWeek('tuesday');
            } else if (combinedText.includes('wednesday')) {
              eventDate = dateUtils.getNextDayOfWeek('wednesday');
            } else if (combinedText.includes('thursday')) {
              eventDate = dateUtils.getNextDayOfWeek('thursday');
            } else if (combinedText.includes('friday')) {
              eventDate = dateUtils.getNextDayOfWeek('friday');
            } else if (combinedText.includes('saturday')) {
              eventDate = dateUtils.getNextDayOfWeek('saturday');
            } else if (combinedText.includes('tomorrow')) {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              eventDate = tomorrow;
            } else {
              // Try to extract specific dates like March 18
              const specificDateMatch = combinedText.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i);
              if (specificDateMatch) {
                const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
                const monthText = specificDateMatch[1].toLowerCase();
                const monthIndex = monthNames.findIndex(m => monthText.startsWith(m.substring(0, 3)));
                const day = parseInt(specificDateMatch[2]);
                const year = specificDateMatch[3] ? parseInt(specificDateMatch[3]) : new Date().getFullYear();
                
                if (monthIndex >= 0 && day > 0 && day <= 31) {
                  eventDate = new Date(year, monthIndex, day);
                } else {
                  // Default to tomorrow if we can't parse a date
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  eventDate = tomorrow;
                }
              } else {
                // Default to tomorrow if we can't parse a date
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                eventDate = tomorrow;
              }
            }
          }
        } catch (error) {
          console.error('Error parsing date:', error);
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          eventDate = tomorrow;
        }
        
        // Set the event preview with all available data
        setEventPreview({
          id: data.event.id || data.existing_event_id || undefined, // Include the ID if this is updating an existing event
          title: data.event.title || "New Event",
          date: eventDate,
          startTime: data.event.start_time || "",
          endTime: data.event.end_time || "",
          location: data.event.location || "",
          isRecurring: data.event.is_recurring || false,
          recurrencePattern: data.event.recurrence_pattern || ""
        });
        
        console.log("Event preview set:", eventPreview);
      }
      
      // Save conversation to Supabase
      try {
        const allMessages = [...messages, userMessage, assistantMessage];
        
        const { error: conversationError } = await supabase
          .from('conversations')
          .upsert({
            user_id: user.id,
            messages: allMessages,
            updated_at: new Date().toISOString()
          });
          
        if (conversationError) {
          console.error('Error saving conversation:', conversationError);
        }
      } catch (saveError) {
        console.error('Error in conversation save operation:', saveError);
      }
      
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Add error message to chat
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error. Please try again.`,
        timestamp: new Date()
      };
      
      if (error instanceof Error) {
        errorMessage.content = `Sorry, I encountered an error: ${error.message}. Please try again.`;
      }
      
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setLoading(false);
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
      
      setMessages(prevMessages => [...prevMessages, confirmationMessage]);
      setEventPreview(null);
      
    } catch (error) {
      console.error('Error saving event:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I couldn\'t save your event. Please try again.',
        timestamp: new Date()
      };
      
      setMessages(prevMessages => [...prevMessages, errorMessage]);
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
      
      setMessages(prevMessages => [...prevMessages, confirmationMessage]);
      
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
      
      setMessages(prevMessages => [...prevMessages, errorMessage]);
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
    eventPreview: eventPreview ? true : false 
  });

  // Ensure your EventEditPreview component is rendered correctly in the ChatInterface.tsx return block:
  return (
    <div className="chat-interface">
      <div className="messages-container">
        {messages.map(renderMessage)}
        
        {/* Debug message to confirm component rendering logic */}
        {eventEditId && (
          <div style={{ display: 'none' }}>
            Attempting to render EventEditPreview with ID: {eventEditId}
          </div>
        )}
        
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
        {/* Form contents */}
      </form>
    </div>
  );
};

export default ChatInterface;
