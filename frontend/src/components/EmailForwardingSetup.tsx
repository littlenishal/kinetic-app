// frontend/src/components/EmailForwardingSetup.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { setupOneSignalUser, getOneSignalEmailInbox } from '../services/oneSignalClient';
import '../styles/EmailForwardingSetup.css';

interface EmailForwardingSetupProps {
  onClose: () => void;
}

const EmailForwardingSetup: React.FC<EmailForwardingSetupProps> = ({ onClose }) => {
  const [userEmail, setUserEmail] = useState<string>('');
  const [forwardingEmail, setForwardingEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  
  // Fetch user email and set up OneSignal on component mount
  useEffect(() => {
    const setup = async () => {
      setLoading(true);
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email || !user?.id) {
          throw new Error('User information not available');
        }
        
        setUserEmail(user.email);
        
        // Set up user's ID and email in OneSignal
        await setupOneSignalUser(user.id, user.email);
        
        // Get the OneSignal email inbox address
        const inboxAddress = await getOneSignalEmailInbox();
        if (!inboxAddress) {
          throw new Error('Failed to get OneSignal email inbox address');
        }
        
        setForwardingEmail(inboxAddress);
        
        // Store the forwarding address and OneSignal IDs in Supabase for this user
        await supabase
          .from('profiles')
          .update({
            email_forwarding_address: inboxAddress,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
      } catch (err) {
        console.error('Error setting up email forwarding:', err);
        setError('Failed to set up email forwarding. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    setup();
  }, []);
  
  // Copy email to clipboard
  const copyToClipboard = () => {
    if (!forwardingEmail) return;
    
    navigator.clipboard.writeText(forwardingEmail).then(() => {
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
          
          {loading ? (
            <div className="loading-indicator">Setting up your forwarding address...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : (
            <div className="email-display">
              <code>{forwardingEmail}</code>
              <button 
                className="copy-button" 
                onClick={copyToClipboard}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
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