// frontend/src/components/Layout.tsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppHeader from './AppHeader';
import Navigation from './Navigation';
import FamilySelector from './FamilySelector';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../contexts/FamilyContext';
import '../App.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, loading, signIn, signOut } = useAuth();
  const { currentFamilyId, setCurrentFamilyId } = useFamily();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine current view based on location
  const getCurrentView = (): 'chat' | 'calendar' => {
    if (location.pathname.includes('calendar')) {
      return 'calendar';
    }
    return 'chat';  // Default to chat
  };
  
  const currentView = getCurrentView();

  // Handle view changes with proper routing
  const handleViewChange = (view: 'chat' | 'calendar') => {
    if (view === 'chat') {
      navigate('/chat');
    } else if (view === 'calendar') {
      navigate('/calendar');
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
        onSignIn={signIn}
        onSignOut={signOut}
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