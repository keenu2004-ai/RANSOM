import React, { useEffect, useState } from 'react';
import { Menu, LogOut, Building2, Download, Bell, Fingerprint, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { todaySummary, actionLoading, handlePunch } = useAttendance();
  const navigate = useNavigate();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted PWA installation prompt');
    }
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  const hasActiveSession = !!todaySummary?.activeSession;

  return (
    <>
      {/* ─── DESKTOP HEADER (>= 1024px) ─── */}
      <header className="hidden lg:flex sticky top-0 z-30 items-center justify-between h-16 px-6 bg-slate-900/90 backdrop-blur border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Building2 className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-slate-200">Theiakshi Enterprise</span>
            <span className="text-slate-600">|</span>
            <span className="font-mono text-cyan-400">₹ INR</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {showInstallBtn && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all animate-pulse"
              title="Install THEIAKSHI App"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.email}</p>
              <p className="text-[10px] text-cyan-400 font-mono">{user?.role}</p>
            </div>
            <button
              onClick={() => logout()}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-400 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-800/50 rounded-lg transition-all"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── MOBILE + TABLET HEADER (< 1024px) - TeamNest Style ─── */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-sky-600 text-white shadow-md">
        {/* Left: Hamburger Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="p-1.5 text-white hover:bg-sky-700/60 rounded-lg transition-all active:scale-95"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Org Name (Truncated if long) */}
          <div className="font-bold text-sm tracking-tight truncate max-w-[170px] sm:max-w-[280px]">
            Theiakshi Enterprise
          </div>
        </div>

        {/* Right: Notifications & Quick Attendance Action */}
        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button
            onClick={() => navigate('/notifications')}
            aria-label="Notifications"
            className="relative p-2 text-white hover:bg-sky-700/60 rounded-full transition-all active:scale-95"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full ring-2 ring-sky-600" />
          </button>

          {/* Quick Attendance Punch Button (Fingerprint Icon - TeamNest Style) */}
          <button
            onClick={handlePunch}
            disabled={actionLoading}
            aria-label={hasActiveSession ? 'Check out' : 'Check in'}
            title={hasActiveSession ? 'Active Session - Tap to Check Out' : 'Tap to Check In'}
            className={`flex items-center justify-center p-2 rounded-full shadow-md transition-all active:scale-95 ${
              hasActiveSession
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 animate-pulse'
                : 'bg-emerald-500 hover:bg-emerald-400 text-white'
            }`}
          >
            {actionLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Fingerprint className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>
    </>
  );
};
