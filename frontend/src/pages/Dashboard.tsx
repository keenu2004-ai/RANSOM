import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { useAttendance } from '../context/AttendanceContext';
import { hasPermission } from '../utils/permissions';
import { 
  Users, CheckCircle2, CalendarDays, Receipt, 
  Sparkles, ShieldCheck, LogIn, LogOut, Package,
  FileText, CalendarCheck, Bell, BarChart3, History, Gift, ChevronRight, Fingerprint, Clock
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { todaySummary, actionLoading, handlePunch } = useAttendance();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const res = await apiFetch('/dashboard');
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading Workspace Dashboard...</div>;
  }

  const summary = data?.summary || {};
  const role = user?.role;

  // Mobile App Launcher Tile Items (TeamNest Style)
  const appTiles = [
    { label: 'Attendance', path: '/attendance', icon: Clock, color: 'text-sky-600 bg-sky-50 border-sky-100', perm: null },
    { label: 'Leaves', path: '/leave', icon: CalendarDays, color: 'text-emerald-600 bg-emerald-50 border-emerald-100', perm: null },
    { label: 'Expenses', path: '/expenses', icon: Receipt, color: 'text-blue-600 bg-blue-50 border-blue-100', perm: null },
    { label: 'Timesheet', path: '/timesheets', icon: FileText, color: 'text-indigo-600 bg-indigo-50 border-indigo-100', perm: null },
    { label: 'My Assets', path: '/assets', icon: Package, color: 'text-amber-600 bg-amber-50 border-amber-100', perm: null },
    { label: 'Holidays', path: '/holidays', icon: CalendarCheck, color: 'text-rose-600 bg-rose-50 border-rose-100', perm: null },
    { label: 'Notifications', path: '/notifications', icon: Bell, color: 'text-purple-600 bg-purple-50 border-purple-100', perm: null },
    { label: 'Employees', path: '/employees', icon: Users, color: 'text-cyan-600 bg-cyan-50 border-cyan-100', perm: 'EMPLOYEE_VIEW_WORKFORCE' },
    { label: 'Reports', path: '/reports', icon: BarChart3, color: 'text-teal-600 bg-teal-50 border-teal-100', perm: 'REPORTS_WORKFORCE_VIEW' },
    { label: 'Audit Logs', path: '/audit-logs', icon: History, color: 'text-slate-600 bg-slate-100 border-slate-200', perm: 'AUDIT_LOG_VIEW' },
    { label: 'Admin Control', path: '/admin-control', icon: ShieldCheck, color: 'text-blue-700 bg-blue-100 border-blue-200', perm: 'USER_ROLE_ASSIGN' }
  ];

  const allowedTiles = appTiles.filter(t => !t.perm || hasPermission(role, t.perm));

  return (
    <div className="space-y-6">
      {/* ─── MOBILE + TABLET LAYOUT (< 1024px) - TeamNest Inspired App Launcher ─── */}
      <div className="lg:hidden space-y-6">
        {/* Mobile Summary KPI Metric Cards (Entire Card Clickable Navigation) */}
        <div className="grid grid-cols-2 gap-3">
          {/* 1. Total Active Employees -> /employees */}
          <button
            type="button"
            onClick={() => {
              console.log('[KPI CLICK] employees');
              navigate('/employees');
            }}
            className="p-4 bg-white border border-slate-200/80 hover:border-cyan-400 rounded-2xl flex flex-col justify-between cursor-pointer transition-all active:scale-95 text-left shadow-2xs group pointer-events-auto relative z-10"
            title="Navigate to Employees Directory"
          >
            <div className="flex items-center justify-between w-full pointer-events-none">
              <span className="text-[11px] font-bold text-slate-500 group-hover:text-cyan-600 truncate">Active Staff</span>
              <div className="p-2 bg-cyan-50 text-cyan-600 border border-cyan-100 rounded-lg group-hover:scale-105 transition-transform">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-extrabold text-slate-900 mt-2 pointer-events-none">{summary.totalEmployees ?? 0}</p>
          </button>

          {/* 2. Present Today -> /attendance */}
          <button
            type="button"
            onClick={() => {
              console.log('[KPI CLICK] attendance');
              navigate('/attendance');
            }}
            className="p-4 bg-white border border-slate-200/80 hover:border-emerald-400 rounded-2xl flex flex-col justify-between cursor-pointer transition-all active:scale-95 text-left shadow-2xs group pointer-events-auto relative z-10"
            title="Navigate to Attendance Module"
          >
            <div className="flex items-center justify-between w-full pointer-events-none">
              <span className="text-[11px] font-bold text-slate-500 group-hover:text-emerald-600 truncate">Present Today</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-extrabold text-emerald-600 mt-2 pointer-events-none">{summary.presentToday ?? 0}</p>
          </button>

          {/* 3. Pending Leave Requests -> /leave */}
          <button
            type="button"
            onClick={() => {
              console.log('[KPI CLICK] leave');
              navigate('/leave');
            }}
            className="p-4 bg-white border border-slate-200/80 hover:border-amber-400 rounded-2xl flex flex-col justify-between cursor-pointer transition-all active:scale-95 text-left shadow-2xs group pointer-events-auto relative z-10"
            title="Navigate to Leave Management"
          >
            <div className="flex items-center justify-between w-full pointer-events-none">
              <span className="text-[11px] font-bold text-slate-500 group-hover:text-amber-600 truncate">Pending Leave</span>
              <div className="p-2 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg group-hover:scale-105 transition-transform">
                <CalendarDays className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-extrabold text-amber-600 mt-2 pointer-events-none">{summary.pendingLeaves ?? 0}</p>
          </button>

          {/* 4. Pending Expense Claims -> /expenses */}
          <button
            type="button"
            onClick={() => {
              console.log('[KPI CLICK] expenses');
              navigate('/expenses');
            }}
            className="p-4 bg-white border border-slate-200/80 hover:border-indigo-400 rounded-2xl flex flex-col justify-between cursor-pointer transition-all active:scale-95 text-left shadow-2xs group pointer-events-auto relative z-10"
            title="Navigate to Expense Claims"
          >
            <div className="flex items-center justify-between w-full pointer-events-none">
              <span className="text-[11px] font-bold text-slate-500 group-hover:text-indigo-600 truncate">Pending Expense</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg group-hover:scale-105 transition-transform">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-extrabold text-indigo-600 mt-2 pointer-events-none">{summary.pendingExpenses ?? 0}</p>
          </button>
        </div>

        {/* App Launcher Grid */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {allowedTiles.map(tile => {
              const Icon = tile.icon;
              return (
                <button
                  key={tile.path}
                  type="button"
                  onClick={() => navigate(tile.path)}
                  className="flex flex-col items-center justify-center p-5 bg-white hover:bg-slate-50 border border-slate-100 rounded-xl shadow-2xs hover:shadow-sm transition-all text-center space-y-2 active:scale-95 group pointer-events-auto cursor-pointer"
                >
                  <div className={`p-3 rounded-xl border ${tile.color} group-hover:scale-105 transition-transform pointer-events-none`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800 tracking-tight pointer-events-none">{tile.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Attendance Status Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${todaySummary?.activeSession ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                {todaySummary?.activeSession ? 'Active Session Checked In' : 'No Active Session'}
              </p>
              <p className="text-[11px] text-slate-500 truncate max-w-[180px]">
                {todaySummary?.activeSession?.punch_in_location_name || 'Location coordinates active'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePunch}
            disabled={actionLoading}
            className={`px-3 py-2 rounded-xl text-xs font-bold shadow transition-all cursor-pointer ${
              todaySummary?.activeSession
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            {todaySummary?.activeSession ? 'Check Out' : 'Check In'}
          </button>
        </div>

        {/* TeamNest Celebrations Widget */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors pointer-events-auto" onClick={() => navigate('/holidays')}>
          <div className="flex items-center gap-3 pointer-events-none">
            <div className="p-3 bg-sky-50 text-sky-600 border border-sky-100 rounded-xl">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Birthdays / Work Anniversaries</h4>
              <p className="text-[11px] text-slate-500">View organization calendar & celebrations</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 pointer-events-none" />
        </div>
      </div>

      {/* ─── DESKTOP LAYOUT (>= 1024px) ─── */}
      <div className="hidden lg:block space-y-6">
        {/* Top Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 p-6 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">Welcome, {user?.email}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                {user?.role}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Today is <span className="text-slate-200 font-medium">{data?.todayDate}</span> — Theiakshi Enterprise HQ</p>
          </div>

          {user?.employeeId ? (
            <div className="flex items-center gap-3">
              {todaySummary?.activeSession ? (
                <button
                  type="button"
                  onClick={handlePunch}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Clock Out</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePunch}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Clock In Now</span>
                </button>
              )}
            </div>
          ) : (
            <div className="text-xs px-3 py-1.5 bg-amber-950/40 border border-amber-800/50 rounded-lg text-amber-300">
              Pure Admin Identity (No Employee Check-In Required)
            </div>
          )}
        </div>

        {/* Overview Summary Metrics Cards (Clickable Navigation for Entire Card Surface) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Active Employees -> /employees */}
          <button
            type="button"
            onClick={() => {
              console.log('[KPI CLICK] employees');
              navigate('/employees');
            }}
            className="p-5 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-850/80 rounded-2xl flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] text-left w-full group shadow-sm pointer-events-auto relative z-10"
            title="Navigate to Employees Directory"
          >
            <div className="pointer-events-none">
              <p className="text-xs text-slate-400 font-medium group-hover:text-cyan-400 transition-colors">Total Active Employees</p>
              <p className="text-2xl font-bold text-white mt-1">{summary.totalEmployees ?? 0}</p>
            </div>
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl group-hover:scale-105 transition-transform pointer-events-none">
              <Users className="w-6 h-6" />
            </div>
          </button>

          {/* 2. Present Today -> /attendance */}
          <button
            type="button"
            onClick={() => {
              console.log('[KPI CLICK] attendance');
              navigate('/attendance');
            }}
            className="p-5 bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850/80 rounded-2xl flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] text-left w-full group shadow-sm pointer-events-auto relative z-10"
            title="Navigate to Attendance Module"
          >
            <div className="pointer-events-none">
              <p className="text-xs text-slate-400 font-medium group-hover:text-emerald-400 transition-colors">Present Today</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.presentToday ?? 0}</p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl group-hover:scale-105 transition-transform pointer-events-none">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </button>

          {/* 3. Pending Leave Requests -> /leave */}
          <button
            type="button"
            onClick={() => {
              console.log('[KPI CLICK] leave');
              navigate('/leave');
            }}
            className="p-5 bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-850/80 rounded-2xl flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] text-left w-full group shadow-sm pointer-events-auto relative z-10"
            title="Navigate to Leave Management"
          >
            <div className="pointer-events-none">
              <p className="text-xs text-slate-400 font-medium group-hover:text-amber-400 transition-colors">Pending Leave Requests</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{summary.pendingLeaves ?? 0}</p>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-105 transition-transform pointer-events-none">
              <CalendarDays className="w-6 h-6" />
            </div>
          </button>

          {/* 4. Pending Expense Claims -> /expenses */}
          <button
            type="button"
            onClick={() => {
              console.log('[KPI CLICK] expenses');
              navigate('/expenses');
            }}
            className="p-5 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-850/80 rounded-2xl flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] text-left w-full group shadow-sm pointer-events-auto relative z-10"
            title="Navigate to Expense Claims"
          >
            <div className="pointer-events-none">
              <p className="text-xs text-slate-400 font-medium group-hover:text-indigo-400 transition-colors">Pending Expense Claims</p>
              <p className="text-2xl font-bold text-indigo-400 mt-1">{summary.pendingExpenses ?? 0}</p>
            </div>
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl group-hover:scale-105 transition-transform pointer-events-none">
              <Receipt className="w-6 h-6" />
            </div>
          </button>
        </div>

        {/* Grid Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold text-white">Recent Work Items</h3>
              </div>
            </div>

            <div className="space-y-3">
              {data?.latestWork?.length > 0 ? (
                data.latestWork.map((w: any) => (
                  <div key={w.id} className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-slate-100">{w.title}</h4>
                      <span className="text-[10px] font-mono text-cyan-400">{w.category}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono pt-1">Logged on {new Date(w.date).toLocaleDateString()}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 py-4 text-center">No recent work items logged.</p>
              )}
            </div>
          </div>

          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
              <CalendarDays className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-white">Upcoming Holidays</h3>
            </div>

            <div className="space-y-3">
              {data?.upcomingHolidays?.length > 0 ? (
                data.upcomingHolidays.map((h: any) => (
                  <div key={h.date} className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                    <div>
                      <p className="font-medium text-xs text-slate-200">{h.title}</p>
                      <span className="text-[10px] text-cyan-400 font-mono">{h.holiday_type}</span>
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-400">{h.date}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 py-4 text-center">No upcoming holidays scheduled.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
