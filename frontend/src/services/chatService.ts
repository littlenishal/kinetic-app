// frontend/src/services/chatService.ts
import { supabase } from './supabaseClient';
import { Message } from '../utils/messageUtils';

interface ProcessMessageResult {
  message: string;
  intent?: string;
  event?: any;
  events?: any[];
  existing_event_id?: string;
  error?: string;
}

/**
 * Process a message through the chat-processing endpoint
 */
export const processMessage = async (
  message: string,
  conversationHistory: Message[],
  searchTitle?: string
): Promise<ProcessMessageResult> => {
  try {
    // Get a fresh JWT token
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
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
        message,
        conversation_history: conversationHistory.slice(-10), // Send last 10 messages for context
        search_title: searchTitle // Pass potential event title for more accurate matching
      }),
    });
    
    if (!response.ok) {
      let errorMessage = `Server responded with status ${response.status}`;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (parseError) {
        console.error('Could not parse error response');
      }
      
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('Error processing message:', error);
    return {
      message: 'Sorry, I encountered an error while processing your message. Please try again.',
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * Save conversation to database
 */
export const saveConversation = async (
  messages: Message[],
  conversationId: string | null = null
): Promise<{ success: boolean; id?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('No authenticated user found when saving conversation');
      return { success: false };
    }
    
    // Ensure message timestamps are serialized properly
    const processedMessages = messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp instanceof Date 
        ? msg.timestamp.toISOString() 
        : msg.timestamp
    }));
    
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
        return { success: false };
      }
      
      return { success: true, id: conversationId };
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
        return { success: false };
      }
      
      return { success: true, id: data?.id };
    }
  } catch (error) {
    console.error('Error in saveConversation:', error);
    return { success: false };
  }
};

/**
 * Fetch conversation history for current user
 */
export const fetchConversation = async (): Promise<{ messages: Message[]; id: string | null }> => {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log("No authenticated user found");
      return { messages: [], id: null };
    }
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1);
      
    if (error) {
      console.error('Error fetching conversation:', error);
      return { messages: [], id: null };
    }
    
    if (data && data.length > 0 && Array.isArray(data[0].messages) && data[0].messages.length > 0) {
      // Parse the messages and ensure timestamp is a Date object
      const parsedMessages = data[0].messages.map((msg: Message) => ({
        ...msg,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
      }));
      
      return { messages: parsedMessages, id: data[0].id };
    }
    
    return { messages: [], id: null };
  } catch (error) {
    console.error('Error in fetchConversation:', error);
    return { messages: [], id: null };
  }
};