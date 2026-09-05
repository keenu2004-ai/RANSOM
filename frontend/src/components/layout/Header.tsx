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
  Palette,
  Check
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import { useTheme, Theme } from '../../context/ThemeContext';
import { apiFetch } from '../../services/api-client';
import { TheiakshiLogo } from '../TheiakshiLogo';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { todaySummary, actionLoading, handlePunch } = useAttendance();
  const { theme, setTheme, themes, currentThemeMeta } = useTheme();
  const activeSession = todaySummary?.activeSession || null;
  const hasActiveSession = !!activeSession;
  const navigate = useNavigate();
  const location = useLocation();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifLoading, setNotifLoading] = useState(false);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const notifBellRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on route changes
  useEffect(() => {
    setIsNotificationsOpen(false);
    setIsProfileOpen(false);
    setIsThemeMenuOpen(false);
  }, [location.pathname]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsNotificationsOpen(false);
        setIsProfileOpen(false);
        setIsThemeMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle outside click for notifications
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

  // Close theme menu when clicking outside
  useEffect(() => {
    const handleThemeClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        isThemeMenuOpen &&
        themeRef.current &&
        !themeRef.current.contains(target)
      ) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleThemeClickOutside);
    document.addEventListener('touchstart', handleThemeClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleThemeClickOutside);
      document.removeEventListener('touchstart', handleThemeClickOutside);
    };
  }, [isThemeMenuOpen]);

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
    <header className="sticky top-0 z-30 h-16 bg-[var(--header-bg)] border-b border-[var(--header-border)] px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 min-w-0 transition-colors duration-200 shadow-sm">
      {/* Left: Mobile Hamburger & Logo */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-1.5 sm:p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-xl transition-colors cursor-pointer"
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
          <span className="font-extrabold text-base text-[var(--text-primary)] tracking-tight">
            Theiakshi
          </span>
        </div>
      </div>

      {/* Right Controls: Attendance Punch, Theme Selector, Bell, Profile */}
      <div className="flex items-center gap-1.5 sm:gap-3 relative shrink-0">
        {/* Quick Check-in/out Punch Button */}
        {user?.employeeId && (
          <button
            type="button"
            onClick={handlePunch}
            disabled={actionLoading}
            className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer ${
              hasActiveSession
                ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
            title={hasActiveSession ? 'Active Session - Tap to Check Out' : 'Tap to Check In'}
            aria-label={hasActiveSession ? 'Check Out Attendance' : 'Check In Attendance'}
          >
            {actionLoading ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin shrink-0" />
            ) : (
              <Fingerprint className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            )}
            <span className="text-[11px] sm:text-xs font-semibold">{hasActiveSession ? 'Punch Out' : 'Punch In'}</span>
          </button>
        )}

        {/* ─── COMPACT THEME SELECTOR ─── */}
        <div ref={themeRef} className="relative">
          <button
            type="button"
            onClick={() => setIsThemeMenuOpen(prev => !prev)}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-sm"
            title={`Current theme: ${currentThemeMeta.name}. Click to change.`}
            aria-label="Select Theme"
            aria-expanded={isThemeMenuOpen}
          >
            <span
              className="w-2.5 h-2.5 rounded-full ring-2 ring-white/50 shrink-0"
              style={{ backgroundColor: currentThemeMeta.swatch.primary }}
            />
            <span className="hidden sm:inline text-xs font-semibold">{currentThemeMeta.name}</span>
            <Palette className="w-3.5 h-3.5 opacity-60 shrink-0" />
          </button>

          {/* Theme Selector Popover */}
          {isThemeMenuOpen && (
            <div className="absolute right-0 mt-2.5 w-60 bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 p-2 space-y-1">
              <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Color Theme
              </div>
              {themes.map(t => {
                const isActive = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTheme(t.id as Theme);
                      setIsThemeMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center -space-x-1">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: t.swatch.bg }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: t.swatch.primary }}
                        />
                      </div>
                      <div>
                        <p className="font-bold text-xs">{t.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)] font-normal">{t.description}</p>
                      </div>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-[var(--primary)] shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Notifications Bell Button */}
        <div className="relative">
          <button
            ref={notifBellRef}
            type="button"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent transition-all cursor-pointer relative ${
              isNotificationsOpen ? 'bg-[var(--bg-surface-muted)] border-[var(--border-subtle)]' : ''
            }`}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-[9px] font-extrabold text-white ring-2 ring-[var(--bg-surface)]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {isNotificationsOpen && (
            <div
              ref={drawerRef}
              className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-surface-muted)] border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[var(--primary)]" />
                  <span className="font-bold text-xs uppercase tracking-wider text-[var(--text-primary)]">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[var(--primary-soft)] text-[var(--primary)] rounded-full border border-[var(--border-subtle)]">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                {notifLoading ? (
                  <div className="py-6 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)]" />
                    <span>Loading alerts...</span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-muted)]">
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
                          ? 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--primary)] shadow-sm'
                          : 'bg-[var(--bg-surface-muted)]/50 border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-[var(--text-primary)]">{n.title}</p>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-[var(--primary)] shrink-0 mt-1" />}
                      </div>
                      <p className="text-[var(--text-secondary)] text-[11px] mt-0.5 leading-snug">{n.message}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 bg-[var(--bg-surface-muted)] border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0}
                  className="flex items-center gap-1.5 text-[var(--primary)] hover:underline disabled:opacity-40 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Mark all read</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setIsProfileOpen(prev => !prev)}
            className={`flex items-center gap-2 p-1 rounded-xl transition-all cursor-pointer border ${
              isProfileOpen
                ? 'bg-[var(--bg-surface-muted)] border-[var(--border-default)]'
                : 'border-transparent hover:bg-[var(--bg-surface-hover)]'
            }`}
            aria-label="Open profile menu"
            aria-expanded={isProfileOpen}
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--primary-soft)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--primary)] text-xs font-bold">
              {profileInitials}
            </div>

            <div className="hidden lg:block text-left max-w-[140px]">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {profileName}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] truncate capitalize">
                {user?.role?.replace('_', ' ').toLowerCase() || 'User'}
              </p>
            </div>

            <svg
              className={`hidden sm:block w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${
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
            <div className="absolute right-0 mt-2.5 w-72 bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-4 bg-[var(--bg-surface-muted)] border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--primary)] font-bold">
                    {profileInitials}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                      {profileName}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-2 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <UserRound className="w-4 h-4 text-[var(--text-muted)]" />
                  <span>My Settings</span>
                </button>

                <div className="my-1 border-t border-[var(--border-subtle)]" />

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
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
