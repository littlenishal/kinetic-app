// frontend/src/components/AppHeader.tsx

import React, { useState } from 'react';
import '../styles/AppHeader.css';

interface AppHeaderProps {
  userEmail?: string;
  onSignIn: () => void;
  onSignOut: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ userEmail, onSignIn, onSignOut }) => {
  const [showMenu, setShowMenu] = useState(false);
  
  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };
  
  return (
    <header className="app-header">
      <h1>KINETIC</h1>
      
      {userEmail ? (
        <div className="user-menu">
          <div className="user-info" onClick={toggleMenu}>
            <span>{userEmail}</span>
            <button className="menu-button">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          
          {showMenu && (
            <div className="dropdown-menu">
              <button className="menu-item" onClick={onSignOut}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V3.33333C2 2.97971 2.14048 2.64057 2.39052 2.39052C2.64057 2.14048 2.97971 2 3.33333 2H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 12L14 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      ) : (
        <button className="sign-in-button" onClick={onSignIn}>
          Sign In with Google
        </button>
      )}
    </header>
  );
};

export default AppHeader;