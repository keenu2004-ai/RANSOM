import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Clock, CalendarDays, CalendarCheck, 
  Receipt, FileText, Package, Bell, BarChart3, History, Settings, ShieldCheck, X, ChevronRight, LogOut 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, setMobileOpen }) => {
  const { user, logout } = useAuth();
  const role = user?.role;

  // Prevent background body scrolling when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, perm: null },
    { label: 'Employees', path: '/employees', icon: Users, perm: 'EMPLOYEE_VIEW_WORKFORCE' },
    { label: 'Attendance', path: '/attendance', icon: Clock, perm: null },
    { label: 'Leave Management', path: '/leave', icon: CalendarDays, perm: null },
    { label: 'Holidays & Calendar', path: '/holidays', icon: CalendarCheck, perm: null },
    { label: 'Expense Claims', path: '/expenses', icon: Receipt, perm: null },
    { label: 'Weekly Plan', path: '/timesheets', icon: FileText, perm: null },
    { label: 'Asset Management', path: '/assets', icon: Package, perm: null },
    { label: 'Notifications', path: '/notifications', icon: Bell, perm: null },
    { label: 'Reports', path: '/reports', icon: BarChart3, perm: 'REPORTS_WORKFORCE_VIEW' },
    { label: 'Audit Logs', path: '/audit-logs', icon: History, perm: 'AUDIT_LOG_VIEW' },
    { label: 'Settings & Security', path: '/settings', icon: Settings, perm: null },
    { label: 'Admin Control', path: '/admin-control', icon: ShieldCheck, perm: 'USER_ROLE_ASSIGN' }
  ];

  const allowedNav = navItems.filter(item => !item.perm || hasPermission(role, item.perm));

  // User Display Info
  const emailUsername = user?.email ? user.email.split('@')[0] : 'User';
  const formattedName = emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1);
  const avatarBadge = emailUsername.charAt(0).toUpperCase();

  // Desktop Content (>= 1024px) - Preserved Unchanged
  const desktopContent = (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-300 w-64">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-950/40">
        <div>
          <h1 className="font-extrabold text-base tracking-wider text-cyan-400">THEIAKSHI</h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">Enterprise HRMS</p>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {allowedNav.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border-l-4 border-cyan-400 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Footer Identity */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 text-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="font-semibold text-slate-300 truncate">{user?.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/50">
            {user?.role}
          </span>
          {user?.employeeId ? (
            <span className="text-[10px] text-slate-500 font-mono">Linked</span>
          ) : (
            <span className="text-[10px] text-amber-500 font-mono">No Profile</span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (>= 1024px) */}
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">
        {desktopContent}
      </aside>

      {/* Mobile + Tablet Side Drawer (< 1024px) - Viewport Height Preserved */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity pointer-events-auto" 
            onClick={() => setMobileOpen && setMobileOpen(false)} 
          />

          {/* Drawer Container (100dvh Viewport Height, 3-Section Layout) */}
          <div className="relative z-10 w-[min(88vw,320px)] h-[100dvh] max-h-[100dvh] bg-white flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-left duration-200 pointer-events-auto">
            {/* SECTION 1: Fixed Profile Header */}
            <div className="pt-[max(1rem,env(safe-area-inset-top))] px-4 pb-4 bg-slate-50 border-b border-slate-200 relative shrink-0">
              <button 
                type="button"
                onClick={() => setMobileOpen && setMobileOpen(false)}
                className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 pr-8">
                {/* Avatar Badge */}
                <div className="w-11 h-11 rounded-full bg-purple-700 text-white font-bold text-base flex items-center justify-center shadow shrink-0">
                  {avatarBadge}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900 text-sm leading-snug truncate">{formattedName}</h3>
                  <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-extrabold uppercase bg-sky-100 text-sky-700 rounded-md tracking-wider">
                    {user?.role}
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 2: Independent Scrollable Navigation List */}
            <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100">
              {allowedNav.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen && setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-4 py-3.5 text-xs sm:text-sm transition-all min-h-[48px] ${
                        isActive
                          ? 'bg-sky-50 text-sky-600 font-bold border-l-4 border-sky-600'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </NavLink>
                );
              })}
            </div>

            {/* SECTION 3: Fixed Sticky Logout Footer */}
            <div className="p-0 border-t border-slate-200 shrink-0 pb-[max(0px,env(safe-area-inset-bottom))] bg-sky-500">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen && setMobileOpen(false);
                  logout();
                }}
                className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-bold text-xs sm:text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>LOGOUT</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
