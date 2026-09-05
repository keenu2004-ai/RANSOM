import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center p-4 selection:bg-[var(--primary)] selection:text-white">
      <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl shadow-xl p-8 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center border border-[var(--primary)]/20 shadow-sm">
          <Compass className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--primary)] bg-[var(--primary-soft)] px-3 py-1 rounded-full border border-[var(--primary)]/20 inline-block">
            404 Error
          </span>
          <h1 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">
            Page Not Found
          </h1>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            The page you're looking for doesn't exist or may have moved.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--primary-soft)] transition-colors min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <button
            type="button"
            onClick={() => navigate(user ? '/dashboard' : '/login')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white text-xs font-semibold hover:bg-[var(--primary-hover)] transition-colors shadow-sm min-h-[44px]"
          >
            <LayoutDashboard className="w-4 h-4" />
            {user ? 'Go to Dashboard' : 'Go to Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
