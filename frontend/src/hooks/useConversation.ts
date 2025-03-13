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
            setConversationId(newId);
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
  
  // Add a user message to the conversation
  const addUserMessage = useCallback(async (content: string) => {
    const userMessage = createMessage('user', content);
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    
    // Save conversation with user message
    await chatService.saveConversation(updatedMessages, conversationId);
    
    return updatedMessages;
  }, [messages, conversationId]);
  
  // Add an assistant/system message to the conversation
  const addAssistantMessage = useCallback(async (content: string) => {
    const assistantMessage = createMessage('assistant', content);
    const updatedMessages = [...messages, assistantMessage];
    setMessages(updatedMessages);
    
    // Save conversation with assistant message
    await chatService.saveConversation(updatedMessages, conversationId);
    
    return updatedMessages;
  }, [messages, conversationId]);
  
  // Process a user message and get a response
  const processUserMessage = useCallback(async (
    userContent: string,
    searchTitle?: string
  ) => {
    try {
      // First add user message
      const updatedMessages = await addUserMessage(userContent);
      
      // Process the message through the API
      setLoading(true);
      const response = await chatService.processMessage(
        userContent,
        updatedMessages,
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
  }, [addUserMessage, addAssistantMessage]);
  
  return {
    messages,
    loading,
    initialized,
    conversationId,
    addUserMessage,
    addAssistantMessage,
    processUserMessage
  };
};