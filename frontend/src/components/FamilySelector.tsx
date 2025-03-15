// frontend/src/components/FamilySelector.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import '../styles/FamilySelector.css';

interface Family {
  id: string;
  name: string;
}

interface FamilySelectorProps {
  currentFamilyId: string | null;
  onFamilyChange: (familyId: string | null) => void;
}

const FamilySelector: React.FC<FamilySelectorProps> = ({
  currentFamilyId,
  onFamilyChange
}) => {
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch user's families
  useEffect(() => {
    const fetchFamilies = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setLoading(false);
          return;
        }
        
        // Get families where user is a member
        const { data, error } = await supabase
          .from('family_members')
          .select(`
            family_id,
            families:family_id (
              id,
              name
            )
          `)
          .eq('user_id', user.id)
          .eq('invitation_accepted', true);
          
        if (error) throw error;
        
        // Transform the result to get a clean families array
        const userFamilies = data
          .filter(item => item.families)
          .map(item => ({
            id: item.families.id,
            name: item.families.name
          }));
        
        setFamilies(userFamilies);
      } catch (error) {
        console.error('Error fetching families:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFamilies();
  }, []);

  // Toggle dropdown visibility
  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  // Handle selecting a family
  const handleSelectFamily = (familyId: string | null) => {
    onFamilyChange(familyId);
    setShowDropdown(false);
  };

  // Current display name for selector
  const getCurrentDisplayName = () => {
    if (currentFamilyId === null) {
      return 'Personal Calendar';
    }
    
    const selectedFamily = families.find(f => f.id === currentFamilyId);
    return selectedFamily ? `${selectedFamily.name} Family` : 'Loading...';
  };

  return (
    <div className="family-selector">
      <div className="selector-button" onClick={toggleDropdown}>
        <span className="selector-icon">
          {currentFamilyId === null ? '👤' : '👨‍👩‍👧‍👦'}
        </span>
        <span className="current-selection">
          {loading ? 'Loading...' : getCurrentDisplayName()}
        </span>
        <span className="dropdown-arrow">▼</span>
      </div>
      
      {showDropdown && (
        <div className="family-dropdown">
          <div 
            className={`family-option ${currentFamilyId === null ? 'active' : ''}`}
            onClick={() => handleSelectFamily(null)}
          >
            <span className="option-icon">👤</span>
            <span className="option-name">Personal Calendar</span>
          </div>
          
          {families.length > 0 && (
            <>
              <div className="dropdown-divider"></div>
              {families.map(family => (
                <div 
                  key={family.id}
                  className={`family-option ${currentFamilyId === family.id ? 'active' : ''}`}
                  onClick={() => handleSelectFamily(family.id)}
                >
                  <span className="option-icon">👨‍👩‍👧‍👦</span>
                  <span className="option-name">{family.name} Family</span>
                </div>
              ))}
            </>
          )}
          
          <div className="dropdown-divider"></div>
          <div className="family-option create" onClick={() => window.location.href = '/families/create'}>
            <span className="option-icon">➕</span>
            <span className="option-name">Create or Join Family</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FamilySelector;