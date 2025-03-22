// frontend/src/AppRouter.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import AuthGuard from './components/AuthGuard';
import FamiliesPage from './pages/FamiliesPage';
import FamilyMembersPage from './pages/FamilyMembersPage';
import { FamilyProvider } from './contexts/FamilyContext';
import Layout from './components/Layout';

const AppRouter: React.FC = () => {
  return (
    <Router>
      <FamilyProvider>
        <Routes>
          {/* Main app route */}
          <Route path="/" element={<App />} />
          
          {/* Family management routes (protected) */}
          <Route 
            path="/families" 
            element={
              <AuthGuard>
                <Layout>
                  <FamiliesPage />
                </Layout>
              </AuthGuard>
            } 
          />
          
          <Route 
            path="/families/:familyId/members" 
            element={
              <AuthGuard>
                <Layout>
                  <FamilyMembersPage />
                </Layout>
              </AuthGuard>
            } 
          />
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </FamilyProvider>
    </Router>
  );
};

export default AppRouter;