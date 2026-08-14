import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, ApiError } from '../services/api-client';

export interface User {
  userId: string;
  organizationId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'HR_MANAGER' | 'MANAGER' | 'EMPLOYEE';
  employeeId: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
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

  const login = async (email: string, pass: string) => {
    setError(null);
    try {
      const res = await apiFetch<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass })
      });
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
      localStorage.removeItem('theiakshi_auth_token');
      localStorage.removeItem('theiakshi_auth_user');
      setUser(null);
      setToken(null);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, error, clearError }}>
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
