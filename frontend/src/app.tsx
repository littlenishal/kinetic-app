import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import ChatInterface from './components/ChatInterface';
import './App.css';

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
    // Get current session and set up listener for auth changes
    const getCurrentSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
      
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email
        });
      }
    };
    
    getCurrentSession();
    
    // Set up listener for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
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

  const handleSignIn = async () => {
    // For simplicity, using a modal sign-in approach
    // In a real app, you might want to use a dedicated sign-in page
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
      <header className="App-header">
        <h1>Family Assistant</h1>
        {user ? (
          <div className="user-info">
            <span>{user.email}</span>
            <button className="sign-out-button" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        ) : (
          <button className="sign-in-button" onClick={handleSignIn}>
            Sign In with Google
          </button>
        )}
      </header>
      
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