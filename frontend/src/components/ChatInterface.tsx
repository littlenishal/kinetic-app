// frontend/src/components/ChatInterface.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../utils/messageUtils';
import { extractEventTitleFromMessage } from '../utils/eventUtils';
import useConversation from '../hooks/useConversation';
import useEventManagement from '../hooks/useEventManagement';
import EventPreview from './EventPreview';
import EventEditPreview from './EventEditPreview';
import EventSearchResults from './EventSearchResults';
import '../styles/ChatInterface.css';
import '../styles/EventEditPreview.css';
import '../styles/EventSearchResults.css';

const ChatInterface: React.FC = () => {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Use our custom hooks
  const {
    messages,
    loading,
    processUserMessage,
    addUserMessage,
    addAssistantMessage
  } = useConversation();
  
  const {
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
  } = useEventManagement();

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, eventPreview, eventEditId, showSearchResults]);

  // Handle form submission
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) return;
    
    // Reset any existing event states
    resetEventStates();
    
    // Store the input and clear the field
    const messageText = inputMessage.trim();
    setInputMessage('');
    
    // Add user message to the conversation immediately
    await addUserMessage(messageText);
    
    // First, check if this is a direct edit request
    const isEditRequest = await checkMessageForEditRequest(messageText);
    if (isEditRequest) {
      // If it's an edit request, add a response indicating we're processing it
      await addAssistantMessage("I'll help you update that event. Opening the editor...");
      return;
    }
    
    // Extract potential event title for better search
    const searchTitle = extractEventTitleFromMessage(messageText);
    
    // Process the message through our API
    const { success, response } = await processUserMessage(messageText, searchTitle);
    
    if (success && response) {
      // Handle potential event actions based on the API response
      const result = await handleEventFromApiResponse(response, messageText, searchTitle);
      
      // If we couldn't find an event to edit and didn't show search results
      if (response.intent === 'update_event' && result.action === 'none') {
        // Add a helper message
        await addAssistantMessage(
          "I couldn't find that specific event in your calendar. " +
          "You can view and edit all your events in the calendar tab."
        );
      }
    }
  };

  // Handle event confirmation
  const handleConfirmEvent = async () => {
    const result = await confirmEvent();
    
    if (result.success) {
      // Add confirmation message to conversation
      const action = result.isUpdate ? 'updated' : 'added';
      const content = `Event "${result.title}" has been ${action} to your calendar.`;
      await addAssistantMessage(content);
    } else {
      // Add error message to conversation
      await addAssistantMessage(`I couldn't save the event. ${result.error || 'Please try again.'}`);
    }
  };

  // Handle event edit save
  const handleEventEditSave = async (updatedEvent: any) => {
    const result = await saveEditedEvent(updatedEvent);
    
    if (result.success) {
      // Add confirmation message to conversation
      const content = `I've updated "${result.title}" in your calendar.`;
      await addAssistantMessage(content);
    } else {
      // Add error message to conversation
      await addAssistantMessage(`I couldn't update the event. ${result.error || 'Please try again.'}`);
    }
  };
  
  // Handle selecting event from search results
  const handleSelectEvent = async (eventId: string) => {
    handleSelectEventFromSearch(eventId);
    // Add a message to indicate the event was found
    await addAssistantMessage("Opening the event editor...");
  };
  
  // Handle cancel actions
  const handleCancelEventAction = async () => {
    cancelEvent();
    // Add a message to indicate the action was cancelled
    await addAssistantMessage("I've cancelled the event action. Is there something else you'd like to do?");
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
            onCancel={handleCancelEventAction}
          />
        )}
        
        {/* Event search results when we're looking for an event to edit */}
        {showSearchResults && searchTerm && (
          <EventSearchResults
            searchTerm={searchTerm}
            onSelectEvent={handleSelectEvent}
            onCancel={handleCancelSearch}
          />
        )}
        
        {/* Event edit form for updating existing events */}
        {eventEditId && (
          <EventEditPreview
            eventId={eventEditId}
            onSave={handleEventEditSave}
            onCancel={handleCancelEventAction}
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
          disabled={loading || !!eventEditId || showSearchResults} // Disable during event interactions
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={!inputMessage.trim() || loading || !!eventEditId || showSearchResults}
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