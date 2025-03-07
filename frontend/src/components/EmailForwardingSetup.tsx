// frontend/src/components/EmailForwardingSetup.tsx

import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface EmailForwardingSetupProps {
  onClose: () => void;
}

const EmailForwardingSetup: React.FC<EmailForwardingSetupProps> = ({ onClose }) => {
  const [userEmail, setUserEmail] = useState<string>('');
  const [domainName, setDomainName] = useState<string>('yourdomain.com');
  const [copied, setCopied] = useState<boolean>(false);
  
  // Fetch user email on component mount
  React.useEffect(() => {
    const getUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        
        // Extract domain from user email if possible
        const emailParts = user.email.split('@');
        if (emailParts.length === 2) {
          setDomainName(emailParts[1]);
        }
      }
    };
    
    getUserEmail();
  }, []);
  
  // Generate forwarding email address
  const getForwardingEmail = (): string => {
    if (!userEmail) return '';
    
    const emailParts = userEmail.split('@');
    if (emailParts.length !== 2) return '';
    
    return `${emailParts[0]}+calendar@${domainName}`;
  };
  
  // Copy email to clipboard
  const copyToClipboard = () => {
    const email = getForwardingEmail();
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  return (
    <div className="email-forwarding-setup">
      <div className="setup-header">
        <h2>Email Forwarding Setup</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="setup-content">
        <p>Forward emails containing event information to automatically add them to your calendar.</p>
        
        <div className="email-address-box">
          <p className="label">Your email forwarding address:</p>
          <div className="email-display">
            <code>{getForwardingEmail()}</code>
            <button 
              className="copy-button" 
              onClick={copyToClipboard}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        
        <div className="instructions">
          <h3>How to use:</h3>
          <ol>
            <li>Forward emails containing event details to the address above</li>
            <li>Our system will automatically extract dates, times, and event information</li>
            <li>Events will appear in your calendar within a few minutes</li>
          </ol>
          
          <h3>Works with:</h3>
          <ul>
            <li>Meeting invitations</li>
            <li>Appointment confirmations</li>
            <li>Sports schedules</li>
            <li>School event notifications</li>
            <li>And more!</li>
          </ul>
          
          <div className="tip-box">
            <h4>Pro Tip</h4>
            <p>Set up automatic forwarding rules in your email client to send all relevant emails to your calendar.</p>
          </div>
        </div>
      </div>
      
      <div className="setup-footer">
        <button className="primary-button" onClick={onClose}>
          Got it!
        </button>
        <a 
          href="/email-guide" 
          target="_blank" 
          rel="noopener noreferrer"
          className="secondary-button"
        >
          View detailed guide
        </a>
      </div>
    </div>
  );
};

export default EmailForwardingSetup;