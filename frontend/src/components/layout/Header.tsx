import React, { useEffect, useState, useRef } from 'react';
import {
  Menu,
  Bell,
  Fingerprint,
  Loader2,
  CheckCheck,
  X,
  LogOut,
  UserRound,
  Sun,
  Moon
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import { useTheme } from '../../context/ThemeContext';
import { apiFetch } from '../../services/api-client';
import { TheiakshiLogo } from '../TheiakshiLogo';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { todaySummary, actionLoading, handlePunch } = useAttendance();
  const activeSession = todaySummary?.activeSession || null;
  const hasActiveSession = !!activeSession;
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  const notifBellRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on route changes
  useEffect(() => {
    setIsNotificationsOpen(false);
    setIsProfileOpen(false);
  }, [location.pathname]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsNotificationsOpen(false);
        setIsProfileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        isNotificationsOpen &&
        drawerRef.current &&
        !drawerRef.current.contains(target) &&
        notifBellRef.current &&
        !notifBellRef.current.contains(target)
      ) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isNotificationsOpen]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleProfileClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;

      if (
        isProfileOpen &&
        profileRef.current &&
        !profileRef.current.contains(target)
      ) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleProfileClickOutside);
    document.addEventListener('touchstart', handleProfileClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleProfileClickOutside);
      document.removeEventListener('touchstart', handleProfileClickOutside);
    };
  }, [isProfileOpen]);

  // Fetch notifications
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

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/notifications/mark-all-read', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark all read:', err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const query = searchQuery.toLowerCase().trim();
    if (query.includes('emp')) navigate('/employees');
    else if (query.includes('att')) navigate('/attendance');
    else if (query.includes('lea')) navigate('/leave');
    else if (query.includes('exp')) navigate('/expenses');
    else if (query.includes('rep')) navigate('/reports');
    else navigate('/dashboard');
  };

  const handleLogout = async () => {
    if (logoutLoading) return;

    try {
      setLogoutLoading(true);
      setIsProfileOpen(false);
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setLogoutLoading(false);
    }
  };

  const profileName =
    user?.name ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'User';

  const profileInitials = (() => {
    const source = profileName.trim();

    if (!source) return 'U';

    const parts = source.split(/\s+/);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    return source.substring(0, 2).toUpperCase();
  })();

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#050B14]/90 backdrop-blur-xl border-b border-white/10 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
      {/* Left: Mobile Hamburger & Logo */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-1.5 sm:p-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <div className="lg:hidden flex items-center max-w-[130px] sm:max-w-none">
          <TheiakshiLogo variant="full" size="sm" />
        </div>

        {/* Desktop Header Left Branding */}
        <div className="hidden lg:flex items-center gap-3">
          <TheiakshiLogo variant="emblem" size="md" />
          <span className="font-extrabold text-base text-white tracking-tight">
            Theiakshi Enterprises
          </span>
        </div>
      </div>

      {/* Right Controls: Attendance, Bell, Theme Toggle, Profile */}
      <div className="flex items-center gap-1.5 sm:gap-3 relative shrink-0">
        {/* Quick Check-in/out Punch Button */}
        {user?.employeeId && (
          <button
            type="button"
            onClick={handlePunch}
            disabled={actionLoading}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-semibold shadow transition-all cursor-pointer ${
              hasActiveSession
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
            title={hasActiveSession ? 'Active Session - Tap to Check Out' : 'Tap to Check In'}
            aria-label={hasActiveSession ? 'Check Out Attendance' : 'Check In Attendance'}
          >
            {actionLoading ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin shrink-0" />
            ) : (
              <Fingerprint className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            )}
            <span className="text-[10px] sm:text-xs font-medium">{hasActiveSession ? 'Out' : 'In'}</span>
          </button>
        )}

        {/* Notifications Bell Button */}
        <div className="relative">
          <button
            ref={notifBellRef}
            type="button"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 border border-transparent transition-all cursor-pointer relative ${
              isNotificationsOpen ? 'bg-white/10 border-white/10 text-cyan-400' : ''
            }`}
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-extrabold text-white ring-2 ring-[#050B14]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {isNotificationsOpen && (
            <div
              ref={drawerRef}
              className="absolute right-0 mt-3 w-80 sm:w-96 bg-[#0A1424] border border-white/10 text-slate-100 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-[#07111F] border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-200">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                {notifLoading ? (
                  <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Loading alerts...</span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No recent notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setIsNotificationsOpen(false);
                        if (n.link) navigate(n.link);
                      }}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        !n.is_read
                          ? 'bg-[#0D1728] border-cyan-500/30 text-slate-100 hover:border-cyan-400'
                          : 'bg-[#050B14]/60 border-white/5 text-slate-400 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-200">{n.title}</p>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 mt-1" />}
                      </div>
                      <p className="text-slate-300 text-[11px] mt-0.5 leading-snug">{n.message}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 bg-[#07111F] border-t border-white/10 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0}
                  className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 disabled:opacity-40 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Mark all read</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        {(() => {
          const { theme, toggleTheme } = useTheme();
          return (
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 border border-transparent transition-all cursor-pointer relative"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-indigo-400" />
              )}
            </button>
          );
        })()}

        {/* User Profile Menu */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setIsProfileOpen(prev => !prev)}
            className={`flex items-center gap-2 p-1.5 rounded-xl transition-all cursor-pointer border ${
              isProfileOpen
                ? 'bg-white/10 border-white/10'
                : 'border-transparent hover:bg-white/5'
            }`}
            aria-label="Open profile menu"
            aria-expanded={isProfileOpen}
          >
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-xs font-bold">
              {profileInitials}
            </div>

            <div className="hidden lg:block text-left max-w-[140px]">
              <p className="text-xs font-semibold text-slate-100 truncate">
                {profileName}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {user?.role?.replace('_', ' ') || 'User'}
              </p>
            </div>

            <svg
              className={`hidden sm:block w-3.5 h-3.5 text-slate-400 transition-transform ${
                isProfileOpen ? 'rotate-180' : ''
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25-4.51a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-3 w-72 bg-[#0A1424] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-4 bg-[#07111F] border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold">
                    {profileInitials}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {profileName}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate('/profile');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-medium text-slate-200 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                >
                  <UserRound className="w-4 h-4 text-slate-400" />
                  <span>My Profile</span>
                </button>

                <div className="my-1 border-t border-white/5" />

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {logoutLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                  <span>
                    {logoutLoading ? 'Signing out...' : 'Sign Out'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
