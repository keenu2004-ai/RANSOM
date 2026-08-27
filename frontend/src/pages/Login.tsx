import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';
import { 
  initializeMsal, 
  executeMicrosoftRedirectLogin, 
  executeMicrosoftPopupLogin, 
  getSilentIdToken 
} from '../config/msalConfig';
import { TheiakshiLogo } from '../components/TheiakshiLogo';

export const Login: React.FC = () => {
  const { user, loginWithMicrosoft, error } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Guard against concurrent clicks or rapid re-renders
  const isExecutingRef = useRef(false);

  // Process MSAL redirect result or silent token on initial page load
  useEffect(() => {
    let isMounted = true;

    const processAuthOnLoad = async () => {
      // If user is already authenticated in App context, skip
      if (user) return;

      try {
        // Step 1: Process redirect result if returning from Microsoft Entra ID
        const redirectResult = await initializeMsal();
        if (redirectResult?.idToken) {
          if (!isMounted) return;
          setLoading(true);
          setLocalError(null);
          await loginWithMicrosoft(redirectResult.idToken);
          navigate('/dashboard', { replace: true });
          return;
        }

        // Step 2: Check for existing session token silently
        const silentIdToken = await getSilentIdToken();
        if (silentIdToken) {
          if (!isMounted) return;
          setLoading(true);
          await loginWithMicrosoft(silentIdToken);
          navigate('/dashboard', { replace: true });
          return;
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

    isExecutingRef.current = true;
    setLoading(true);
    setLocalError(null);

    try {
      // Primary Single-Redirect Flow (Prevents popup blocking & block_nested_popups)
      await executeMicrosoftRedirectLogin();
    } catch (err: any) {
      console.error('Microsoft sign-in error:', err);

      // Fallback to popup login if environment prohibits top-level redirect
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

  return (
    <div className="min-h-screen bg-[#020817] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-cyan-500 selection:text-white">
      {/* Background Decorative Glows */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[450px] h-[450px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-[350px] h-[350px] bg-red-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Authentication Card */}
      <div className="w-full max-w-[560px] bg-[#0A1424]/90 border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/80 backdrop-blur-xl relative z-10 space-y-8">
        
        {/* Top Brand Header */}
        <div className="text-center flex flex-col items-center space-y-4">
          <div className="p-3 bg-[#07111F] border border-white/5 rounded-2xl shadow-inner relative group">
            <div className="absolute inset-0 bg-red-500/10 rounded-2xl blur-md opacity-50 group-hover:opacity-100 transition-opacity" />
            <TheiakshiLogo variant="full" size="xl" className="relative z-10" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
              THEIAKSHI ENTERPRISE
            </h1>
            <p className="text-xs font-semibold text-cyan-400 uppercase tracking-[0.2em]">
              ENTERPRISE HUMAN RESOURCE SYSTEM
            </p>
          </div>

          {/* Security Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-cyan-950/40 border border-cyan-500/30 rounded-full text-xs font-semibold text-cyan-300 shadow-sm">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Microsoft Entra ID Protected</span>
          </div>
        </div>

        {/* Error Messages */}
        {(error || localError) && (
          <div className="p-4 bg-rose-950/60 border border-rose-600/50 rounded-2xl text-rose-200 text-xs flex items-start gap-3 shadow-lg animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-rose-100">Authentication Error</p>
              <p className="text-rose-300/90 leading-relaxed">{error || localError}</p>
            </div>
          </div>
        )}

        {/* Sign In Button Area */}
        <div className="space-y-4 pt-2">
          <button
            type="button"
            onClick={handleMicrosoftSignIn}
            disabled={loading}
            className="w-full py-4 px-6 bg-white hover:bg-slate-100 active:scale-[0.99] text-slate-950 font-bold rounded-2xl text-base shadow-xl shadow-cyan-500/10 transition-all disabled:opacity-60 flex items-center justify-center gap-3 border border-white/20 cursor-pointer group"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-slate-800" />
                <span className="font-extrabold text-slate-900">Signing in with Microsoft...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M1 1h10v10H1z"/>
                  <path fill="#81bc06" d="M12 1h10v10H12z"/>
                  <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                  <path fill="#ffba08" d="M12 12h10v10H12z"/>
                </svg>
                <span className="font-extrabold text-slate-900 tracking-tight">Sign in with Microsoft</span>
              </>
            )}
          </button>
        </div>

        {/* Footer info */}
        <div className="text-center pt-2 border-t border-white/5 text-[11px] text-slate-500">
          © {new Date().getFullYear()} Theiakshi Enterprises. All rights reserved.
        </div>
      </div>
    </div>
  );
};
