// frontend/src/pages/FamiliesPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamily } from '../contexts/FamilyContext';
import { createFamily } from '../services/familyService';
import '../styles/FamiliesPage.css';

// Update the Family interface to include userRole
interface Family {
  id: string;
  name: string;
  userRole?: 'owner' | 'member';
}

const FamiliesPage: React.FC = () => {
  const navigate = useNavigate();
  const { families, loadingFamilies, refreshFamilies } = useFamily();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle creating a new family
  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newFamilyName.trim()) {
      setError('Please enter a family name');
      return;
    }
    
    setCreating(true);
    setError(null);
    
    try {
      const result = await createFamily(newFamilyName.trim());
      
      if (result.success && result.data) {
        await refreshFamilies();
        setShowCreateForm(false);
        setNewFamilyName('');
        
        // Navigate to the family members page for the new family
        navigate(`/families/${result.data.id}/members`);
      } else {
        setError(result.error || 'Failed to create family');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setCreating(false);
    }
  };

  // Navigate to family details
  const handleViewFamily = (familyId: string) => {
    navigate(`/families/${familyId}/members`);
  };

  return (
    <div className="families-page">
      <div className="page-header">
        <h1>My Families</h1>
        <button 
          className="create-button" 
          onClick={() => setShowCreateForm(true)}
        >
          + Create Family
        </button>
      </div>
      
      {loadingFamilies ? (
        <div className="loading-spinner"></div>
      ) : (
        <div className="families-container">
          {families.length === 0 ? (
            <div className="no-families">
              <p>You don't have any families yet.</p>
              <p>Create a family to share your calendar with others.</p>
            </div>
          ) : (
            <div className="families-list">
              {families.map((family: Family) => (
                <div 
                  key={family.id} 
                  className="family-card"
                  onClick={() => handleViewFamily(family.id)}
                >
                  <div className="family-icon">👨‍👩‍👧‍👦</div>
                  <div className="family-details">
                    <h3>{family.name} Family</h3>
                    <p className="family-role">
                      Your role: {family.userRole === 'owner' ? 'Owner' : 'Member'}
                    </p>
                  </div>
                  <div className="view-details">
                    <span className="arrow-icon">→</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Create Family Modal */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="create-family-form">
              <h2>Create a Family</h2>
              
              {error && <div className="error-message">{error}</div>}
              
              <form onSubmit={handleCreateFamily}>
                <div className="form-group">
                  <label htmlFor="familyName">Family Name</label>
                  <input
                    type="text"
                    id="familyName"
                    value={newFamilyName}
                    onChange={(e) => setNewFamilyName(e.target.value)}
                    placeholder="e.g. Smith"
                    required
                  />
                </div>
                
                <div className="form-actions">
                  <button 
                    type="button" 
                    className="cancel-button" 
                    onClick={() => setShowCreateForm(false)}
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="create-button"
                    disabled={creating}
                  >
                    {creating ? 'Creating...' : 'Create Family'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FamiliesPage;