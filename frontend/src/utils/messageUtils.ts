// frontend/src/utils/messageUtils.ts

// Message type definition
export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date | string;
  }
  
  // Conversation type definition
  export interface Conversation {
    id?: string;
    user_id: string;
    messages: Message[];
    created_at?: string;
    updated_at?: string;
  }
  
  /**
   * Create a new message object
   */
  export const createMessage = (
    role: 'user' | 'assistant',
    content: string
  ): Message => {
    return {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date()
    };
  };
  
  /**
   * Format timestamp for display
   */
  export const formatMessageTime = (timestamp: Date | string): string => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  /**
   * Process message timestamps to ensure they are in a consistent format
   * Used when saving messages to the database
   */
  export const processMessageTimestamps = (messages: Message[]): Message[] => {
    return messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp instanceof Date 
        ? msg.timestamp.toISOString() 
        : msg.timestamp
    }));
  };
  
  /**
   * Create a system response message for errors or notifications
   */
  export const createSystemMessage = (content: string): Message => {
    return createMessage('assistant', content);
  };
  
  /**
   * Create an error message
   */
  export const createErrorMessage = (error: string | Error): Message => {
    const errorContent = error instanceof Error ? error.message : error;
    return createSystemMessage(`Sorry, I encountered an error: ${errorContent}`);
  };
  
  /**
   * Create a confirmation message for event actions
   */
  export const createEventConfirmationMessage = (
    title: string,
    action: 'created' | 'updated' | 'deleted'
  ): Message => {
    let content = '';
    
    switch (action) {
      case 'created':
        content = `Event "${title}" has been added to your calendar.`;
        break;
      case 'updated':
        content = `Event "${title}" has been updated in your calendar.`;
        break;
      case 'deleted':
        content = `Event "${title}" has been deleted from your calendar.`;
        break;
    }
    
    return createSystemMessage(content);
  };