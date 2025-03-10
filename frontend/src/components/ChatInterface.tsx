import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import EventPreview from './EventPreview';
import * as dateUtils from '../utils/dateUtils';
import '../styles/ChatInterface.css';

// Message type definition
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Optional event preview component that appears when events are detected
interface EventPreviewData {
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      
      // Add assistant response to the chat
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };
      
      setMessages(prevMessages => [...prevMessages, assistantMessage]);
      
      // If the response includes an event preview, show it
      if (data.event) {
        console.log("Event data received:", data.event);
        
        // Create a base date object from the date string
        let eventDate: Date;
  
        try {
          if (typeof data.event.date === 'string' && data.event.date.includes('-')) {
            // Parse YYYY-MM-DD format
            const [year, month, day] = data.event.date.split('-').map(Number);
            eventDate = new Date(year, month - 1, day);
          } else if (data.event.start_time && data.event.start_time instanceof Date) {
            eventDate = new Date(data.event.start_time);
          } else {
            // Default to tomorrow if we can't parse a date
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            eventDate = tomorrow;
          }
        } catch (error) {
          console.error('Error parsing date:', error);
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          eventDate = tomorrow;
        }
        
        // Set the event preview with all available data
        setEventPreview({
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
      
      console.log("Saving event to database:", {
        title: eventPreview.title,
        start_time: startTime.toISOString(),
        end_time: endTime ? endTime.toISOString() : null,
        location: eventPreview.location,
        is_recurring: eventPreview.isRecurring,
        recurrence_pattern: recurrencePattern
      });
      
      // Save event to Supabase
      const { data, error } = await supabase
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
        
      if (error) throw error;
      
      // Add confirmation message
      const confirmationMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Event "${eventPreview.title}" has been added to your calendar.`,
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

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {messages.map(renderMessage)}
        
        {/* Event preview card */}
        {eventPreview && (
          <EventPreview 
            event={eventPreview}
            onConfirm={handleConfirmEvent}
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
          value={inputMessage}
          onChange={handleInputChange}
          placeholder="Type a message..."
          disabled={loading}
          className="message-input"
        />
        <button 
          type="submit" 
          disabled={loading || !inputMessage.trim()} 
          className="send-button"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;