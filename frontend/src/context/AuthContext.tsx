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
  token: string | null;
  loading: boolean;
  loginWithMicrosoft: (msToken: string) => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('theiakshi_auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('theiakshi_auth_token');
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('theiakshi_auth_token');
      if (savedToken) {
        try {
          const res = await apiFetch<{ user: User }>('/auth/me');
          setUser(res.user);
          localStorage.setItem('theiakshi_auth_user', JSON.stringify(res.user));
        } catch (err: any) {
          localStorage.removeItem('theiakshi_auth_token');
          localStorage.removeItem('theiakshi_auth_user');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const loginWithMicrosoft = async (msToken: string) => {
    setError(null);
    try {
      const res = await apiFetch<{ token: string; user: User }>('/auth/microsoft', {
        method: 'POST',
        body: JSON.stringify({ token: msToken })
      });
      localStorage.removeItem('theiakshi_explicit_logout');
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('theiakshi_auth_token', res.token);
      localStorage.setItem('theiakshi_auth_user', JSON.stringify(res.user));
    } catch (err: any) {
      setError(err.message || 'Microsoft Authentication failed.');
      throw err;
    }
  };

  const login = async (email: string, pass: string) => {
    setError(null);
    try {
      const res = await apiFetch<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass })
      });
      localStorage.removeItem('theiakshi_explicit_logout');
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('theiakshi_auth_token', res.token);
      localStorage.setItem('theiakshi_auth_user', JSON.stringify(res.user));
    } catch (err: any) {
      setError(err.message || 'Login failed.');
      throw err;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
      }
    } finally {
      localStorage.setItem('theiakshi_explicit_logout', 'true');
      localStorage.removeItem('theiakshi_auth_token');
      localStorage.removeItem('theiakshi_auth_user');
      setUser(null);
      setToken(null);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, token, loading, loginWithMicrosoft, login, logout, error, clearError }}>
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
