// frontend/src/components/ChatInterface.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../utils/messageUtils';
import { extractEventTitleFromMessage } from '../utils/eventUtils';
import useConversation from '../hooks/useConversation';
import useEventManagement from '../hooks/useEventManagement';
import EventPreview from './EventPreview';
import EventEditPreview from './EventEditPreview';
import '../styles/ChatInterface.css';
import '../styles/EventEditPreview.css';

const ChatInterface: React.FC = () => {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Use our custom hooks
  const {
    messages,
    loading,
    processUserMessage
  } = useConversation();
  
  const {
    eventPreview,
    eventEditId,
    resetEventStates,
    checkMessageForEditRequest,
    handleEventFromApiResponse,
    confirmEvent,
    saveEditedEvent,
    cancelEvent
  } = useEventManagement();

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle form submission
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) return;
    
    // Reset any existing event states
    resetEventStates();
    
    // Store the input and clear the field
    const messageText = inputMessage.trim();
    setInputMessage('');
    
    // First, check if this is a direct edit request
    const isEditRequest = await checkMessageForEditRequest(messageText);
    if (isEditRequest) {
      // No need to process via API if it's a direct edit request
      return;
    }
    
    // Extract potential event title for better search
    const searchTitle = extractEventTitleFromMessage(messageText);
    
    // Process the message through our API
    const { success, response } = await processUserMessage(messageText, searchTitle);
    
    if (success && response) {
      // Handle potential event actions based on the API response
      await handleEventFromApiResponse(response, messageText, searchTitle);
    }
  };

  // Handle event confirmation
  const handleConfirmEvent = async () => {
    const result = await confirmEvent();
    
    if (result.success) {
      // Add confirmation message to conversation
      const action = result.isUpdate ? 'updated' : 'added';
      const content = `Event "${result.title}" has been ${action} to your calendar.`;
      await processUserMessage(`Confirm ${result.title}`);
    }
  };

  // Handle event edit save
  const handleEventEditSave = async (updatedEvent: any) => {
    const result = await saveEditedEvent(updatedEvent);
    
    if (result.success) {
      // Add confirmation message to conversation
      const content = `Event "${result.title}" has been updated in your calendar.`;
      await processUserMessage(`Save updated ${result.title}`);
    }
  };

  // Render message bubbles
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
        
        {/* Event preview for new events */}
        {eventPreview && (
          <EventPreview 
            event={eventPreview}
            onConfirm={handleConfirmEvent}
            onCancel={cancelEvent}
          />
        )}
        
        {/* Event edit form for updating existing events */}
        {eventEditId && (
          <EventEditPreview
            eventId={eventEditId}
            onSave={handleEventEditSave}
            onCancel={cancelEvent}
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
          disabled={loading || !!eventEditId} // Disable input when editing an event
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={!inputMessage.trim() || loading || !!eventEditId} // Disable send button when editing
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