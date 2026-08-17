import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { 
  Users, CheckCircle2, Clock, CalendarDays, Receipt, 
  Sparkles, ShieldCheck, ArrowUpRight, LogIn, LogOut
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      await apiFetch('/attendance/check-in', { method: 'POST' });
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      await apiFetch('/attendance/check-out', { method: 'POST' });
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading Dashboard Data...</div>;
  }

  const summary = data?.summary || {};
  const personal = data?.personal || null;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Welcome, {user?.email}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              {user?.role}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Today is <span className="text-slate-200 font-medium">{data?.todayDate}</span> — Theiakshi Enterprise HQ</p>
        </div>

        {/* Personal Attendance Action Bar if linked employee */}
        {user?.employeeId ? (
          <div className="flex items-center gap-3">
            {personal?.todayAttendance?.check_in && !personal?.todayAttendance?.check_out ? (
              <button
                onClick={handleCheckOut}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Clock Out</span>
              </button>
            ) : (
              <button
                onClick={handleCheckIn}
                disabled={actionLoading || !!personal?.todayAttendance?.check_out}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{personal?.todayAttendance?.check_out ? 'Clocked Out Today' : 'Clock In Now'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="text-xs px-3 py-1.5 bg-amber-950/40 border border-amber-800/50 rounded-lg text-amber-300">
            Pure Admin Identity (No Employee Check-In Required)
          </div>
        )}
      </div>

      {/* Admin / Overview Summary Metrics Cards */}
      {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(user?.role || '') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Active Employees</p>
              <p className="text-2xl font-bold text-white mt-1">{summary.totalEmployees ?? 0}</p>
            </div>
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Present Today</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.presentToday ?? 0}</p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Pending Leave Requests</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{summary.pendingLeaves ?? 0}</p>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
              <CalendarDays className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Pending Expense Claims</p>
              <p className="text-2xl font-bold text-indigo-400 mt-1">{summary.pendingExpenses ?? 0}</p>
            </div>
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Receipt className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Work Items */}
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

        {/* Upcoming Holidays */}
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
  );
};
