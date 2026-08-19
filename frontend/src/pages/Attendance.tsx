import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { Clock, LogIn, LogOut, CheckCircle, MapPin, Users, Calendar as CalendarIcon } from 'lucide-react';
import { SharedCalendar, CalendarEvent } from '../components/calendar/SharedCalendar';

export const Attendance: React.FC = () => {
  const { user } = useAuth();
  const [today, setToday] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Calendar Date State
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());

  const fetchCalendarEvents = useCallback(async (year: number, month: number) => {
    try {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const res = await apiFetch('/calendar', { params: { startDate, endDate } }).catch(() => ({ data: { events: [] } }));
      const events: CalendarEvent[] = (res.data?.events || res.events || []).map((e: any) => ({
        id: e.id,
        date: e.date,
        type: e.type,
        title: e.title,
        status: e.status,
        employeeName: e.employeeName,
        metadata: e.metadata || {}
      }));

      setCalendarEvents(events);
    } catch (err) {
      console.error('Error loading calendar events:', err);
    }
  }, []);

  const fetchAttendance = async () => {
    try {
      if (user?.employeeId) {
        const todayRes = await apiFetch('/attendance/today').catch(() => null);
        setToday(todayRes?.attendance || null);
      }

      if (['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '')) {
        const summaryRes = await apiFetch('/attendance/workforce-summary');
        setSummary(summaryRes.summary);

        const listRes = await apiFetch('/attendance');
        setAttendanceList(listRes.attendance || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
    fetchCalendarEvents(currentYear, currentMonth);
  }, [currentYear, currentMonth, fetchCalendarEvents]);

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      await apiFetch('/attendance/check-in', { method: 'POST' });
      await fetchAttendance();
      await fetchCalendarEvents(currentYear, currentMonth);
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
      await fetchAttendance();
      await fetchCalendarEvents(currentYear, currentMonth);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-cyan-400" />
            <span>Attendance & Unified Calendar</span>
          </h1>
          <p className="text-xs text-slate-400">Track check-ins, check-outs, workforce summaries, and monthly attendance calendars</p>
        </div>
      </div>

      {/* Employee Personal Attendance Section */}
      {user?.employeeId && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <h3 className="font-bold text-sm text-slate-200">Today's Attendance Status</h3>
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Status: <span className="font-semibold text-slate-200">{today?.status || 'NOT_CHECKED_IN'}</span></p>
                <p className="text-xs text-slate-400">Check-in: <span className="font-mono text-cyan-400 font-semibold">{today?.check_in ? new Date(today.check_in).toLocaleTimeString() : '--:--'}</span></p>
                <p className="text-xs text-slate-400">Check-out: <span className="font-mono text-cyan-400 font-semibold">{today?.check_out ? new Date(today.check_out).toLocaleTimeString() : '--:--'}</span></p>
              </div>
            </div>

            <div>
              {today?.check_in && !today?.check_out ? (
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Check Out Now</span>
                </button>
              ) : (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading || !!today?.check_out}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{today?.check_out ? 'Workday Completed' : 'Check In Now'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Workforce Summary for Admin/HR */}
      {summary && (
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-slate-200">Daily Workforce Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">Total Workforce</p>
              <p className="text-xl font-bold text-white mt-1">{summary.totalEmployees}</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">Present Today</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">{summary.presentToday}</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">On Approved Leave</p>
              <p className="text-xl font-bold text-amber-400 mt-1">{summary.onLeaveToday}</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">Absent Today</p>
              <p className="text-xl font-bold text-rose-400 mt-1">{summary.absentToday}</p>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Unified Calendar View */}
      <SharedCalendar
        events={calendarEvents}
        initialYear={currentYear}
        initialMonth={currentMonth}
        onMonthChange={(y, m) => {
          setCurrentYear(y);
          setCurrentMonth(m);
        }}
        title="Attendance & Organizational Calendar"
        subtitle="Visualizing daily attendance check-ins, leave requests, company holidays, and planned tasks"
      />

      {/* Workforce Attendance Log Table */}
      {attendanceList.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-2">
          <div className="px-6 py-4 border-b border-slate-800 font-semibold text-xs text-slate-300">
            Recent Attendance Log Records
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Check In</th>
                  <th className="px-6 py-3">Check Out</th>
                  <th className="px-6 py-3">Hours</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {attendanceList.map(a => (
                  <tr key={a.id} className="hover:bg-slate-800/40">
                    <td className="px-6 py-3.5 font-semibold text-slate-200">{a.employee_name} ({a.employee_code})</td>
                    <td className="px-6 py-3.5 font-mono">{a.date}</td>
                    <td className="px-6 py-3.5 font-mono text-emerald-400">{a.check_in ? new Date(a.check_in).toLocaleTimeString() : '--'}</td>
                    <td className="px-6 py-3.5 font-mono text-cyan-400">{a.check_out ? new Date(a.check_out).toLocaleTimeString() : '--'}</td>
                    <td className="px-6 py-3.5 font-mono">{a.working_hours || 0} hrs</td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
