// frontend/src/pages/ChatPage.tsx
import React from 'react';
import ChatInterface from '../components/ChatInterface';

const ChatPage: React.FC = () => {
  return (
    <div className="chat-page">
      <div className="chat-page-header">
        <h1>Chat</h1>
        <p className="chat-intro">
          Chat with your assistant to manage your calendar. You can create, update, or ask about events.
        </p>
      </div>
      
      <ChatInterface />
    </div>
  );
};

export default ChatPage;