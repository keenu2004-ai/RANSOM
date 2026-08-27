import React, { useEffect, useState, useRef } from 'react';
import { Menu, LogOut, Bell, MessageSquare, Search, Fingerprint, Loader2, CheckCheck, X, User as UserIcon, ChevronDown } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import { apiFetch } from '../../services/api-client';
import { getDisplayName } from '../../utils/displayName';
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const notifBellRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on route changes
  useEffect(() => {
    setIsNotificationsOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsNotificationsOpen(false);
        setUserMenuOpen(false);
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
      if (
        userMenuOpen &&
        userMenuRef.current &&
        !userMenuRef.current.contains(target)
      ) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isNotificationsOpen, userMenuOpen]);

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

  const formattedName = getDisplayName(user);
  const avatarLetter = formattedName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#050B14]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left: Mobile Hamburger & Logo */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="lg:hidden">
          <TheiakshiLogo variant="full" size="sm" />
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md hidden sm:block">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employees, modules..."
            className="w-full pl-10 pr-4 py-2 bg-[#0A1424] border border-white/10 focus:border-cyan-500/50 rounded-xl text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all shadow-inner"
          />
        </div>
      </form>

      {/* Right: Notifications, Punch, User Avatar & Dropdown */}
      <div className="flex items-center gap-3 relative">
        {/* Quick Check-in/out Punch Button */}
        {user?.employeeId && (
          <button
            type="button"
            onClick={handlePunch}
            disabled={actionLoading}
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold shadow transition-all cursor-pointer ${
              hasActiveSession
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
            title={hasActiveSession ? 'Active Session - Tap to Check Out' : 'Tap to Check In'}
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Fingerprint className="w-4 h-4" />
            )}
            <span>{hasActiveSession ? 'Check Out' : 'Check In'}</span>
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

        {/* Messages Button (Dynamic Unread Messages Badge) */}
        <div className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className="p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 border border-transparent transition-all cursor-pointer relative"
            aria-label="Messages"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile Pill & Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-600 to-red-800 text-white font-extrabold text-sm flex items-center justify-center shadow-md">
              {avatarLetter}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-bold text-slate-100 truncate max-w-[120px]">{formattedName}</p>
              <p className="text-[10px] font-semibold text-cyan-400 tracking-tight">{user?.role}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
          </button>

          {/* User Dropdown */}
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-[#0A1424] border border-white/10 text-slate-100 rounded-2xl shadow-2xl overflow-hidden z-50 p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 border-b border-white/5">
                <p className="text-xs font-bold text-slate-100 truncate">{formattedName}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  navigate('/settings');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
              >
                <UserIcon className="w-4 h-4 text-cyan-400" />
                <span>Account Settings</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
