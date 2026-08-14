import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, KeyRound, UserCheck, Building2, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, error, clearError } = useAuth();
  const [email, setEmail] = useState('superadmin@theiakshi.com');
  const [password, setPassword] = useState('ChangeMe@123');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      // Error handled by AuthContext
    } finally {
      setLoading(false);
    }
  };

  const setDemo = (demoEmail: string) => {
    clearError();
    setEmail(demoEmail);
    setPassword('ChangeMe@123');
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
        </div>

        {error && (
          <div className="p-4 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Authentication Failure</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              placeholder="user@theiakshi.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Sign In to Dashboard</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Login Preset Buttons */}
        <div className="pt-6 border-t border-slate-800 space-y-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">Quick Demo Account Switch</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => setDemo('superadmin@theiakshi.com')}
              className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-lg text-slate-300 text-left truncate"
            >
              <div className="font-bold text-cyan-400">SUPER ADMIN</div>
              <div className="text-[10px] text-slate-500 truncate">superadmin@theiakshi.com</div>
            </button>
            <button
              onClick={() => setDemo('admin@theiakshi.com')}
              className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-lg text-slate-300 text-left truncate"
            >
              <div className="font-bold text-cyan-400">ADMIN</div>
              <div className="text-[10px] text-slate-500 truncate">admin@theiakshi.com</div>
            </button>
            <button
              onClick={() => setDemo('hr@theiakshi.com')}
              className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-lg text-slate-300 text-left truncate"
            >
              <div className="font-bold text-emerald-400">HR MANAGER</div>
              <div className="text-[10px] text-slate-500 truncate">hr@theiakshi.com</div>
            </button>
            <button
              onClick={() => setDemo('manager@theiakshi.com')}
              className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-lg text-slate-300 text-left truncate"
            >
              <div className="font-bold text-indigo-400">MANAGER</div>
              <div className="text-[10px] text-slate-500 truncate">manager@theiakshi.com</div>
            </button>
          </div>
          <button
            onClick={() => setDemo('employee@theiakshi.com')}
            className="w-full p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-lg text-slate-300 text-left truncate"
          >
            <div className="font-bold text-amber-400">EMPLOYEE (Self-Service)</div>
            <div className="text-[10px] text-slate-500 truncate">employee@theiakshi.com (EMP-003)</div>
          </button>
        </div>
      </div>
    </div>
  );
};
