/**
 * SafeSight AI – Authentication Context
 * Provides auth state (user, isAuthenticated, loading) and actions
 * (login, register, logout) to all child components via React Context.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // true while we validate the stored token

  // On mount: restore session from localStorage (validate token with /api/auth/me)
  useEffect(() => {
    async function restoreSession() {
      if (!authService.isAuthenticated()) {
        setLoading(false);
        return;
      }
      try {
        // Try to fetch current user — clears storage on 401
        const freshUser = await authService.fetchCurrentUser();
        setUser(freshUser);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (fullName, email, password, confirmPassword) => {
    const data = await authService.register(fullName, email, password, confirmPassword);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export default AuthContext;
