// frontend/src/App.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import ChatInterface from './components/ChatInterface';
import CalendarPage from './pages/CalendarPage';
import Layout from './components/Layout';
import './App.css';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{id: string; email?: string} | null>(null);
  const [currentView, setCurrentView] = useState<'chat' | 'calendar'>('chat');

  useEffect(() => {
    // Get current session and set up listener for auth changes
    const getCurrentSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email
        });
      }
      
      setLoading(false);
    };
    
    getCurrentSession();
    
    // Set up listener for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email
          });
        } else {
          setUser(null);
        }
      }
    );
    
    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle view changes
  const handleViewChange = (view: 'chat' | 'calendar') => {
    setCurrentView(view);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="App loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // For non-authenticated users, show the welcome page
  if (!user) {
    return (
      <Layout>
        <div className="welcome-container">
          <h2>Welcome to KINETIC</h2>
          <p>
            A chat-based family management app that helps busy families organize 
            their lives through natural language interactions.
          </p>
          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-icon">💬</div>
              <div className="feature-text">
                <h3>Chat-Based Calendar</h3>
                <p>Create events by simply typing things like "Schedule soccer practice on Tuesday at 4pm"</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">👨‍👩‍👧‍👦</div>
              <div className="feature-text">
                <h3>Family Sharing</h3>
                <p>Share your calendar with family members so everyone stays in sync</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📅</div>
              <div className="feature-text">
                <h3>Smart Calendar</h3>
                <p>Easily view, edit and manage all your family events in one place</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔔</div>
              <div className="feature-text">
                <h3>Smart Notifications</h3>
                <p>Get daily and weekly schedule updates to stay on top of your family's activities</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // For authenticated users, show the app with Layout
  return (
    <Layout currentView={currentView} onViewChange={handleViewChange}>
      {currentView === 'chat' && <ChatInterface />}
      {currentView === 'calendar' && <CalendarPage />}
    </Layout>
  );
}

export default App;