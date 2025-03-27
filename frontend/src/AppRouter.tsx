// frontend/src/AppRouter.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import AuthGuard from './components/AuthGuard';
import FamiliesPage from './pages/FamiliesPage';
import FamilyMembersPage from './pages/FamilyMembersPage';
import CalendarPage from './pages/CalendarPage';
import ChatPage from './pages/ChatPage';
import { AuthProvider } from './contexts/AuthContext';
import { FamilyProvider } from './contexts/FamilyContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';

// Error fallback UI
const GlobalErrorFallback = () => (
  <div className="error-container">
    <h2>Oops! Something went wrong</h2>
    <p>We're sorry for the inconvenience. Please try refreshing the page or contact support if the problem persists.</p>
    <button 
      onClick={() => window.location.href = '/'} 
      className="primary-button"
    >
      Go to Home
    </button>
  </div>
);

const AppRouter: React.FC = () => {
  return (
    <ErrorBoundary fallback={<GlobalErrorFallback />}>
      <Router>
        <AuthProvider>
          <FamilyProvider>
            <React.Suspense fallback={<LoadingSpinner fullScreen message="Loading application..." />}>
              <Routes>
                {/* Welcome/Home page with auth handling */}
                <Route path="/" element={<App />} />
                
                {/* Main app routes (protected) */}
                <Route 
                  path="/chat" 
                  element={
                    <AuthGuard>
                      <ErrorBoundary>
                        <Layout>
                          <ChatPage />
                        </Layout>
                      </ErrorBoundary>
                    </AuthGuard>
                  } 
                />
                
                <Route 
                  path="/calendar" 
                  element={
                    <AuthGuard>
                      <ErrorBoundary>
                        <Layout>
                          <CalendarPage />
                        </Layout>
                      </ErrorBoundary>
                    </AuthGuard>
                  } 
                />
                
                {/* Family management routes (protected) */}
                <Route 
                  path="/families" 
                  element={
                    <AuthGuard>
                      <ErrorBoundary>
                        <Layout>
                          <FamiliesPage />
                        </Layout>
                      </ErrorBoundary>
                    </AuthGuard>
                  } 
                />
                
                <Route 
                  path="/families/:familyId/members" 
                  element={
                    <AuthGuard>
                      <ErrorBoundary>
                        <Layout>
                          <FamilyMembersPage />
                        </Layout>
                      </ErrorBoundary>
                    </AuthGuard>
                  } 
                />
                
                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </React.Suspense>
          </FamilyProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
};

export default AppRouter;