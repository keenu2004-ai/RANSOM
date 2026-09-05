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
    try {
      const saved = localStorage.getItem('theiakshi_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('theiakshi_auth_token');
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const savedToken = localStorage.getItem('theiakshi_auth_token');
    const savedUser = localStorage.getItem('theiakshi_auth_user');
    // If we have both token and saved user, we can immediately bootstrap session without blocking loading screen
    return Boolean(savedToken && !savedUser);
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('theiakshi_auth_token');
      if (savedToken) {
        try {
          const res = await apiFetch<{ user: User }>('/auth/me');
          if (isMounted) {
            setUser(res.user);
            localStorage.setItem('theiakshi_auth_user', JSON.stringify(res.user));
          }
        } catch (err: any) {
          if (isMounted) {
            localStorage.removeItem('theiakshi_auth_token');
            localStorage.removeItem('theiakshi_auth_user');
            setUser(null);
            setToken(null);
          }
        }
      }
      if (isMounted) {
        setLoading(false);
      }
    };
    checkAuth();

    return () => {
      isMounted = false;
    };
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
