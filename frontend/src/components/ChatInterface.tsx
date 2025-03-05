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
interface EventPreview {
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
  const [eventPreview, setEventPreview] = useState<EventPreview | null>(null);
  
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
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Handle unauthenticated state
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
        const { data: { session } } = await supabase.auth.getSession();
        
        // Call Supabase Edge Function with proper URL and auth
        const response = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/chat-processing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            message: inputMessage,
            conversation_history: messages.slice(-10) // Send last 10 messages for context
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to get response');
        }
      
      const data = await response.json();
      
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
        setEventPreview({
            title: data.event.title,
            date: new Date(data.event.start_time),
            startTime: data.event.start_time ? new Date(data.event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
            endTime: data.event.end_time ? new Date(data.event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
            location: data.event.location,
            isRecurring: data.event.is_recurring || false,
            recurrencePattern: data.event.recurrence_pattern ? JSON.stringify(data.event.recurrence_pattern) : undefined
          });
      }
      
      // Save conversation to Supabase
      const allMessages = [...messages, userMessage, assistantMessage];
      await supabase
        .from('conversations')
        .upsert({
          user_id: user.id,
          messages: allMessages,
          updated_at: new Date()
        });
      
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Add error message to chat
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      
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
      // Save event to Supabase
      const { data, error } = await supabase
        .from('events')
        .insert({
          user_id: user.id,
          title: eventPreview.title,
          start_time: eventPreview.date,
          location: eventPreview.location,
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