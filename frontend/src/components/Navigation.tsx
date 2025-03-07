// frontend/src/components/Navigation.tsx
import React from 'react';
import '../styles/Navigation.css';

interface NavigationProps {
  currentView: 'chat' | 'calendar';
  onViewChange: (view: 'chat' | 'calendar') => void;
}

const Navigation: React.FC<NavigationProps> = ({ 
  currentView, 
  onViewChange 
}) => {
  return (
    <div className="app-navigation">
      <button 
        className={`nav-item ${currentView === 'chat' ? 'active' : ''}`}
        onClick={() => onViewChange('chat')}
      >
        <div className="nav-icon">💬</div>
        <span className="nav-label">Chat</span>
      </button>
      
      <button 
        className={`nav-item ${currentView === 'calendar' ? 'active' : ''}`}
        onClick={() => onViewChange('calendar')}
      >
        <div className="nav-icon">📅</div>
        <span className="nav-label">Calendar</span>
      </button>
    </div>
  );
};

export default Navigation;