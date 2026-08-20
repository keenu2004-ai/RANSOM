import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { Clock, LogIn, LogOut, CheckCircle, MapPin, Users, Calendar as CalendarIcon, Play, Square, Layers, Eye, X, Compass, Shield } from 'lucide-react';
import { SharedCalendar, CalendarEvent } from '../components/calendar/SharedCalendar';

interface SessionData {
  id: string;
  check_in: string;
  check_out: string | null;
  punch_in_lat: number | string | null;
  punch_in_lng: number | string | null;
  punch_in_accuracy: number | string | null;
  punch_in_location_name?: string | null;
  punch_out_lat: number | string | null;
  punch_out_lng: number | string | null;
  punch_out_accuracy: number | string | null;
  punch_out_location_name?: string | null;
  break_duration_mins: number;
  working_hours: number | string;
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

  // Detail Modal for Management Inspection
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  // Calendar Date State
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());

  const formatCoord = (val: any): string => {
    if (val === null || val === undefined || val === '') return 'N/A';
    const num = Number(val);
    return isNaN(num) ? 'N/A' : num.toFixed(4);
  };

  const formatAccuracy = (val: any): string => {
    if (val === null || val === undefined || val === '') return 'N/A';
    const num = Number(val);
    return isNaN(num) ? 'N/A' : `±${num.toFixed(1)}m`;
  };

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

      const res = await apiFetch('/calendar', { params: { startDate, endDate } }).catch(() => null);
      const rawEvents = res?.events || res?.data?.events || (Array.isArray(res) ? res : []);
      const events: CalendarEvent[] = (rawEvents || []).map((e: any) => ({
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
        const summaryData = todayRes?.summary || todayRes?.data?.summary;
        const attData = todayRes?.attendance || todayRes?.data?.attendance;

        if (summaryData) {
          setTodaySummary(summaryData);
        } else if (attData) {
          setTodaySummary({
            date: new Date().toISOString().split('T')[0],
            activeSession: attData.check_out ? null : attData,
            sessions: [attData],
            totalSessions: 1,
            totalWorkingHours: parseFloat(attData.working_hours || 0),
            totalBreakMins: attData.break_duration_mins || 0,
            firstCheckIn: attData.check_in,
            lastCheckOut: attData.check_out,
            status: attData.check_out ? 'COMPLETED' : 'ACTIVE'
          });
        }
      }

      if (['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '')) {
        const summaryRes = await apiFetch('/attendance/workforce-summary').catch(() => null);
        setWorkforceSummary(summaryRes?.summary || summaryRes?.data?.summary || summaryRes || null);

        const listRes = await apiFetch('/attendance').catch(() => null);
        setAttendanceList(listRes?.attendance || listRes?.data?.attendance || (Array.isArray(listRes) ? listRes : []));
      }
    } catch (err) {
      console.error('Error fetching attendance:', err);
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
                        <td className="px-4 py-3 text-[11px] text-slate-300">
                          {s.punch_in_location_name && <div className="font-semibold text-slate-200">{s.punch_in_location_name}</div>}
                          <div className="font-mono text-[10px] text-slate-400">
                            {formatCoord(s.punch_in_lat) !== 'N/A' ? `${formatCoord(s.punch_in_lat)}, ${formatCoord(s.punch_in_lng)} (${formatAccuracy(s.punch_in_accuracy)})` : 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-300">
                          {s.punch_out_location_name && <div className="font-semibold text-slate-200">{s.punch_out_location_name}</div>}
                          <div className="font-mono text-[10px] text-slate-400">
                            {formatCoord(s.punch_out_lat) !== 'N/A' ? `${formatCoord(s.punch_out_lat)}, ${formatCoord(s.punch_out_lng)} (${formatAccuracy(s.punch_out_accuracy)})` : 'N/A'}
                          </div>
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
              <p className="text-xl font-bold text-white mt-1">{workforceSummary.totalEmployees || 0}</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">Present Today</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">{workforceSummary.presentToday || 0}</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">On Approved Leave</p>
              <p className="text-xl font-bold text-amber-400 mt-1">{workforceSummary.onLeaveToday || 0}</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">Absent Today</p>
              <p className="text-xl font-bold text-rose-400 mt-1">{workforceSummary.absentToday || 0}</p>
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
                  <th className="px-6 py-3">Check-In GPS</th>
                  <th className="px-6 py-3">Check-Out GPS</th>
                  <th className="px-6 py-3">Hours</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {attendanceList.map(a => (
                  <tr key={a.id} className="hover:bg-slate-800/40">
                    <td className="px-6 py-3.5 font-semibold text-slate-200">{a.employee_name} ({a.employee_code})</td>
                    <td className="px-6 py-3.5 font-mono">{a.date}</td>
                    <td className="px-6 py-3.5 font-mono text-emerald-400">{a.check_in ? new Date(a.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                    <td className="px-6 py-3.5 font-mono text-rose-400">{a.check_out ? new Date(a.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-slate-400">
                      {formatCoord(a.punch_in_lat) !== 'N/A' && formatCoord(a.punch_in_lng) !== 'N/A'
                        ? `${formatCoord(a.punch_in_lat)}, ${formatCoord(a.punch_in_lng)}`
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-slate-400">
                      {formatCoord(a.punch_out_lat) !== 'N/A' && formatCoord(a.punch_out_lng) !== 'N/A'
                        ? `${formatCoord(a.punch_out_lat)}, ${formatCoord(a.punch_out_lng)}`
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-3.5 font-mono">{a.working_hours || 0} hrs</td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedSession(a)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>GPS Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SESSION GPS DETAILS INSPECTION MODAL */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-cyan-400" />
                <span>Session GPS Inspection</span>
              </h3>
              <button type="button" onClick={() => setSelectedSession(null)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-400">Employee: <strong className="text-white">{selectedSession.employee_name}</strong></div>
                <div className="text-slate-400">Date: <span className="font-mono text-cyan-400">{selectedSession.date}</span></div>
                <div className="text-slate-400">Working Hours: <strong className="text-emerald-400 font-mono">{selectedSession.working_hours || 0} hrs</strong></div>
              </div>

              {/* Check-In Location Box */}
              <div className="p-3.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl space-y-1.5">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  <span>Check-In GPS Location</span>
                </div>
                {selectedSession.punch_in_location_name && (
                  <div className="text-slate-200 font-semibold bg-emerald-950/50 p-2 rounded-lg border border-emerald-800/40">
                    {selectedSession.punch_in_location_name}
                  </div>
                )}
                <div className="text-slate-300">Timestamp: <span className="font-mono text-slate-200">{selectedSession.check_in ? new Date(selectedSession.check_in).toLocaleString() : 'N/A'}</span></div>
                <div className="text-slate-300">Latitude: <span className="font-mono text-cyan-400">{selectedSession.punch_in_lat || 'N/A'}</span></div>
                <div className="text-slate-300">Longitude: <span className="font-mono text-cyan-400">{selectedSession.punch_in_lng || 'N/A'}</span></div>
                <div className="text-slate-300">Accuracy: <span className="font-mono text-slate-400">{formatAccuracy(selectedSession.punch_in_accuracy)}</span></div>
              </div>

              {/* Check-Out Location Box */}
              <div className="p-3.5 bg-rose-950/30 border border-rose-800/40 rounded-xl space-y-1.5">
                <div className="font-bold text-rose-400 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  <span>Check-Out GPS Location</span>
                </div>
                {selectedSession.punch_out_location_name && (
                  <div className="text-slate-200 font-semibold bg-rose-950/50 p-2 rounded-lg border border-rose-800/40">
                    {selectedSession.punch_out_location_name}
                  </div>
                )}
                <div className="text-slate-300">Timestamp: <span className="font-mono text-slate-200">{selectedSession.check_out ? new Date(selectedSession.check_out).toLocaleString() : 'N/A'}</span></div>
                <div className="text-slate-300">Latitude: <span className="font-mono text-cyan-400">{selectedSession.punch_out_lat || 'N/A'}</span></div>
                <div className="text-slate-300">Longitude: <span className="font-mono text-cyan-400">{selectedSession.punch_out_lng || 'N/A'}</span></div>
                <div className="text-slate-300">Accuracy: <span className="font-mono text-slate-400">{formatAccuracy(selectedSession.punch_out_accuracy)}</span></div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button type="button" onClick={() => setSelectedSession(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
