import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Building2, AlertCircle, ShieldCheck } from 'lucide-react';
import { ensureMsalInitialized, loginRequest } from '../config/msalConfig';

export const Login: React.FC = () => {
  const { user, loginWithMicrosoft, login, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleMicrosoftSignIn = async () => {
    setLoading(true);
    setLocalError(null);
    try {
      const msalInstance = await ensureMsalInitialized();
      let response;
      try {
        response = await msalInstance.loginPopup(loginRequest);
      } catch (popupErr: any) {
        if (popupErr.errorCode === 'user_cancelled') {
          setLocalError('Microsoft sign in was cancelled.');
          return;
        }
        if (popupErr.errorCode === 'interaction_in_progress') {
          setLocalError('An authentication interaction is already in progress. Please complete or close the pop-up.');
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
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLocalError(null);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      // Error handled by AuthContext state
    } finally {
      setLoading(false);
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

        <div className="space-y-4 pt-2">
          <button
            type="button"
            onClick={handleMicrosoftSignIn}
            disabled={loading}
            className="w-full py-4 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl text-sm shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3 border border-slate-300"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z"/>
              <path fill="#81bc06" d="M12 1h10v10H12z"/>
              <path fill="#05a6f0" d="M1 12h10v10H1z"/>
              <path fill="#ffba08" d="M12 12h10v10H12z"/>
            </svg>
            <span>Sign in with Microsoft</span>
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-4 text-xs text-slate-500 font-medium">Internal Work Account Access</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {!showPasswordFallback ? (
            <button
              type="button"
              onClick={() => setShowPasswordFallback(true)}
              className="w-full py-2 text-xs text-slate-400 hover:text-cyan-400 transition-colors text-center font-medium"
            >
              Sign in with password (Development Fallback)
            </button>
          ) : (
            <form className="space-y-4 pt-2 border-t border-slate-800/80" onSubmit={handlePasswordSubmit}>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Company Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  placeholder="user@theiakshi.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  placeholder="••••••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                <span>Password Sign In</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
