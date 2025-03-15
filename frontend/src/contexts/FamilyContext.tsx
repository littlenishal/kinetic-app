// frontend/src/contexts/FamilyContext.tsx
import React, { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../services/supabaseClient';
import { getUserFamilies, Family } from '../services/familyService';

interface FamilyContextType {
  currentFamilyId: string | null;
  setCurrentFamilyId: (id: string | null) => void;
  families: Family[];
  loadingFamilies: boolean;
  refreshFamilies: () => Promise<void>;
}

// Create context with a default undefined value
const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

// Provider component
export const FamilyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentFamilyId, setCurrentFamilyId] = useState<string | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(true);
  
  // Load last selected family from localStorage
  useEffect(() => {
    const savedFamilyId = localStorage.getItem('currentFamilyId');
    if (savedFamilyId) {
      setCurrentFamilyId(savedFamilyId);
    }
  }, []);
  
  // Load families when authenticated
  useEffect(() => {
    const loadFamilies = async () => {
      try {
        // Check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoadingFamilies(false);
          return;
        }
        
        setLoadingFamilies(true);
        const result = await getUserFamilies();
        
        if (result.success && result.data) {
          setFamilies(result.data);
        } else {
          console.error('Error loading families:', result.error);
        }
      } catch (error) {
        console.error('Error in loadFamilies:', error);
      } finally {
        setLoadingFamilies(false);
      }
    };
    
    loadFamilies();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        loadFamilies();
      } else if (event === 'SIGNED_OUT') {
        setFamilies([]);
        setCurrentFamilyId(null);
        localStorage.removeItem('currentFamilyId');
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // Save selected family to localStorage
  const handleSetFamily = (id: string | null) => {
    setCurrentFamilyId(id);
    if (id) {
      localStorage.setItem('currentFamilyId', id);
    } else {
      localStorage.removeItem('currentFamilyId');
    }
  };
  
  // Function to refresh families list
  const refreshFamilies = async () => {
    try {
      setLoadingFamilies(true);
      const result = await getUserFamilies();
      
      if (result.success && result.data) {
        setFamilies(result.data);
      } else {
        console.error('Error refreshing families:', result.error);
      }
    } catch (error) {
      console.error('Error in refreshFamilies:', error);
    } finally {
      setLoadingFamilies(false);
    }
  };
  
  return (
    <FamilyContext.Provider 
      value={{ 
        currentFamilyId, 
        setCurrentFamilyId: handleSetFamily,
        families,
        loadingFamilies,
        refreshFamilies
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
};

// Custom hook to use the family context
export const useFamily = () => {
  const context = useContext(FamilyContext);
  if (context === undefined) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
};