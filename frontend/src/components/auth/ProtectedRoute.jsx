/**
 * SafeSight AI – Protected Route
 * Wraps routes that require authentication.
 * Shows a loading screen while auth state is resolving.
 * Redirects to /login if the user is not authenticated.
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // While checking token validity, show a neutral full-screen loader
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0b1329',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <div className="auth-spinner" />
        <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Verifying session…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Preserve the intended destination so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
