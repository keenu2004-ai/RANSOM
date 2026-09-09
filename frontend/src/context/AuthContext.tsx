import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, ApiError } from '../services/api-client';

export interface User {
  userId: string;
  organizationId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'HR_MANAGER' | 'EMPLOYEE';
  employeeId: string | null;
  name?: string;
  displayName?: string;
  firstName?: string | null;
  lastName?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithMicrosoft: (msToken: string) => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      try {
        const res = await apiFetch<{ user: User }>('/auth/me');
        if (isMounted) {
          setUser(res.user);
        }
      } catch (err: any) {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    checkAuth();

    // Listen to custom logout events (e.g. from api-client on 401)
    const handleLogout = () => {
      setUser(null);
    };
    window.addEventListener('theiakshi:auth:logout', handleLogout);

    return () => {
      isMounted = false;
      window.removeEventListener('theiakshi:auth:logout', handleLogout);
    };
  }, []);

  const loginWithMicrosoft = async (msToken: string) => {
    setError(null);
    try {
      const res = await apiFetch<{ user: User }>('/auth/microsoft', {
        method: 'POST',
        body: JSON.stringify({ token: msToken })
      });
      setUser(res.user);
    } catch (err: any) {
      setError(err.message || 'Microsoft Authentication failed.');
      throw err;
    }
  };

  const login = async (email: string, pass: string) => {
    setError(null);
    try {
      const res = await apiFetch<{ user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass })
      });
      setUser(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      setUser(null);
      // Ensure redirect to login happens via ProtectedRoute
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithMicrosoft, login, logout, error, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
