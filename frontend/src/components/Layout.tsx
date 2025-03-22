// frontend/src/components/Layout.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import AppHeader from './AppHeader';
import Navigation from './Navigation';
import FamilySelector from './FamilySelector';
import { useFamily } from '../contexts/FamilyContext';
import '../App.css';

interface LayoutProps {
  children: React.ReactNode;
  currentView?: 'chat' | 'calendar';
  onViewChange?: (view: 'chat' | 'calendar') => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentView: externalView, 
  onViewChange: externalViewChange 
}) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{id: string; email?: string} | null>(null);
  const [internalCurrentView, setInternalCurrentView] = useState<'chat' | 'calendar'>('chat');
  
  // Use external view state if provided, otherwise use internal state
  const currentView = externalView || internalCurrentView;
  
  // Access the family context
  const { currentFamilyId, setCurrentFamilyId } = useFamily();

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

  // Change between chat and calendar views
  const handleViewChange = (view: 'chat' | 'calendar') => {
    // If external handler is provided, use it
    if (externalViewChange) {
      externalViewChange(view);
    } else {
      // Otherwise use internal state
      setInternalCurrentView(view);
    }
    
    // Navigate based on the view
    if (view === 'chat') {
      window.location.href = '/';
    } else if (view === 'calendar') {
      window.location.href = '/#calendar';
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
      >
        {user && (
          <FamilySelector 
            currentFamilyId={currentFamilyId}
            onFamilyChange={setCurrentFamilyId}
          />
        )}
      </AppHeader>
      
      {user && (
        <Navigation 
          currentView={currentView}
          onViewChange={handleViewChange}
        />
      )}
      
      <main className={`App-main ${!user ? 'welcome-view' : ''}`}>
        {children}
      </main>
    </div>
  );
};

export default Layout;