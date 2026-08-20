import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { Clock, LogIn, LogOut, CheckCircle, MapPin, Users, Calendar as CalendarIcon, Play, Square, Layers } from 'lucide-react';
import { SharedCalendar, CalendarEvent } from '../components/calendar/SharedCalendar';

interface SessionData {
  id: string;
  check_in: string;
  check_out: string | null;
  punch_in_lat: number | null;
  punch_in_lng: number | null;
  punch_in_accuracy: number | null;
  punch_out_lat: number | null;
  punch_out_lng: number | null;
  punch_out_accuracy: number | null;
  break_duration_mins: number;
  working_hours: number;
  status: string;
}

interface TodaySummary {
  date: string;
  activeSession: SessionData | null;
  sessions: SessionData[];
  totalSessions: number;
  totalWorkingHours: number;
  totalBreakMins: number;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  status: string;
}

export const Attendance: React.FC = () => {
  const { user } = useAuth();
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [workforceSummary, setWorkforceSummary] = useState<any>(null);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Calendar Date State
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());

  const getGPSLocation = (): Promise<{ latitude?: number; longitude?: number; accuracy?: number }> => {
    setGpsError(null);
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGpsError('Browser geolocation is not supported.');
        resolve({});
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        },
        (err) => {
          let msg = 'Location request failed.';
          if (err.code === err.PERMISSION_DENIED) msg = 'Location permission denied.';
          else if (err.code === err.POSITION_UNAVAILABLE) msg = 'Location unavailable.';
          else if (err.code === err.TIMEOUT) msg = 'Location request timed out.';
          setGpsError(msg);
          resolve({});
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

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
        if (todayRes?.summary) {
          setTodaySummary(todayRes.summary);
        } else if (todayRes?.attendance) {
          setTodaySummary({
            date: new Date().toISOString().split('T')[0],
            activeSession: todayRes.attendance.check_out ? null : todayRes.attendance,
            sessions: [todayRes.attendance],
            totalSessions: 1,
            totalWorkingHours: parseFloat(todayRes.attendance.working_hours || 0),
            totalBreakMins: todayRes.attendance.break_duration_mins || 0,
            firstCheckIn: todayRes.attendance.check_in,
            lastCheckOut: todayRes.attendance.check_out,
            status: todayRes.attendance.check_out ? 'COMPLETED' : 'ACTIVE'
          });
        }
      }

      if (['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '')) {
        const summaryRes = await apiFetch('/attendance/workforce-summary');
        setWorkforceSummary(summaryRes.summary);

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
      const gps = await getGPSLocation();
      await apiFetch('/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify(gps)
      });
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
      const gps = await getGPSLocation();
      await apiFetch('/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify(gps)
      });
      await fetchAttendance();
      await fetchCalendarEvents(currentYear, currentMonth);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const activeSession = todaySummary?.activeSession;
  const sessions = todaySummary?.sessions || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-cyan-400" />
            <span>Multi-Session GPS Attendance & Calendar</span>
          </h1>
          <p className="text-xs text-slate-400">Unlimited work sessions per day with precision GPS location tracking</p>
        </div>
      </div>

      {gpsError && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-xl flex items-center gap-2">
          <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Employee Personal Attendance Section */}
      {user?.employeeId && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-slate-200">Today's Attendance Control</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeSession 
                  ? 'You have an active session in progress.' 
                  : sessions.length > 0 
                  ? `Completed ${sessions.length} session(s) today. Ready for next session.` 
                  : 'No active session. Click Check In to start.'}
              </p>
            </div>

            <div>
              {activeSession ? (
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center gap-2"
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>Check Out Active Session</span>
                </button>
              ) : (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start New Session (Check In)</span>
                </button>
              )}
            </div>
          </div>

          {/* Daily Aggregate Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <p className="text-[11px] text-slate-400">Total Sessions</p>
              <p className="text-lg font-bold text-cyan-400 mt-0.5">{todaySummary?.totalSessions || 0}</p>
            </div>
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <p className="text-[11px] text-slate-400">Total Work Hours</p>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">{todaySummary?.totalWorkingHours || 0} hrs</p>
            </div>
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <p className="text-[11px] text-slate-400">First Check-In</p>
              <p className="text-sm font-mono font-semibold text-slate-200 mt-1">
                {todaySummary?.firstCheckIn ? new Date(todaySummary.firstCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </p>
            </div>
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <p className="text-[11px] text-slate-400">Last Check-Out</p>
              <p className="text-sm font-mono font-semibold text-slate-200 mt-1">
                {todaySummary?.lastCheckOut ? new Date(todaySummary.lastCheckOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </p>
            </div>
          </div>

          {/* Detailed Sessions Table for Today */}
          {sessions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Today's Work Sessions Log ({sessions.length})</span>
              </h4>
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5">Session</th>
                      <th className="px-4 py-2.5">Check In</th>
                      <th className="px-4 py-2.5">Check Out</th>
                      <th className="px-4 py-2.5">Check-In GPS</th>
                      <th className="px-4 py-2.5">Check-Out GPS</th>
                      <th className="px-4 py-2.5">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {sessions.map((s, idx) => (
                      <tr key={s.id || idx} className={s.check_out ? 'hover:bg-slate-800/30' : 'bg-cyan-950/20 border-l-2 border-l-cyan-400'}>
                        <td className="px-4 py-3 font-semibold text-slate-200">Session #{idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-emerald-400">
                          {new Date(s.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 font-mono text-rose-400">
                          {s.check_out ? new Date(s.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (
                            <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded text-[10px] font-bold">IN PROGRESS</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                          {s.punch_in_lat && s.punch_in_lng ? `${s.punch_in_lat.toFixed(4)}, ${s.punch_in_lng.toFixed(4)}` : 'N/A'}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                          {s.punch_out_lat && s.punch_out_lng ? `${s.punch_out_lat.toFixed(4)}, ${s.punch_out_lng.toFixed(4)}` : 'N/A'}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-200">
                          {s.working_hours ? `${s.working_hours} hrs` : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Workforce Summary for Admin/HR */}
      {workforceSummary && (
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-slate-200">Daily Workforce Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">Total Workforce</p>
              <p className="text-xl font-bold text-white mt-1">{workforceSummary.totalEmployees}</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">Present Today</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">{workforceSummary.presentToday}</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">On Approved Leave</p>
              <p className="text-xl font-bold text-amber-400 mt-1">{workforceSummary.onLeaveToday}</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">Absent Today</p>
              <p className="text-xl font-bold text-rose-400 mt-1">{workforceSummary.absentToday}</p>
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
        subtitle="Visualizing daily attendance check-ins, multi-sessions, leave requests, company holidays, and planned tasks"
      />

      {/* Workforce Attendance Log Table */}
      {attendanceList.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-2">
          <div className="px-6 py-4 border-b border-slate-800 font-semibold text-xs text-slate-300">
            Workforce Attendance Sessions Log
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Check In</th>
                  <th className="px-6 py-3">Check Out</th>
                  <th className="px-6 py-3">GPS Location</th>
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
                    <td className="px-6 py-3.5 font-mono text-rose-400">{a.check_out ? new Date(a.check_out).toLocaleTimeString() : '--'}</td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-slate-400">
                      {a.punch_in_lat && a.punch_in_lng ? `${a.punch_in_lat.toFixed(4)}, ${a.punch_in_lng.toFixed(4)}` : 'N/A'}
                    </td>
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
