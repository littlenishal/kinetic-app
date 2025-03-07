// frontend/src/App.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import { initializeOneSignal, setupOneSignalUser, removeOneSignalUser } from './services/oneSignalClient';
import ChatInterface from './components/ChatInterface';
import AppHeader from './components/AppHeader';
import './App.css';
import './styles/AppHeader.css';
import './styles/EmailForwardingSetup.css';

// Define user type
interface User {
  id: string;
  email?: string;
}

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Initialize OneSignal
    const oneSignalAppId = process.env.REACT_APP_ONESIGNAL_APP_ID;
    if (oneSignalAppId) {
      initializeOneSignal({ appId: oneSignalAppId });
    } else {
      console.error('OneSignal App ID not found in environment variables');
    }

    // Get current session and set up listener for auth changes
    const getCurrentSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email
        });
        
        // Set up OneSignal if user is logged in
        if (session.user.id && session.user.email) {
          setupOneSignalUser(session.user.id, session.user.email);
        }
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
          
          // Update OneSignal when user logs in
          if (event === 'SIGNED_IN' && session.user.id && session.user.email) {
            await setupOneSignalUser(session.user.id, session.user.email);
          }
        } else {
          setUser(null);
          
          // If user signed out, remove them from OneSignal
          if (event === 'SIGNED_OUT') {
            await removeOneSignalUser();
          }
        }
      }
    );
    
    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    
    if (error) {
      console.error('Error signing in:', error.message);
      alert('Error signing in. Please try again.');
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error signing out:', error.message);
      alert('Error signing out. Please try again.');
    }
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

  return (
    <div className="App">
      <AppHeader 
        userEmail={user?.email}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
      
      <main className="App-main">
        {user ? (
          <ChatInterface />
        ) : (
          <div className="welcome-container">
            <h2>Welcome to Family Assistant</h2>
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
                <div className="feature-icon">📧</div>
                <div className="feature-text">
                  <h3>Email Forwarding</h3>
                  <p>Forward emails with event details to automatically add them to your calendar</p>
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
            <button className="sign-in-button large" onClick={handleSignIn}>
              Sign In to Get Started
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;