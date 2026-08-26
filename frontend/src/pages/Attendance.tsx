import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { useAttendance } from '../context/AttendanceContext';
import { Clock, LogIn, LogOut, CheckCircle, MapPin, Users, Calendar as CalendarIcon, Play, Square, Layers, Eye, X, Compass, Shield, Loader2 } from 'lucide-react';
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
  totalSessionCount?: number;
  completedSessionCount?: number;
  canCheckIn?: boolean;
  canCheckOut?: boolean;
  totalWorkingHours: number;
  totalBreakMins: number;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  status: string;
  leave?: any;
  holiday?: any;
  pendingRegularization?: any;
}

export const Attendance: React.FC = () => {
  const { user } = useAuth();
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [workforceSummary, setWorkforceSummary] = useState<any>(null);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [regularizations, setRegularizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [attFetchError, setAttFetchError] = useState<string | null>(null);

  // Regularization Modal & Form State
  const [showRegularizeModal, setShowRegularizeModal] = useState(false);
  const [regFormData, setRegFormData] = useState({
    attendanceDate: new Date().toISOString().split('T')[0],
    requestedPunchIn: '',
    requestedPunchOut: '',
    attendanceType: 'PRESENT',
    reason: ''
  });
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

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

  const { refreshAttendance: contextRefresh } = useAttendance();

  const fetchAttendance = async () => {
    setAttFetchError(null);
    try {
      if (user?.employeeId) {
        const todayRes = await apiFetch('/attendance/today').catch((err) => {
          throw new Error(err.message || 'Unable to load attendance status.');
        });
        const summaryData = todayRes?.summary || todayRes?.data?.summary;
        const attData = todayRes?.attendance || todayRes?.data?.attendance;
        const activeSess = todayRes?.activeSession || todayRes?.data?.activeSession || summaryData?.activeSession;

        if (summaryData) {
          setTodaySummary({
            ...summaryData,
            activeSession: activeSess || summaryData.activeSession || null
          });
        } else if (attData) {
          setTodaySummary({
            date: new Date().toISOString().split('T')[0],
            activeSession: attData.check_out ? null : attData,
            sessions: [attData],
            totalSessions: 1,
            totalSessionCount: 1,
            completedSessionCount: attData.check_out ? 1 : 0,
            canCheckIn: !!attData.check_out,
            canCheckOut: !attData.check_out,
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

      const regRes = await apiFetch('/attendance/regularizations').catch(() => null);
      setRegularizations(regRes?.regularizations || regRes?.data?.regularizations || (Array.isArray(regRes) ? regRes : []));

      if (contextRefresh) {
        await contextRefresh().catch(() => null);
      }
    } catch (err: any) {
      console.error('Error fetching attendance:', err);
      setAttFetchError(err.message || 'Unable to load attendance information.');
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
      if (err.code === 'ACTIVE_SESSION_EXISTS' || err.message?.includes('active attendance session') || err.message?.includes('active check-in session')) {
        await fetchAttendance();
      } else {
        alert(err.message || 'Check-in failed.');
      }
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
      alert(err.message || 'Check-out failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegularizationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);
    try {
      if (!regFormData.reason || regFormData.reason.trim() === '') {
        setRegError('Reason is mandatory for regularization.');
        return;
      }

      const reqIn = regFormData.requestedPunchIn ? `${regFormData.attendanceDate}T${regFormData.requestedPunchIn}:00` : null;
      const reqOut = regFormData.requestedPunchOut ? `${regFormData.attendanceDate}T${regFormData.requestedPunchOut}:00` : null;

      await apiFetch('/attendance/regularize', {
        method: 'POST',
        body: JSON.stringify({
          attendanceDate: regFormData.attendanceDate,
          requestedPunchIn: reqIn,
          requestedPunchOut: reqOut,
          attendanceType: regFormData.attendanceType,
          reason: regFormData.reason.trim()
        })
      });

      setRegSuccess('Attendance regularization request submitted successfully.');
      setShowRegularizeModal(false);
      setRegFormData({
        attendanceDate: new Date().toISOString().split('T')[0],
        requestedPunchIn: '',
        requestedPunchOut: '',
        attendanceType: 'PRESENT',
        reason: ''
      });
      setTimeout(() => setRegSuccess(null), 4000);
      await fetchAttendance();
    } catch (err: any) {
      setRegError(err.message || 'Failed to submit regularization request.');
    }
  };

  const handleApproveReg = async (id: string) => {
    try {
      await apiFetch(`/attendance/regularizations/${id}/process`, {
        method: 'POST',
        body: JSON.stringify({ action: 'APPROVE' })
      });
      await fetchAttendance();
    } catch (err: any) {
      alert(err.message || 'Failed to approve regularization.');
    }
  };

  const handleRejectReg = async (id: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (reason === null) return;
    try {
      await apiFetch(`/attendance/regularizations/${id}/process`, {
        method: 'POST',
        body: JSON.stringify({ action: 'REJECT', rejectionReason: reason })
      });
      await fetchAttendance();
    } catch (err: any) {
      alert(err.message || 'Failed to reject regularization.');
    }
  };

  const activeSession = todaySummary?.activeSession;
  const sessions = todaySummary?.sessions || [];

  return (
    <div className="space-y-6">
      {attFetchError && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{attFetchError}</span>
          </div>
          <button
            onClick={fetchAttendance}
            className="px-3 py-1 bg-rose-900/60 hover:bg-rose-800 text-rose-100 rounded-lg text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {regSuccess && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-2xl flex items-center gap-2 shadow-lg">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold">{regSuccess}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-cyan-400" />
            <span>Attendance & Regularization Portal</span>
          </h1>
          <p className="text-xs text-slate-400">Daily attendance check-ins, calendar-day session control, and attendance regularization</p>
        </div>

        {user?.employeeId && (
          <button
            onClick={() => setShowRegularizeModal(true)}
            className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-semibold text-xs rounded-xl shadow flex items-center gap-2"
          >
            <CalendarIcon className="w-4 h-4 text-indigo-400" />
            <span>Regularize Attendance</span>
          </button>
        )}
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
          {todaySummary?.leave && (
            <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-200 text-xs space-y-1">
              <div className="font-bold flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-amber-400" />
                <span>On Approved Leave Today ({todaySummary.leave.leave_type_name})</span>
              </div>
              <p className="text-[11px] text-amber-300/80">No check-in required for approved leave days.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-slate-200">Today's Attendance Control</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeSession 
                  ? `Session #${sessions.findIndex((s: any) => s.id === activeSession.id) + 1 || 1} in progress. Started at ${activeSession.check_in ? new Date(activeSession.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}.` 
                  : (todaySummary?.completedSessionCount || 0) > 0 
                  ? `Completed ${todaySummary?.completedSessionCount} session(s) today. Ready for next session.` 
                  : 'No active session. Click Check In to start.'}
              </p>
            </div>

            <div>
              {activeSession ? (
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Checking Out...</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4 fill-white" />
                      <span>Check Out Active Session</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading || todaySummary?.canCheckIn === false}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Checking In...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Start New Session (Check In)</span>
                    </>
                  )}
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

      {/* Attendance Regularization Requests Queue / History Table */}
      {regularizations.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-2">
          <div className="px-6 py-4 border-b border-slate-800 font-semibold text-xs text-slate-100 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-indigo-400" />
              <span>{['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '') ? 'Attendance Regularization Requests Queue' : 'My Regularization Requests History'}</span>
            </span>
            <span className="px-2 py-0.5 text-xs bg-slate-800 text-indigo-400 rounded-full font-mono font-semibold">
              {regularizations.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Original In / Out</th>
                  <th className="px-6 py-3">Requested In / Out</th>
                  <th className="px-6 py-3">Reason</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {regularizations.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40">
                    <td className="px-6 py-3.5 font-semibold text-slate-200">
                      {r.employee_name}
                      <span className="block text-[10px] text-slate-500 font-mono">{r.employee_code || 'EMP'}</span>
                    </td>
                    <td className="px-6 py-3.5 font-mono">{r.attendance_date ? new Date(r.attendance_date).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-6 py-3.5 font-mono text-indigo-300 font-semibold">{r.attendance_type || 'PRESENT'}</td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-slate-400">
                      <div>In: {r.original_in_time ? new Date(r.original_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not Recorded'}</div>
                      <div>Out: {r.original_out_time ? new Date(r.original_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not Recorded'}</div>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-cyan-300">
                      <div>In: {r.requested_punch_in ? new Date(r.requested_punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</div>
                      <div>Out: {r.requested_punch_out ? new Date(r.requested_punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</div>
                    </td>
                    <td className="px-6 py-3.5 max-w-xs truncate text-slate-400" title={r.reason}>{r.reason}</td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                        r.status === 'APPROVED' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' :
                        r.status === 'REJECTED' ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60' :
                        'bg-amber-950/80 text-amber-400 border border-amber-800/60 animate-pulse'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '') && r.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApproveReg(r.id)}
                            className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-semibold transition-all"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectReg(r.id)}
                            className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 rounded-lg text-[11px] font-semibold transition-all"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono">--</span>
                      )}
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

      {/* ATTENDANCE REGULARIZATION FORM MODAL */}
      {showRegularizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-400" />
                <span>Attendance Regularization Request</span>
              </h3>
              <button type="button" onClick={() => setShowRegularizeModal(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {regError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            <form onSubmit={handleRegularizationSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Date Being Regularized *</label>
                <input
                  type="date"
                  required
                  value={regFormData.attendanceDate}
                  onChange={(e) => setRegFormData(f => ({ ...f, attendanceDate: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Attendance Type *</label>
                <select
                  value={regFormData.attendanceType}
                  onChange={(e) => setRegFormData(f => ({ ...f, attendanceType: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                >
                  <option value="PRESENT">Present</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="FIELD_VISIT">Field Visit</option>
                  <option value="ON_DUTY">On Duty</option>
                  <option value="WORK_FROM_HOME">Work From Home</option>
                  <option value="WEEKLY_OFF">Weekly Off</option>
                  <option value="HOLIDAY">Holiday</option>
                  <option value="ABSENT">Absent</option>
                </select>
              </div>

              {['PRESENT', 'HALF_DAY', 'FIELD_VISIT', 'ON_DUTY', 'WORK_FROM_HOME'].includes(regFormData.attendanceType) ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Requested In Time</label>
                    <input
                      type="time"
                      value={regFormData.requestedPunchIn}
                      onChange={(e) => setRegFormData(f => ({ ...f, requestedPunchIn: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Requested Out Time</label>
                    <input
                      type="time"
                      value={regFormData.requestedPunchOut}
                      onChange={(e) => setRegFormData(f => ({ ...f, requestedPunchOut: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 font-medium text-center">
                  Times Not Applicable for {regFormData.attendanceType}
                </div>
              )}

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={regFormData.reason}
                  onChange={(e) => setRegFormData(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Provide a clear, detailed justification (e.g. Forgot to sign out after customer visit)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRegularizeModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
