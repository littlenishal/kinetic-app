// frontend/src/pages/FamilyMembersPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFamilyMembers, leaveFamily, deleteFamily, FamilyMember } from '../services/familyService';
import { Family } from '../contexts/FamilyContext'; // Import Family from context instead
import FamilyInviteForm from '../components/FamilyInviteForm';
import { supabase } from '../services/supabaseClient';
import '../styles/FamilyMembersPage.css';

const FamilyMembersPage: React.FC = () => {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();
  
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [userRole, setUserRole] = useState<'owner' | 'member' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Load family and members data
  useEffect(() => {
    const loadData = async () => {
      if (!familyId) {
        navigate('/families');
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        // First get the family details
        const { data: familiesData, error: familiesError } = await supabase
          .from('families')
          .select('*')
          .eq('id', familyId)
          .single();
        
        if (familiesError) throw familiesError;
        setFamily(familiesData);
        
        // Then get member details
        const result = await getFamilyMembers(familyId);
        
        if (!result.success) {
          throw new Error(result.error);
        }
        
        setMembers(result.data || []);
        
        // Get current user info
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const currentMember = result.data?.find(m => m.user_id === user.id);
          if (currentMember) {
            setUserRole(currentMember.role);
          }
        }
      } catch (error) {
        console.error('Error loading family data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load family data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [familyId, navigate]);

  // Handle leaving family
  const handleLeaveFamily = async () => {
    if (!familyId) return;
    
    try {
      const result = await leaveFamily(familyId);
      
      if (result.success) {
        navigate('/families');
      } else {
        setError(result.error || 'Failed to leave family');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  };

  // Handle deleting family
  const handleDeleteFamily = async () => {
    if (!familyId) return;
    
    try {
      const result = await deleteFamily(familyId);
      
      if (result.success) {
        navigate('/families');
      } else {
        setError(result.error || 'Failed to delete family');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  };

  // Handle invite success
  const handleInviteSuccess = () => {
    // Could refresh the invitations list here if we were showing them
  };

  if (loading) {
    return <div className="loading-spinner"></div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={() => navigate('/families')}>
          Back to Families
        </button>
      </div>
    );
  }

  return (
    <div className="family-members-page">
      <div className="page-header">
        <h1>{family?.name} Family</h1>
        <div className="header-actions">
          {userRole === 'owner' && (
            <button 
              className="invite-button" 
              onClick={() => setShowInviteForm(true)}
            >
              + Invite Member
            </button>
          )}
        </div>
      </div>
      
      <div className="members-container">
        <h2>Members</h2>
        {members.length === 0 ? (
          <p className="no-members">No members found</p>
        ) : (
          <ul className="members-list">
            {members.map(member => (
              <li key={member.id} className="member-item">
                <div className="member-avatar">
                  {member.profile?.display_name?.charAt(0) || '?'}
                </div>
                <div className="member-info">
                  <div className="member-name">
                    {member.profile?.display_name || 'Unknown User'}
                    {member.role === 'owner' && (
                      <span className="role-badge">Owner</span>
                    )}
                  </div>
                  <div className="member-since">
                    Member since {new Date(member.joined_at).toLocaleDateString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div className="family-actions">
        {userRole === 'owner' ? (
          <button 
            className="delete-button" 
            onClick={() => setShowConfirmDelete(true)}
          >
            Delete Family
          </button>
        ) : (
          <button 
            className="leave-button" 
            onClick={() => setShowConfirmLeave(true)}
          >
            Leave Family
          </button>
        )}
      </div>
      
      {/* Invite Form Modal */}
      {showInviteForm && family && (
        <div className="modal-overlay">
          <div className="modal-content">
            <FamilyInviteForm
              familyId={familyId || ''}
              familyName={family.name}
              onInviteSuccess={handleInviteSuccess}
              onClose={() => setShowInviteForm(false)}
            />
          </div>
        </div>
      )}
      
      {/* Confirm Leave Modal */}
      {showConfirmLeave && (
        <div className="modal-overlay">
          <div className="confirm-modal">
            <h2>Leave Family?</h2>
            <p>
              Are you sure you want to leave this family? You will no longer have access to shared events.
            </p>
            <div className="confirm-actions">
              <button 
                className="cancel-button" 
                onClick={() => setShowConfirmLeave(false)}
              >
                Cancel
              </button>
              <button 
                className="confirm-button leave" 
                onClick={handleLeaveFamily}
              >
                Leave Family
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirm Delete Modal */}
      {showConfirmDelete && (
        <div className="modal-overlay">
          <div className="confirm-modal">
            <h2>Delete Family?</h2>
            <p>
              Are you sure you want to delete this family? This action cannot be undone and all shared events will be lost.
            </p>
            <div className="confirm-actions">
              <button 
                className="cancel-button" 
                onClick={() => setShowConfirmDelete(false)}
              >
                Cancel
              </button>
              <button 
                className="confirm-button delete" 
                onClick={handleDeleteFamily}
              >
                Delete Family
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FamilyMembersPage;