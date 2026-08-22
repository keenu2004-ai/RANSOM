import React, { useEffect, useState, useRef } from 'react';
import { Menu, LogOut, Building2, Download, Bell, Fingerprint, Loader2, CheckCheck, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import { apiFetch } from '../../services/api-client';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { todaySummary, actionLoading, handlePunch } = useAttendance();
  const navigate = useNavigate();
  const location = useLocation();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  // Mobile / Tablet Notification Drawer State (Single Source of Truth)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifLoading, setNotifLoading] = useState(false);

  const notifPanelRef = useRef<HTMLDivElement>(null);

  // PWA Install Prompt Listener
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

  // Close notification panel automatically when navigating
  useEffect(() => {
    setIsNotificationsOpen(false);
  }, [location.pathname]);

  // Handle ESC key to close notification drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isNotificationsOpen) {
        setIsNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNotificationsOpen]);

  // Fetch notifications whenever drawer opens or user changes
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setNotifLoading(true);
      const res = await apiFetch<{ notifications: any[]; unreadCount: number }>('/notifications');
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    if (isNotificationsOpen) {
      fetchNotifications();
    }
  }, [isNotificationsOpen]);

  // Initial fetch for unread badge count
  useEffect(() => {
    fetchNotifications();
  }, [user]);

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

  const toggleNotifications = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsNotificationsOpen(prev => !prev);
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch('/notifications/mark-all-read', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark all read:', err);
    }
  };

  const handleNotificationClick = (link?: string) => {
    setIsNotificationsOpen(false);
    if (link) {
      navigate(link);
    } else {
      navigate('/notifications');
    }
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

          {/* Org Name */}
          <div className="font-bold text-sm tracking-tight truncate max-w-[170px] sm:max-w-[280px]">
            Theiakshi Enterprise
          </div>
        </div>

        {/* Right: Notifications Bell Toggle & Quick Attendance Action */}
        <div className="flex items-center gap-2">
          {/* Notification Bell (Tap 1: Open, Tap 2: Close) */}
          <button
            onClick={toggleNotifications}
            aria-label="Toggle notifications panel"
            className={`relative p-2 text-white hover:bg-sky-700/60 rounded-full transition-all active:scale-95 ${
              isNotificationsOpen ? 'bg-sky-700 ring-2 ring-white/50' : ''
            }`}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 ? (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-slate-950 ring-2 ring-sky-600">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full ring-2 ring-sky-600" />
            )}
          </button>

          {/* Quick Attendance Punch Button */}
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

      {/* ─── MOBILE / TABLET NOTIFICATION PANEL & BACKDROP (< 1024px) ─── */}
      {isNotificationsOpen && (
        <div className="lg:hidden">
          {/* Backdrop (Clicking backdrop closes panel) */}
          <div
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsNotificationsOpen(false)}
          />

          {/* Notification Panel Floating Dropdown */}
          <div
            ref={notifPanelRef}
            className="fixed top-16 right-2 sm:right-4 z-50 w-[calc(100vw-1rem)] max-w-sm bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in slide-in-from-top-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-750">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsNotificationsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors"
                aria-label="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[55vh]">
              {notifLoading ? (
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Loading notifications...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No notifications found
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n.link)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      !n.is_read
                        ? 'bg-slate-800/90 border-cyan-500/40 text-slate-100 shadow-sm hover:border-cyan-400'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-200 mb-0.5">{n.title}</p>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-slate-300 leading-snug">{n.message}</p>
                    <span className="text-[10px] text-slate-500 block mt-1.5 font-mono">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Footer Bar */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs">
              <button
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 disabled:opacity-40 text-[11px] font-medium transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all as read</span>
              </button>
              <button
                onClick={() => handleNotificationClick('/notifications')}
                className="font-semibold text-sky-400 hover:text-sky-300 text-[11px] transition-colors"
              >
                View all notifications →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
