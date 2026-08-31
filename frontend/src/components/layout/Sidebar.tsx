import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Clock, CalendarDays, CalendarCheck, 
  Receipt, FileText, Package, Bell, BarChart3, History, Settings, ShieldCheck, X, ChevronRight, PanelLeftClose, PanelLeftOpen 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';
import { TheiakshiLogo } from '../TheiakshiLogo';

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  mobileOpen = false, 
  setMobileOpen,
  collapsed = false,
  setCollapsed
}) => {
  const { user } = useAuth();
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
    { label: 'Leaves', path: '/leave', icon: CalendarDays, perm: null },
    { label: 'Expenses', path: '/expenses', icon: Receipt, perm: null },
    { label: 'Weekly Plan', path: '/timesheets', icon: FileText, perm: null },
    { label: 'Assets', path: '/assets', icon: Package, perm: null },
    { label: 'Holidays', path: '/holidays', icon: CalendarCheck, perm: null },
    { label: 'Notifications', path: '/notifications', icon: Bell, perm: null },
    { label: 'Reports', path: '/reports', icon: BarChart3, perm: 'REPORTS_WORKFORCE_VIEW' },
    { label: 'Audit Logs', path: '/audit-logs', icon: History, perm: 'AUDIT_LOG_VIEW' },
    { label: 'Settings', path: '/settings', icon: Settings, perm: null },
    { label: 'Admin Control', path: '/admin-control', icon: ShieldCheck, perm: 'USER_ROLE_ASSIGN' }
  ];

  const allowedNav = navItems.filter(item => !item.perm || hasPermission(role, item.perm));

  // Desktop Content (>= 1024px)
  const desktopContent = (
    <div className={`flex flex-col h-full bg-[#050B14] border-r border-white/10 text-slate-300 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
      {/* Brand Header */}
      <div className={`flex items-center ${collapsed ? 'justify-center py-5' : 'justify-between px-5 py-5'} border-b border-white/10 bg-[#020817]/70`}>
        {collapsed ? (
          <TheiakshiLogo variant="emblem" size="md" />
        ) : (
          <TheiakshiLogo variant="full" size="md" />
        )}
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 custom-scrollbar">
        {allowedNav.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-[#3B82F6] text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                } ${collapsed ? 'justify-center px-0' : ''}`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </div>

      {/* Footer Controls: Collapse Toggle Only (Ends Sidebar cleanly) */}
      <div className="p-3 border-t border-white/10 bg-[#020817]/80 text-xs">
        <button
          type="button"
          onClick={() => setCollapsed && setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-5 h-5" />
          ) : (
            <>
              <PanelLeftClose className="w-5 h-5" />
              <span className="text-xs font-semibold">Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (>= 1024px) */}
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0 z-40">
        {desktopContent}
      </aside>

      {/* Mobile + Tablet Side Drawer (< 1024px) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity pointer-events-auto" 
            onClick={() => setMobileOpen && setMobileOpen(false)} 
          />

          {/* Drawer Container (100dvh Viewport Height) */}
          <div className="relative z-10 w-[min(85vw,320px)] h-[100dvh] bg-[#050B14] border-r border-white/10 flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-left duration-200 pointer-events-auto pt-[max(0px,env(safe-area-inset-top))] pb-[max(0px,env(safe-area-inset-bottom))]">
            {/* Header with Logo & Close */}
            <div className="p-4 bg-[#020817] border-b border-white/10 flex items-center justify-between">
              <TheiakshiLogo variant="full" size="md" />
              <button 
                type="button"
                onClick={() => setMobileOpen && setMobileOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {allowedNav.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen && setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-[#3B82F6] text-white shadow-lg shadow-blue-500/20'
                          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
