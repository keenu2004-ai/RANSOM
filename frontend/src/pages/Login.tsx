import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ShieldCheck, Loader2, KeyRound, ArrowRight, UserX, RefreshCw } from 'lucide-react';
import {
  initializeMsal,
  executeMicrosoftRedirectLogin,
  executeMicrosoftPopupLogin,
  executeMicrosoftSelectAccountLogin,
  getSilentIdToken
} from '../config/msalConfig';
import { TheiakshiLogo } from '../components/TheiakshiLogo';

export const Login: React.FC = () => {
  const { user, loginWithMicrosoft, login, error, clearError } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'microsoft' | 'password'>('microsoft');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Password form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Guard against concurrent clicks or rapid re-renders
  const isExecutingRef = useRef(false);

  // Process MSAL redirect result or silent token on initial page load
  useEffect(() => {
    let isMounted = true;

    const processAuthOnLoad = async () => {
      if (user) return;

      try {
        const redirectResult = await initializeMsal();
        if (redirectResult?.idToken) {
          if (!isMounted) return;
          setLoading(true);
          setLocalError(null);
          clearError();
          await loginWithMicrosoft(redirectResult.idToken);
          navigate('/dashboard', { replace: true });
          return;
        }

        const isExplicitLogout = localStorage.getItem('theiakshi_explicit_logout') === 'true';
        if (!isExplicitLogout) {
          const silentIdToken = await getSilentIdToken();
          if (silentIdToken) {
            if (!isMounted) return;
            setLoading(true);
            await loginWithMicrosoft(silentIdToken);
            navigate('/dashboard', { replace: true });
            return;
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('MSAL initial auth check:', err);
        if (err.errorCode === 'block_nested_popups' || err.message?.includes('block_nested_popups')) {
          setLocalError('Microsoft sign-in window could not complete because another window is active. Please close any open window and click Sign in again.');
        } else if (err.errorCode === 'interaction_in_progress' || err.message?.includes('interaction_in_progress')) {
          setLocalError('Microsoft sign-in is already in progress. Please wait and try again.');
        } else {
          setLocalError(err.message || 'Microsoft authentication failed.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    processAuthOnLoad();

    return () => {
      isMounted = false;
    };
  }, []);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleMicrosoftSignIn = async () => {
    if (loading || isExecutingRef.current) {
      return;
    }

    localStorage.removeItem('theiakshi_explicit_logout');

    isExecutingRef.current = true;
    setLoading(true);
    setLocalError(null);
    clearError();

    try {
      await executeMicrosoftRedirectLogin();
    } catch (err: any) {
      console.error('Microsoft sign-in error:', err);

      if (err.errorCode === 'redirect_error' || err.message?.includes('redirect')) {
        try {
          const popupRes = await executeMicrosoftPopupLogin();
          if (popupRes?.idToken) {
            await loginWithMicrosoft(popupRes.idToken);
            navigate('/dashboard', { replace: true });
            return;
          }
        } catch (popupErr: any) {
          err = popupErr;
        }
      }

      if (err.errorCode === 'user_cancelled' || err.message?.includes('user_cancelled')) {
        setLocalError('Microsoft sign in was cancelled. Please try again.');
      } else if (err.errorCode === 'interaction_in_progress' || err.message?.includes('interaction_in_progress')) {
        setLocalError('Microsoft sign-in is already in progress. Please wait and try again.');
      } else if (err.errorCode === 'block_nested_popups' || err.message?.includes('block_nested_popups')) {
        setLocalError('Microsoft sign-in window could not complete because another window is active. Please close any open window and try again.');
      } else {
        setLocalError(err.message || 'Microsoft authentication failed.');
      }
      setLoading(false);
      isExecutingRef.current = false;
    }
  };

  const handleSelectAccountSignIn = async () => {
    setLocalError(null);
    clearError();
    setLoading(true);
    try {
      await executeMicrosoftSelectAccountLogin();
    } catch (err: any) {
      setLocalError(err.message || 'Failed to switch Microsoft account.');
      setLoading(false);
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || passwordLoading) return;

    setPasswordLoading(true);
    setLocalError(null);
    clearError();

    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setLocalError(err.message || 'Password authentication failed.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const currentErrorMessage = error || localError;
  const isUnlinkedAccountError = currentErrorMessage?.includes('not linked to an authorized THEIAKSHI account') ||
                                 currentErrorMessage?.includes('UNAUTHORIZED_USER');

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-200">
      {/* Main Authentication Card */}
      <div className="w-full max-w-[520px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-8 sm:p-10 shadow-[var(--card-shadow)] relative z-10 space-y-7">

        {/* Top Brand Header */}
        <div className="text-center flex flex-col items-center space-y-3">
          <div className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded-2xl shadow-sm">
            <TheiakshiLogo variant="full" size="lg" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-heading)] tracking-tight">
              THEIAKSHI
            </h1>
            <p className="text-xs font-semibold text-[var(--text-secondary)] tracking-[0.15em] uppercase">
              HUMAN RESOURCE MANAGEMENT
            </p>
          </div>

          {/* Security Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--primary-soft)] border border-[var(--border-subtle)] rounded-full text-xs font-semibold text-[var(--primary)] shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
            <span>Microsoft Entra ID Protected</span>
          </div>
        </div>

        {/* Dedicated Unlinked Account Status Card */}
        {isUnlinkedAccountError ? (
          <div className="p-5 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 rounded-2xl space-y-4 text-left">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-white border border-[var(--action-danger-bg)]/30 rounded-xl shrink-0 text-[var(--action-danger-bg)]">
                <UserX className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-[var(--action-danger-bg)] uppercase tracking-wide">
                  Microsoft Identity Not Linked
                </h3>
                <p className="text-xs text-[var(--action-danger-bg)] leading-relaxed">
                  Your Microsoft account was authenticated successfully, but it is not currently linked to an authorized Theiakshi account.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--action-danger-bg)]/30 flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                onClick={handleSelectAccountSignIn}
                className="w-full sm:w-auto px-4 py-2 bg-[var(--action-danger-bg)] hover:bg-[var(--action-danger-hover)] text-[var(--action-danger-text)] font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Use Another Microsoft Account</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  clearError();
                  setActiveTab('password');
                }}
                className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-[var(--bg-surface-hover)] border border-[var(--border-default)] text-[var(--text-primary)] font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Sign in with Password</span>
              </button>
            </div>
          </div>
        ) : (
          /* Standard Error Messages */
          currentErrorMessage && (
            <div className="p-3.5 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 rounded-2xl text-[var(--action-danger-bg)] text-xs flex items-start gap-2.5 shadow-sm">
              <AlertCircle className="w-4 h-4 text-[var(--action-danger-bg)] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-[var(--action-danger-bg)]">Authentication Error</p>
                <p className="text-[var(--action-danger-bg)] leading-relaxed">{currentErrorMessage}</p>
              </div>
            </div>
          )
        )}

        {/* Authentication Mode Tabs */}
        <div className="flex bg-[var(--bg-surface-muted)] p-1 rounded-2xl border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setActiveTab('microsoft')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'microsoft'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Microsoft Entra SSO</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'password'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Email & Password</span>
          </button>
        </div>

        {/* TAB 1: Microsoft SSO Sign In */}
        {activeTab === 'microsoft' && (
          <div className="space-y-4 pt-1">
            <button
              type="button"
              onClick={handleMicrosoftSignIn}
              disabled={loading}
              className="w-full py-3.5 px-6 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-default)] text-[var(--text-primary)] font-bold rounded-2xl text-sm shadow-sm transition-all disabled:opacity-60 flex items-center justify-center gap-3 cursor-pointer group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--text-secondary)]" />
                  <span>Signing in with Microsoft...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                  </svg>
                  <span>Sign in with Microsoft</span>
                </>
              )}
            </button>

            <p className="text-center text-[11px] text-[var(--text-muted)] font-medium">
              Enterprise Single Sign-On powered by Microsoft 365 Entra ID.
            </p>
          </div>
        )}

        {/* TAB 2: Password Sign In */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordSignIn} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@theiakshi.com"
                className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--primary)] transition-colors placeholder:text-[var(--text-muted)] shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--primary)] transition-colors placeholder:text-[var(--text-muted)] shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading || !email || !password}
              className="w-full py-3 px-6 btn-theme-primary font-bold rounded-xl text-sm shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {passwordLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In with Password</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-center text-[11px] text-[var(--text-muted)] font-medium pt-1">
              Legacy password login for existing Theiakshi accounts.
            </p>
          </form>
        )}

        {/* Footer info */}
        <div className="text-center pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
          © {new Date().getFullYear()} Theiakshi. All rights reserved.
        </div>
      </div>
    </div>
  );
};
