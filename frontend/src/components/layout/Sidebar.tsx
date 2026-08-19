import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Clock, CalendarDays, CalendarCheck, Briefcase, 
  Receipt, FileText, Package, Bell, BarChart3, History, Settings, ShieldCheck, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, setMobileOpen }) => {
  const { user } = useAuth();
  const role = user?.role;

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'] },
    { label: 'Employees', path: '/employees', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'] },
    { label: 'Attendance', path: '/attendance', icon: Clock, roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'] },
    { label: 'Leave Management', path: '/leave', icon: CalendarDays, roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'] },
    { label: 'Holidays & Calendar', path: '/holidays', icon: CalendarCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'] },
    { label: 'Expense Claims', path: '/expenses', icon: Receipt, roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'] },
    { label: 'Weekly Plan', path: '/timesheets', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'] },
    { label: 'Asset Management', path: '/assets', icon: Package, roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'] },
    { label: 'Notifications', path: '/notifications', icon: Bell, roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'] },
    { label: 'Reports', path: '/reports', icon: BarChart3, roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'] },
    { label: 'Audit Logs', path: '/audit-logs', icon: History, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { label: 'Settings', path: '/settings', icon: Settings, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { label: 'Admin Control', path: '/admin-control', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'ADMIN'] }
  ];

  const allowedNav = navItems.filter(item => role && item.roles.includes(role));

  const content = (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-300 w-64">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-950/40">
        <div>
          <h1 className="font-extrabold text-base tracking-wider text-cyan-400">THEIAKSHI</h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">Enterprise HRMS</p>
        </div>
        {setMobileOpen && (
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {allowedNav.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen && setMobileOpen(false)}
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
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setMobileOpen && setMobileOpen(false)} />
          <div className="relative z-10">{content}</div>
        </div>
      )}
    </>
  );
};
