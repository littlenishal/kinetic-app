// frontend/src/hooks/useConversation.ts
import { useState, useEffect, useCallback } from 'react';
import { Message, createMessage } from '../utils/messageUtils';
import * as chatService from '../services/chatService';

export default function useConversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  
  // Load conversation history from database
  useEffect(() => {
    const loadConversation = async () => {
      try {
        setLoading(true);
        
        const { messages: loadedMessages, id } = await chatService.fetchConversation();
        
        if (loadedMessages.length > 0) {
          console.log(`Loaded ${loadedMessages.length} messages from conversation ${id}`);
          setMessages(loadedMessages);
          setConversationId(id);
        } else {
          // Add welcome message if no conversation exists
          const welcomeMessage = createMessage(
            'assistant',
            'Hello! I\'m your family assistant. You can create events by typing things like "Schedule soccer practice on Tuesday at 4pm" or ask me "What\'s happening this weekend?"'
          );
          
          setMessages([welcomeMessage]);
          
          // Create a new conversation in the database with the welcome message
          const { success, id: newId } = await chatService.saveConversation([welcomeMessage]);
          
          if (success && newId) {
            console.log(`Created new conversation with ID ${newId}`);
            setConversationId(newId);
          } else {
            console.error("Failed to create new conversation");
          }
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };
    
    loadConversation();
  }, []);
  
  // Save all messages to the conversation
  const saveMessages = useCallback(async (messagesToSave: Message[]) => {
    if (!initialized) return false;
    
    try {
      console.log(`Saving ${messagesToSave.length} messages to conversation ${conversationId || 'new'}`);
      const { success, id } = await chatService.saveConversation(messagesToSave, conversationId);
      
      if (success && id && !conversationId) {
        console.log(`Setting conversation ID to ${id}`);
        setConversationId(id);
      }
      
      return success;
    } catch (error) {
      console.error('Error saving messages:', error);
      return false;
    }
  }, [conversationId, initialized]);
  
  // Add a user message to the conversation
  const addUserMessage = useCallback(async (content: string) => {
    // Create new message
    const userMessage = createMessage('user', content);
    
    console.log('Adding user message:', content);
    
    // Update local state first for immediate UI update
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    
    // Save conversation with user message
    await saveMessages(updatedMessages);
    
    return updatedMessages;
  }, [messages, saveMessages]);
  
  // Add an assistant/system message to the conversation
  const addAssistantMessage = useCallback(async (content: string) => {
    // Create new message
    const assistantMessage = createMessage('assistant', content);
    
    console.log('Adding assistant message:', content.substring(0, 50) + (content.length > 50 ? '...' : ''));
    
    // Update local state first for immediate UI update
    const updatedMessages = [...messages, assistantMessage];
    setMessages(updatedMessages);
    
    // Save conversation with assistant message
    await saveMessages(updatedMessages);
    
    return updatedMessages;
  }, [messages, saveMessages]);
  
  // Process a user message and get a response
  const processUserMessage = useCallback(async (
    userContent: string,
    searchTitle?: string
  ) => {
    try {
      // We don't need to add the user message here since it should already be added
      // by the calling component before processing
      const currentMessages = [...messages];
      
      // Process the message through the API
      setLoading(true);
      const response = await chatService.processMessage(
        userContent,
        currentMessages,
        searchTitle
      );
      
      // Add assistant response to messages
      await addAssistantMessage(response.message);
      
      // Return full API response
      return { 
        success: true, 
        response 
      };
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Add error message
      await addAssistantMessage(
        'Sorry, I encountered an error while processing your message. Please try again.'
      );
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      setLoading(false);
    }
  }, [messages, addAssistantMessage]);
  
  return {
    messages,
    loading,
    initialized,
    conversationId,
    addUserMessage,
    addAssistantMessage,
    processUserMessage,
    saveMessages
  };
}