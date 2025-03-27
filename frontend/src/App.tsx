// frontend/src/App.tsx
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuth } from './contexts/AuthContext';
import './App.css';

function App() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Handle redirection after login
  useEffect(() => {
    if (user && !loading) {
      // Check if there was a previous location the user was trying to access
      const { state } = location as { state: { from?: { pathname: string } } | null };
      
      if (state?.from) {
        // Navigate to the previously attempted page
        navigate(state.from.pathname);
      } else {
        // Default navigation to chat
        navigate('/chat');
      }
    }
  }, [user, loading, navigate, location]);

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

export default App;