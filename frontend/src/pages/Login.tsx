import React, { useState, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';
import { executeMicrosoftPopupLogin } from '../config/msalConfig';

export const Login: React.FC = () => {
  const { user, loginWithMicrosoft, error } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Guard against concurrent clicks or rapid re-renders
  const isExecutingRef = useRef(false);

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
      let response;
      try {
        response = await executeMicrosoftPopupLogin();
      } catch (popupErr: any) {
        if (popupErr.errorCode === 'user_cancelled' || popupErr.errorCode === 'popup_window_closed' || popupErr.message?.includes('user_cancelled')) {
          setLocalError('Microsoft sign in was cancelled or closed. Please try again.');
          return;
        }
        if (popupErr.errorCode === 'interaction_in_progress' || popupErr.message?.includes('interaction_in_progress')) {
          setLocalError('A Microsoft sign-in window is already open. Please complete or close the pop-up window and try again.');
          return;
        }
        throw popupErr;
      }

      const idToken = response?.idToken;
      if (!idToken) {
        throw new Error('No Microsoft ID token returned from authentication.');
      }

      await loginWithMicrosoft(idToken);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Microsoft sign-in error:', err);
      setLocalError(err.message || 'Microsoft authentication failed.');
    } finally {
      setLoading(false);
      isExecutingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Dynamic Background Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-8 bg-slate-900/90 border border-slate-800 p-8 rounded-2xl shadow-2xl backdrop-blur relative z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400 mb-2">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">THEIAKSHI ENTERPRISE</h2>
          <p className="text-xs text-cyan-400 font-medium uppercase tracking-widest">Enterprise Human Resource System</p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-950/60 border border-cyan-800/40 rounded-full text-[11px] font-semibold text-cyan-300 mt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Microsoft Entra ID Protected</span>
          </div>
        </div>

        {(error || localError) && (
          <div className="p-4 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Authentication Failure</p>
              <p className="mt-0.5">{error || localError}</p>
            </div>
          </div>
        )}

        <div className="space-y-4 pt-4">
          <button
            type="button"
            onClick={handleMicrosoftSignIn}
            disabled={loading}
            className="w-full py-4 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl text-sm shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3 border border-slate-300 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
                <span>Signing in with Microsoft...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M1 1h10v10H1z"/>
                  <path fill="#81bc06" d="M12 1h10v10H12z"/>
                  <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                  <path fill="#ffba08" d="M12 12h10v10H12z"/>
                </svg>
                <span>Sign in with Microsoft</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
