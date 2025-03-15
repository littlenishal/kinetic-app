// frontend/src/components/FamilyInviteForm.tsx
import React, { useState } from 'react';
import { inviteFamilyMember } from '../services/familyService';
import '../styles/FamilyInviteForm.css';

interface FamilyInviteFormProps {
  familyId: string;
  familyName: string;
  onInviteSuccess: () => void;
  onClose: () => void;
}

const FamilyInviteForm: React.FC<FamilyInviteFormProps> = ({
  familyId,
  familyName,
  onInviteSuccess,
  onClose
}) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(`I'd like to invite you to join my family calendar in KINETIC.`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await inviteFamilyMember(familyId, email);
      
      if (result.success) {
        setSuccess(true);
        onInviteSuccess();
      } else {
        setError(result.error || 'Failed to send invitation');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="family-invite-form">
      <h2>Invite to {familyName} Family</h2>
      
      {success ? (
        <div className="invite-success">
          <div className="success-icon">✓</div>
          <p>Invitation sent to {email}</p>
          <p className="success-note">
            They'll receive an email with instructions to join your family calendar.
          </p>
          <button className="close-button" onClick={onClose}>
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="family.member@example.com"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="message">Personal Message (optional)</label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-button" 
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="send-button"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default FamilyInviteForm;