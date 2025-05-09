// frontend/src/services/chatService.ts
import { supabase } from './supabaseClient';
import { Message, processMessageTimestamps } from '../utils/messageUtils';

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
    
    // Prepare conversation history - make sure we have both user and assistant messages
    // Only use the last 10 messages for context
    const recentHistory = conversationHistory.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
    
    console.log(`Sending ${recentHistory.length} messages to chat processing endpoint`);
    console.log('Conversation history roles:', recentHistory.map(msg => msg.role).join(', '));
    
    // Call Supabase Edge Function with proper authentication
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        message,
        conversation_history: recentHistory,
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
    const processedMessages = processMessageTimestamps(messages);
    
    console.log(`Saving conversation with ${processedMessages.length} messages. Conversation ID: ${conversationId || 'new'}`);
    
    // Log detailed message info for debugging
    const userMessages = processedMessages.filter(m => m.role === 'user').length;
    const assistantMessages = processedMessages.filter(m => m.role === 'assistant').length;
    console.log(`Message distribution - User: ${userMessages}, Assistant: ${assistantMessages}`);
    
    // Log the complete conversation being saved
    console.log('FULL CONVERSATION BEING SAVED:');
    processedMessages.forEach((msg, idx) => {
      console.log(`[${idx}][${msg.role}]: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`);
    });
    
    // Log some sample messages for debugging
    if (processedMessages.length > 0) {
      const lastFew = processedMessages.slice(-3);
      console.log('Last few messages:', lastFew.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content.substring(0, 30) + (m.content.length > 30 ? '...' : '')
      })));
    }
    
    // If we have a conversation ID, update that conversation
    if (conversationId) {
      // Debug the exact payload we're sending to Supabase
      console.log('Update payload for Supabase:', JSON.stringify({
        messages: processedMessages,
        updated_at: new Date().toISOString()
      }));
      
      // Convert the array to a properly formatted JSONB array
      // For PostgreSQL JSONB[], each message needs to be a separate array item
      const formattedMessages = processedMessages.map(msg => JSON.stringify(msg));
      
      const { error } = await supabase
        .from('conversations')
        .update({
          messages: formattedMessages,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)
        .eq('user_id', user.id);
        
      if (error) {
        console.error('Error updating conversation:', error);
        return { success: false };
      }
      
      console.log(`Successfully updated conversation ${conversationId}`);
      return { success: true, id: conversationId };
    } 
    // Otherwise create a new conversation
    else {
      // Debug the exact payload we're sending to Supabase
      console.log('Insert payload for Supabase:', JSON.stringify({
        user_id: user.id,
        messages: processedMessages,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      // Convert the array to a properly formatted JSONB array
      // For PostgreSQL JSONB[], each message needs to be a separate array item
      const formattedMessages = processedMessages.map(msg => JSON.stringify(msg));
      
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          messages: formattedMessages,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();
        
      if (error) {
        console.error('Error creating new conversation:', error);
        return { success: false };
      }
      
      console.log(`Successfully created new conversation ${data?.id}`);
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
    
    console.log("Fetching conversation for user:", user.id);
    
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
    
    if (data && data.length > 0) {
      console.log(`Found conversation ${data[0].id}`);
      
      // Ensure messages array exists and is valid
      if (!data[0].messages || !Array.isArray(data[0].messages)) {
        console.error('Invalid messages array in conversation:', data[0]);
        return { messages: [], id: data[0].id };
      }
      
      console.log(`Conversation has ${data[0].messages.length} messages`);
      
      // Log a sample of raw messages (up to 3)
      if (data[0].messages.length > 0) {
        console.log('Raw messages sample from database:', 
          JSON.stringify(data[0].messages.slice(0, Math.min(3, data[0].messages.length))));
      }
      
      // Ensure message structure is correct
      if (data[0].messages.length === 0) {
        return { messages: [], id: data[0].id };
      }
      
      // Parse the messages from JSONB[] format and ensure timestamp is a Date object
      const parsedMessages = data[0].messages.map((msgStr: any) => {
        try {
          // Handle both string and object formats for backward compatibility
          const msg = typeof msgStr === 'string' ? JSON.parse(msgStr) : msgStr;
          console.log('Processing message:', JSON.stringify(msg));
          
          // Validate required fields and set defaults if missing
          if (!msg.role || (msg.role !== 'user' && msg.role !== 'assistant')) {
            console.warn('Message with invalid role:', msg);
          }
          
          if (!msg.content) {
            console.warn('Message with missing content:', msg);
          }
          
          return {
            id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            role: (msg.role === 'user' || msg.role === 'assistant') ? msg.role : 'assistant',
            content: msg.content || '(Message content unavailable)',
            timestamp: msg.timestamp ? (msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)) : new Date()
          };
        } catch (error) {
          console.error('Error parsing message:', error, msgStr);
          // Return a default message as fallback
          return {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            role: 'assistant',
            content: 'Error loading message',
            timestamp: new Date()
          };
        }
      });
      
      // Verify we have both user and assistant messages
      const userMessages = parsedMessages.filter((m: Message) => m.role === 'user').length;
      const assistantMessages = parsedMessages.filter((m: Message) => m.role === 'assistant').length;
      
      console.log(`User messages: ${userMessages}, Assistant messages: ${assistantMessages}`);
      
      // Log each message for debugging
      console.log('Parsed messages:');
      parsedMessages.forEach((msg: Message, index: number) => {
        const contentPreview = msg.content 
          ? `"${msg.content.substring(0, 30)}${msg.content.length > 30 ? '...' : ''}"` 
          : "[no content]";
        console.log(`[${index}] ${msg.role || 'unknown'}: ${contentPreview} (${msg.timestamp})`);
      });
      
      // Ensure parsed messages are sorted by timestamp to maintain conversation flow
      const sortedMessages = [...parsedMessages].sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return timeA - timeB;
      });
      
      return { messages: sortedMessages, id: data[0].id };
    }
    
    console.log("No conversation found or empty conversation");
    return { messages: [], id: null };
  } catch (error) {
    console.error('Error in fetchConversation:', error);
    return { messages: [], id: null };
  }
};