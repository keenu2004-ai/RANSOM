import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch, apiDownload } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { useAttendance } from '../context/AttendanceContext';
import {
  Clock, CheckCircle, MapPin, Calendar as CalendarIcon, Play, Square, Layers, Eye, X,
  Compass, Shield, Loader2, Download, AlertCircle, ChevronDown, ChevronRight, Search,
  Filter, Users, UserCheck, UserX, CalendarDays, RefreshCw
} from 'lucide-react';
import { SharedCalendar, CalendarEvent } from '../components/calendar/SharedCalendar';

const formatWorkingHours = (decimalHours: number | string | null | undefined): string => {
  const value = Number(decimalHours || 0);
  if (!Number.isFinite(value) || value <= 0) return '0h 00m';
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
};

export type DatePreset = 'LAST_7_DAYS' | 'LAST_14_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'PREV_MONTH' | 'CUSTOM';

const getDateRangeForPreset = (preset: DatePreset, customStart?: string, customEnd?: string): { startDate: string; endDate: string } => {
  const now = new Date();
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (preset === 'LAST_7_DAYS') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { startDate: formatYMD(start), endDate: formatYMD(now) };
  }
  if (preset === 'LAST_14_DAYS') {
    const start = new Date(now);
    start.setDate(start.getDate() - 13);
    return { startDate: formatYMD(start), endDate: formatYMD(now) };
  }
  if (preset === 'LAST_30_DAYS') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { startDate: formatYMD(start), endDate: formatYMD(now) };
  }
  if (preset === 'THIS_MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: formatYMD(start), endDate: formatYMD(end) };
  }
  if (preset === 'PREV_MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: formatYMD(start), endDate: formatYMD(end) };
  }
  return {
    startDate: customStart || formatYMD(now),
    endDate: customEnd || formatYMD(now)
  };
};

interface EmployeeSummaryItem {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: string;
  departmentId?: string;
  departmentName: string;
  sessionCount: number;
  totalHours: number;
  presentDays: number;
  latestAttendanceDate?: string | null;
  latestCheckIn?: string | null;
  latestStatus?: string | null;
}

interface EmployeeDetailState {
  records: any[];
  page: number;
  totalPages: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error?: string;
  totalWorkingHours?: number;
  presentDays?: number;
}

export const Attendance: React.FC = () => {
  const { user } = useAuth();
  const isManagerOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '');

  const {
    todaySummary,
    activeSession,
    actionLoading,
    checkIn: contextCheckIn,
    checkOut: contextCheckOut,
    refreshAttendance: contextRefresh
  } = useAttendance();

  // Workforce KPI Summary
  const [workforceKpi, setWorkforceKpi] = useState<any>(null);

  // Workforce Date Range Preset State (Defaults to LAST_7_DAYS)
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('LAST_7_DAYS');
  const [customStartDate, setCustomStartDate] = useState<string>(() => getDateRangeForPreset('LAST_7_DAYS').startDate);
  const [customEndDate, setCustomEndDate] = useState<string>(() => getDateRangeForPreset('LAST_7_DAYS').endDate);

  const activeDateRange = useMemo(() => {
    return getDateRangeForPreset(selectedPreset, customStartDate, customEndDate);
  }, [selectedPreset, customStartDate, customEndDate]);

  // Workforce Employee Summaries
  const [workforceEmployees, setWorkforceEmployees] = useState<EmployeeSummaryItem[]>([]);
  const [loadingWorkforce, setLoadingWorkforce] = useState<boolean>(false);
  const [workforceError, setWorkforceError] = useState<string | null>(null);

  // Local Search & Filtering
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Single Expansion Accordion State
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);
  const [empDetailsMap, setEmpDetailsMap] = useState<Record<string, EmployeeDetailState>>({});

  // Regularization & Calendar State
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [regularizations, setRegularizations] = useState<any[]>([]);
  const [attFetchError, setAttFetchError] = useState<string | null>(null);

  // Regularization Modal State
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

  // GPS Modal State
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  // Calendar Month State
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

  // 1. Fetch Calendar Events for month
  const fetchCalendarEvents = useCallback(async (year: number, month: number) => {
    try {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const res = await apiFetch('/calendar', { params: { startDate, endDate } }).catch(() => null);
      const rawEvents = res?.events || res?.data?.events || (Array.isArray(res) ? res : []);
      const events: CalendarEvent[] = (rawEvents || [])
        .filter((e: any) => e.type === 'ATTENDANCE' || e.type === 'HOLIDAY')
        .map((e: any) => ({
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

  // 2. Fetch Workforce Employee Summaries
  const fetchWorkforceSummaries = useCallback(async () => {
    if (!isManagerOrAdmin) return;
    setLoadingWorkforce(true);
    setWorkforceError(null);

    try {
      const [summaryRes, kpiRes] = await Promise.all([
        apiFetch('/attendance/workforce-employees', {
          params: {
            startDate: activeDateRange.startDate,
            endDate: activeDateRange.endDate
          }
        }),
        apiFetch('/attendance/workforce-summary')
      ]);

      setWorkforceEmployees(summaryRes?.employees || summaryRes?.data?.employees || []);
      setWorkforceKpi(kpiRes?.summary || kpiRes?.data?.summary || null);
    } catch (err: any) {
      console.error('Failed to load workforce attendance summaries:', err);
      setWorkforceError(err.message || 'Failed to load employee attendance summaries.');
    } finally {
      setLoadingWorkforce(false);
    }
  }, [isManagerOrAdmin, activeDateRange]);

  // 3. Fetch Regularizations
  const fetchRegularizations = useCallback(async () => {
    try {
      const regRes = await apiFetch('/attendance/regularizations').catch(() => null);
      setRegularizations(regRes?.regularizations || regRes?.data?.regularizations || (Array.isArray(regRes) ? regRes : []));
    } catch (err) {
      console.error('Error fetching regularizations:', err);
    }
  }, []);

  // Initial and range change triggers
  useEffect(() => {
    fetchWorkforceSummaries();
    fetchRegularizations();
    fetchCalendarEvents(currentYear, currentMonth);
  }, [fetchWorkforceSummaries, fetchRegularizations, fetchCalendarEvents, currentYear, currentMonth]);

  // When date range changes, invalidate expanded employee details cache & reset active expansion
  useEffect(() => {
    setEmpDetailsMap({});
    setExpandedEmpId(null);
  }, [activeDateRange.startDate, activeDateRange.endDate]);

  // 4. Fetch Detailed Attendance for a Single Employee (Lazy-loaded, Newest First, Paginated)
  const fetchEmployeeDetails = useCallback(async (empId: string, page: number = 1, append: boolean = false) => {
    setEmpDetailsMap(prev => ({
      ...prev,
      [empId]: {
        records: append ? (prev[empId]?.records || []) : [],
        page,
        totalPages: prev[empId]?.totalPages || 1,
        hasMore: prev[empId]?.hasMore ?? false,
        loading: !append,
        loadingMore: append,
        totalWorkingHours: prev[empId]?.totalWorkingHours,
        presentDays: prev[empId]?.presentDays
      }
    }));

    try {
      const res = await apiFetch(`/attendance/employee/${empId}`, {
        params: {
          startDate: activeDateRange.startDate,
          endDate: activeDateRange.endDate,
          page,
          limit: 30
        }
      });

      const newRecords = res?.records || res?.data?.records || [];
      const pagination = res?.pagination || res?.data?.pagination || { page: 1, totalPages: 1, hasMore: false };

      setEmpDetailsMap(prev => ({
        ...prev,
        [empId]: {
          records: append ? [...(prev[empId]?.records || []), ...newRecords] : newRecords,
          page: pagination.page || page,
          totalPages: pagination.totalPages || 1,
          hasMore: pagination.hasMore ?? false,
          loading: false,
          loadingMore: false,
          totalWorkingHours: res?.totalWorkingHours ?? prev[empId]?.totalWorkingHours,
          presentDays: res?.presentDays ?? prev[empId]?.presentDays
        }
      }));
    } catch (err: any) {
      console.error(`Failed to load attendance details for employee ${empId}:`, err);
      setEmpDetailsMap(prev => ({
        ...prev,
        [empId]: {
          ...(prev[empId] || { records: [], page: 1, totalPages: 1, hasMore: false }),
          loading: false,
          loadingMore: false,
          error: err.message || 'Failed to load attendance records.'
        }
      }));
    }
  }, [activeDateRange]);

  // Toggle Employee Expansion (Single expansion by default)
  const toggleEmployeeExpansion = (empId: string) => {
    if (expandedEmpId === empId) {
      setExpandedEmpId(null);
    } else {
      setExpandedEmpId(empId);
      if (!empDetailsMap[empId] || empDetailsMap[empId].records.length === 0) {
        fetchEmployeeDetails(empId, 1, false);
      }
    }
  };

  // Today's Live Actions
  const handleCheckIn = async () => {
    await contextCheckIn();
    fetchWorkforceSummaries();
    if (contextRefresh) await contextRefresh().catch(() => null);
    fetchCalendarEvents(currentYear, currentMonth);
  };

  const handleCheckOut = async () => {
    await contextCheckOut();
    fetchWorkforceSummaries();
    if (contextRefresh) await contextRefresh().catch(() => null);
    fetchCalendarEvents(currentYear, currentMonth);
  };

  // Regularization actions
  const openRegularizeForDate = (dateStr: string) => {
    setRegFormData({
      attendanceDate: dateStr,
      requestedPunchIn: '09:00',
      requestedPunchOut: '17:00',
      attendanceType: 'PRESENT',
      reason: ''
    });
    setRegError(null);
    setShowRegularizeModal(true);
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
      fetchRegularizations();
      fetchWorkforceSummaries();
      if (expandedEmpId) fetchEmployeeDetails(expandedEmpId, 1, false);
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
      fetchRegularizations();
      fetchWorkforceSummaries();
      if (expandedEmpId) fetchEmployeeDetails(expandedEmpId, 1, false);
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
      fetchRegularizations();
      fetchWorkforceSummaries();
      if (expandedEmpId) fetchEmployeeDetails(expandedEmpId, 1, false);
    } catch (err: any) {
      alert(err.message || 'Failed to reject regularization.');
    }
  };

  const handleWithdrawReg = async (id: string) => {
    if (!confirm('Are you sure you want to withdraw this pending regularization request?')) return;
    try {
      await apiFetch(`/attendance/regularize/my/${id}`, { method: 'DELETE' });
      setRegSuccess('Regularization request withdrawn successfully.');
      fetchRegularizations();
      fetchWorkforceSummaries();
      if (expandedEmpId) fetchEmployeeDetails(expandedEmpId, 1, false);
      setTimeout(() => setRegSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to withdraw regularization.');
    }
  };

  // Filtered workforce employees based on search query and department
  const filteredEmployees = useMemo(() => {
    return workforceEmployees.filter(emp => {
      const matchesSearch = !searchQuery.trim() ||
        emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeCode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = departmentFilter === 'ALL' || emp.departmentId === departmentFilter || emp.departmentName === departmentFilter;
      return matchesSearch && matchesDept;
    });
  }, [workforceEmployees, searchQuery, departmentFilter]);

  // Extract unique departments for filter dropdown
  const uniqueDepartments = useMemo(() => {
    const map = new Map<string, string>();
    workforceEmployees.forEach(e => {
      if (e.departmentName && e.departmentName !== 'Unassigned') {
        map.set(e.departmentId || e.departmentName, e.departmentName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [workforceEmployees]);

  const sessions = todaySummary?.sessions || [];

  return (
    <div className="space-y-6">
      {attFetchError && (
        <div className="p-4 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--action-danger-bg)] shrink-0" />
            <span className="font-semibold">{attFetchError}</span>
          </div>
          <button
            onClick={() => fetchWorkforceSummaries()}
            className="px-3 py-1 bg-[var(--action-danger-bg)] hover:opacity-90 text-[var(--action-danger-text)] rounded-lg text-xs font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {regSuccess && (
        <div className="p-4 bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] text-[var(--badge-success-text)] text-xs rounded-2xl flex items-center gap-2 shadow-xs">
          <CheckCircle className="w-4 h-4 text-[var(--badge-success-text)] shrink-0" />
          <span className="font-semibold">{regSuccess}</span>
        </div>
      )}

      {/* Header Block */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[var(--text-heading)] flex items-center gap-2">
            <Clock className="w-6 h-6 text-[var(--primary)] shrink-0" />
            <span>Attendance Management</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Employee attendance records, multi-session punches, and workforce management</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {/* Master Policy Status Badges Legend */}
          <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-semibold text-[var(--text-secondary)] bg-[var(--bg-surface)] p-2 sm:px-3 sm:py-1.5 border border-[var(--border-default)] rounded-xl flex-wrap shadow-xs">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--badge-success-text)]"></span> Present</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--badge-warning-text)]"></span> Short Leave</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--badge-info-text)]"></span> Late</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--secondary)]"></span> Half Day</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--badge-danger-text)]"></span> Absent</span>
          </div>

          {user?.employeeId && (
            <button
              onClick={() => openRegularizeForDate(new Date().toISOString().split('T')[0])}
              className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-default)] font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto transition-colors"
            >
              <CalendarIcon className="w-4 h-4 text-[var(--primary)] shrink-0" />
              <span>Regularize Attendance</span>
            </button>
          )}
        </div>
      </div>

      {/* Employee Personal Attendance Section (Check In / Out Control) */}
      {user?.employeeId && (
        <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-[var(--text-heading)]">Today's Attendance Control</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {activeSession
                  ? `Session in progress. Check in recorded at ${activeSession.check_in ? new Date(activeSession.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}.`
                  : (todaySummary?.completedSessionCount || 0) > 0
                  ? `Completed ${todaySummary?.completedSessionCount} session(s) today. Ready for next session.`
                  : 'No active session. Click Start New Session to record check in.'}
              </p>
            </div>

            <div>
              {activeSession ? (
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                  className="px-6 py-3 bg-[var(--action-danger-soft)] hover:bg-[var(--action-danger-bg)] text-[var(--action-danger-bg)] hover:text-[var(--action-danger-text)] border border-[var(--action-danger-bg)]/40 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-current" />
                      <span>Checking Out...</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4 fill-current" />
                      <span>Check Out Active Session</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading || todaySummary?.canCheckIn === false}
                  className="px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--primary-text)]" />
                      <span>Checking In...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-[var(--primary-text)]" />
                      <span>Start New Session (Check In)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Sessions Table for Today */}
          {sessions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[var(--text-heading)] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[var(--primary)]" />
                <span>Today's Work Sessions Log ({sessions.length})</span>
              </h4>
              <div className="overflow-x-auto border border-[var(--border-default)] rounded-xl">
                <table className="w-full text-left text-xs text-[var(--text-primary)]">
                  <thead className="bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] font-semibold border-b border-[var(--border-default)]">
                    <tr>
                      <th className="px-4 py-2.5">Session</th>
                      <th className="px-4 py-2.5">Check In</th>
                      <th className="px-4 py-2.5">Check Out</th>
                      <th className="px-4 py-2.5">Check-In GPS</th>
                      <th className="px-4 py-2.5">Check-Out GPS</th>
                      <th className="px-4 py-2.5">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {sessions.map((s: any, idx: number) => (
                      <tr key={s.id || idx} className={s.check_out ? 'hover:bg-[var(--bg-surface-hover)]' : 'bg-[var(--primary)]/5 border-l-2 border-l-[var(--primary)]'}>
                        <td className="px-4 py-3 font-semibold text-[var(--text-heading)]">Session #{idx + 1}</td>
                        <td className="px-4 py-3 font-mono font-medium text-[var(--badge-success-text)]">
                          {new Date(s.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-[var(--action-danger-bg)]">
                          {s.check_out ? new Date(s.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                            <span className="px-2 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30 rounded text-[10px] font-bold">IN PROGRESS</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[var(--text-primary)]">
                          {s.punch_in_location_name && <div className="font-semibold text-[var(--text-heading)]">{s.punch_in_location_name}</div>}
                          <div className="font-mono text-[10px] text-[var(--text-muted)]">
                            {formatCoord(s.punch_in_lat) !== 'N/A' ? `${formatCoord(s.punch_in_lat)}, ${formatCoord(s.punch_in_lng)}` : 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[var(--text-primary)]">
                          {s.punch_out_location_name && <div className="font-semibold text-[var(--text-heading)]">{s.punch_out_location_name}</div>}
                          <div className="font-mono text-[10px] text-[var(--text-muted)]">
                            {formatCoord(s.punch_out_lat) !== 'N/A' ? `${formatCoord(s.punch_out_lat)}, ${formatCoord(s.punch_out_lng)}` : 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-[var(--text-heading)]">
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

      {/* Workforce KPI Summary Cards (For Management) */}
      {isManagerOrAdmin && workforceKpi && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs">
              <span>Total Workforce</span>
              <Users className="w-4 h-4 text-[var(--primary)]" />
            </div>
            <div className="text-2xl font-black text-[var(--text-heading)] font-mono">{workforceKpi.totalEmployees || 0}</div>
          </div>
          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs">
              <span>Present Today</span>
              <UserCheck className="w-4 h-4 text-[var(--badge-success-text)]" />
            </div>
            <div className="text-2xl font-black text-[var(--badge-success-text)] font-mono">{workforceKpi.presentToday || 0}</div>
          </div>
          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs">
              <span>On Leave Today</span>
              <CalendarDays className="w-4 h-4 text-[var(--secondary)]" />
            </div>
            <div className="text-2xl font-black text-[var(--secondary)] font-mono">{workforceKpi.onLeaveToday || 0}</div>
          </div>
          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs">
              <span>Absent Today</span>
              <UserX className="w-4 h-4 text-[var(--badge-danger-text)]" />
            </div>
            <div className="text-2xl font-black text-[var(--badge-danger-text)] font-mono">{workforceKpi.absentToday || 0}</div>
          </div>
        </div>
      )}

      {/* WORKFORCE ATTENDANCE SECTION (Collapsible & Lazy-Loaded Architecture) */}
      {isManagerOrAdmin && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl shadow-xs space-y-5 p-5 sm:p-6">
          {/* Top Bar: Title + Date Range Presets */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--border-default)] pb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-heading)] flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--primary)]" />
                <span>Workforce Attendance</span>
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Showing summary from <span className="font-mono text-[var(--primary)] font-semibold">{activeDateRange.startDate}</span> to <span className="font-mono text-[var(--primary)] font-semibold">{activeDateRange.endDate}</span>
              </p>
            </div>

            {/* Date Range Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
              {(['LAST_7_DAYS', 'LAST_14_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'PREV_MONTH', 'CUSTOM'] as DatePreset[]).map(preset => {
                const labels: Record<DatePreset, string> = {
                  LAST_7_DAYS: 'Last 7 Days',
                  LAST_14_DAYS: 'Last 14 Days',
                  LAST_30_DAYS: 'Last 30 Days',
                  THIS_MONTH: 'This Month',
                  PREV_MONTH: 'Prev Month',
                  CUSTOM: 'Custom'
                };
                const isActive = selectedPreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSelectedPreset(preset)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow-xs'
                        : 'bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-default)]'
                    }`}
                  >
                    {labels[preset]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Pickers (if CUSTOM selected) */}
          {selectedPreset === 'CUSTOM' && (
            <div className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl flex flex-wrap items-center gap-3 text-xs">
              <span className="text-[var(--text-secondary)] font-medium">Custom Range:</span>
              <div className="flex items-center gap-2">
                <label className="text-[var(--text-secondary)]">Start:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--input-text)] font-mono text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[var(--text-secondary)]">End:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--input-text)] font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* Search & Department Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8 relative">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search employee by name or code..."
                className="w-full pl-9 pr-8 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-xs text-[var(--input-text)] placeholder-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="sm:col-span-4 relative">
              <Filter className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-xs text-[var(--input-text)] appearance-none focus:border-[var(--primary)] focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Departments ({workforceEmployees.length})</option>
                {uniqueDepartments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Collapsible Employee List */}
          {loadingWorkforce ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="p-4 bg-[var(--bg-surface-muted)]/50 border border-[var(--border-default)] rounded-xl animate-pulse flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--border-default)]" />
                    <div className="space-y-1.5">
                      <div className="w-32 h-3.5 bg-[var(--border-default)] rounded" />
                      <div className="w-20 h-2.5 bg-[var(--border-default)]/60 rounded" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-6 bg-[var(--border-default)] rounded-lg" />
                    <div className="w-24 h-6 bg-[var(--border-default)] rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : workforceError ? (
            <div className="p-4 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl flex items-center justify-between">
              <span className="font-semibold">{workforceError}</span>
              <button
                type="button"
                onClick={fetchWorkforceSummaries}
                className="px-3 py-1 bg-[var(--action-danger-bg)] hover:opacity-90 text-[var(--action-danger-text)] rounded-lg text-xs font-semibold cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)] text-xs bg-[var(--bg-surface-muted)]/40 rounded-xl border border-dashed border-[var(--border-default)]">
              No employees found matching the search criteria.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEmployees.map(emp => {
                const isExpanded = expandedEmpId === emp.id;
                const details = empDetailsMap[emp.id];

                return (
                  <div
                    key={emp.id}
                    className="bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-xs transition-all"
                  >
                    {/* Collapsible Header Card */}
                    <div className="p-3.5 sm:p-4 bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => toggleEmployeeExpansion(emp.id)}
                        aria-expanded={isExpanded}
                        aria-label={`Toggle attendance details for ${emp.fullName}`}
                        className="flex items-center gap-3 text-left focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)]/30 rounded-lg cursor-pointer flex-1 min-w-0"
                      >
                        <div className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-transform">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-[var(--primary)]" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                          )}
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-[var(--secondary)]/15 text-[var(--secondary)] font-extrabold text-sm flex items-center justify-center border border-[var(--secondary)]/30 shrink-0">
                          {emp.fullName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-[var(--text-heading)] truncate">{emp.fullName}</h4>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] font-medium">
                            <span className="font-mono text-[var(--primary)]">{emp.employeeCode}</span>
                            <span>•</span>
                            <span className="truncate">{emp.departmentName}</span>
                          </div>
                        </div>
                      </button>

                      {/* Summary Metrics & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-2.5 text-xs font-mono pl-8 sm:pl-0">
                        <span className="px-2.5 py-1 bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] rounded-lg border border-[var(--border-default)]">
                          Sessions: <strong className="text-[var(--text-heading)]">{emp.sessionCount}</strong>
                        </span>
                        <span className="px-2.5 py-1 bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] rounded-lg border border-[var(--badge-success-border)]">
                          Total: <strong className="font-bold">{formatWorkingHours(emp.totalHours)}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const filename = `Attendance_${emp.employeeCode}_${activeDateRange.startDate}_to_${activeDateRange.endDate}.xlsx`;
                              await apiDownload(`/attendance/export/${emp.id}?startDate=${activeDateRange.startDate}&endDate=${activeDateRange.endDate}`, {}, filename);
                            } catch (err: any) {
                              alert(err.message || 'Export failed.');
                            }
                          }}
                          className="px-2.5 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-lg font-sans font-semibold text-xs flex items-center gap-1 shadow-xs transition cursor-pointer"
                          title="Download Excel for selected range"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Excel</span>
                        </button>
                      </div>
                    </div>

                    {/* Detailed Attendance Table (Rendered only when expanded) */}
                    {isExpanded && (
                      <div className="border-t border-[var(--border-default)] p-3 sm:p-4 bg-[var(--bg-surface-muted)]/30 space-y-3">
                        {details?.loading ? (
                          <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
                            <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                            <span>Loading attendance history (newest first)...</span>
                          </div>
                        ) : details?.error ? (
                          <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl flex items-center justify-between">
                            <span className="font-semibold">{details.error}</span>
                            <button
                              type="button"
                              onClick={() => fetchEmployeeDetails(emp.id, 1, false)}
                              className="px-3 py-1 bg-[var(--action-danger-bg)] hover:opacity-90 text-[var(--action-danger-text)] rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Retry
                            </button>
                          </div>
                        ) : (details?.records || []).length === 0 ? (
                          <div className="py-6 text-center text-[var(--text-muted)] text-xs italic">
                            No attendance records found for this period.
                          </div>
                        ) : (
                          <>
                            <div className="overflow-x-auto rounded-xl border border-[var(--border-default)]">
                              <table className="w-full text-left text-xs text-[var(--text-primary)]">
                                <thead className="bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] font-semibold uppercase text-[10px] tracking-wider border-b border-[var(--border-default)]">
                                  <tr>
                                    <th className="px-4 py-2.5">Date</th>
                                    <th className="px-4 py-2.5">Check In</th>
                                    <th className="px-4 py-2.5">Check Out</th>
                                    <th className="px-4 py-2.5">Hours</th>
                                    <th className="px-4 py-2.5">Status</th>
                                    <th className="px-4 py-2.5 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-subtle)]">
                                  {details.records.map((a: any, sIdx: number) => {
                                    const dateStr = a.date ? (typeof a.date === 'string' ? a.date.split('T')[0] : new Date(a.date).toISOString().split('T')[0]) : 'N/A';
                                    const isAbsent = a.status === 'ABSENT' || a.status === 'ABSENT → Regularize';
                                    const canReg = a.canRegularize || isAbsent;

                                    return (
                                      <tr key={a.id || sIdx} className="hover:bg-[var(--bg-surface-hover)]">
                                        <td className="px-4 py-3 font-mono font-medium text-[var(--text-heading)]">{dateStr}</td>
                                        <td className="px-4 py-3 font-mono text-[var(--badge-success-text)] font-medium">
                                          {a.check_in ? new Date(a.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-[var(--badge-danger-text)] font-medium">
                                          {a.check_out ? new Date(a.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                        </td>
                                        <td className="px-4 py-3 font-mono font-bold text-[var(--text-heading)]">{formatWorkingHours(a.working_hours)}</td>
                                        <td className="px-4 py-3">
                                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                            isAbsent || a.status === 'ABSENT'
                                              ? 'bg-[var(--badge-danger-bg)] text-[var(--badge-danger-text)] border border-[var(--badge-danger-border)]'
                                              : a.status?.includes('SHORT LEAVE')
                                              ? 'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border border-[var(--badge-warning-border)]'
                                              : a.status?.includes('LATE PRESENT')
                                              ? 'bg-[var(--badge-info-bg)] text-[var(--badge-info-text)] border border-[var(--badge-info-border)]'
                                              : a.status === 'HALF DAY'
                                              ? 'bg-[var(--secondary)]/15 text-[var(--secondary)] border border-[var(--secondary)]/30'
                                              : a.status === 'HOLIDAY'
                                              ? 'bg-[var(--badge-info-bg)] text-[var(--badge-info-text)] border border-[var(--badge-info-border)]'
                                              : a.status === 'PRESENT'
                                              ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border border-[var(--badge-success-border)]'
                                              : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-default)]'
                                          }`}>
                                            {a.status || 'PRESENT'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          <div className="flex items-center justify-end gap-2">
                                            {canReg && (
                                              <button
                                                type="button"
                                                onClick={() => openRegularizeForDate(dateStr)}
                                                className="px-2.5 py-1 bg-[var(--primary)]/15 hover:bg-[var(--primary)]/25 text-[var(--primary)] border border-[var(--primary)]/30 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                              >
                                                <span>Regularize</span>
                                              </button>
                                            )}
                                            {!a.isSynthesized && (
                                              <button
                                                type="button"
                                                onClick={() => setSelectedSession(a)}
                                                className="px-2.5 py-1 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--primary)] border border-[var(--border-default)] rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                              >
                                                <Eye className="w-3.5 h-3.5" />
                                                <span>GPS Details</span>
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Incremental Pagination: Load Older Attendance Button */}
                            {details.hasMore && (
                              <div className="pt-2 flex justify-center">
                                <button
                                  type="button"
                                  disabled={details.loadingMore}
                                  onClick={() => fetchEmployeeDetails(emp.id, details.page + 1, true)}
                                  className="px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] disabled:opacity-50 text-[var(--primary)] border border-[var(--border-default)] rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                                >
                                  {details.loadingMore ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Loading older attendance...</span>
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="w-3.5 h-3.5" />
                                      <span>Load Older Attendance</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Attendance Calendar (Preserved) */}
      <SharedCalendar
        events={calendarEvents}
        initialYear={currentYear}
        initialMonth={currentMonth}
        onMonthChange={(y, m) => {
          setCurrentYear(y);
          setCurrentMonth(m);
        }}
        title="Attendance Calendar"
        subtitle="Visualizing daily attendance check-ins, multi-sessions, and working calendar holidays"
        attendanceOnly={true}
      />

      {/* Attendance Regularization Queue Table */}
      {regularizations.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-xs space-y-2">
          <div className="px-6 py-4 border-b border-[var(--border-default)] font-semibold text-xs text-[var(--text-heading)] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[var(--primary)]" />
              <span>{isManagerOrAdmin ? 'Attendance Regularization Requests Queue' : 'My Regularization Requests History'}</span>
            </span>
            <span className="px-2.5 py-0.5 text-xs bg-[var(--bg-surface-muted)] text-[var(--primary)] rounded-full font-mono font-bold border border-[var(--border-default)]">
              {regularizations.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[var(--text-primary)]">
              <thead className="bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider border-b border-[var(--border-default)]">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Original In / Out</th>
                  <th className="px-6 py-3">Requested In / Out</th>
                  <th className="px-6 py-3">Reason</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {regularizations.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--bg-surface-hover)]">
                    <td className="px-6 py-3.5 font-semibold text-[var(--text-heading)]">
                      {r.employee_name}
                      <span className="block text-[10px] text-[var(--text-muted)] font-mono">{r.employee_code || 'EMP'}</span>
                    </td>
                    <td className="px-6 py-3.5 font-mono">{r.attendance_date ? new Date(r.attendance_date).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-[var(--text-secondary)]">
                      <div>In: {r.original_in_time ? new Date(r.original_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not Recorded'}</div>
                      <div>Out: {r.original_out_time ? new Date(r.original_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not Recorded'}</div>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-[var(--primary)] font-medium">
                      <div>In: {r.requested_punch_in ? new Date(r.requested_punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</div>
                      <div>Out: {r.requested_punch_out ? new Date(r.requested_punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</div>
                    </td>
                    <td className="px-6 py-3.5 max-w-xs truncate text-[var(--text-secondary)]" title={r.reason}>{r.reason}</td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                        r.status === 'APPROVED' ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border border-[var(--badge-success-border)]' :
                        r.status === 'REJECTED' ? 'bg-[var(--badge-danger-bg)] text-[var(--badge-danger-text)] border border-[var(--badge-danger-border)]' :
                        'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border border-[var(--badge-warning-border)] animate-pulse'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {isManagerOrAdmin && r.status === 'PENDING' && r.employee_id !== user?.employeeId ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleApproveReg(r.id)}
                            className="px-2.5 py-1 bg-[var(--badge-success-bg)] hover:opacity-90 text-[var(--badge-success-text)] border border-[var(--badge-success-border)] rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectReg(r.id)}
                            className="px-2.5 py-1 bg-[var(--badge-danger-bg)] hover:opacity-90 text-[var(--badge-danger-text)] border border-[var(--badge-danger-border)] rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : r.status === 'PENDING' && r.employee_id === user?.employeeId ? (
                        <button
                          type="button"
                          onClick={() => handleWithdrawReg(r.id)}
                          className="px-2.5 py-1 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                        >
                          Withdraw
                        </button>
                      ) : (
                        <span className="text-[11px] text-[var(--text-muted)] font-mono">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GPS Inspection Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-lg text-[var(--text-heading)] flex items-center gap-2">
                <Compass className="w-5 h-5 text-[var(--primary)]" />
                <span>Session GPS Inspection</span>
              </h3>
              <button type="button" onClick={() => setSelectedSession(null)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] rounded-xl space-y-1">
                <div className="text-[var(--text-secondary)]">Employee: <strong className="text-[var(--text-heading)]">{selectedSession.employee_name}</strong></div>
                <div className="text-[var(--text-secondary)]">Date: <span className="font-mono text-[var(--primary)] font-semibold">{selectedSession.date}</span></div>
                <div className="text-[var(--text-secondary)]">Working Hours: <strong className="text-[var(--badge-success-text)] font-mono">{selectedSession.working_hours || 0} hrs</strong></div>
              </div>

              {/* Check-In Location Box */}
              <div className="p-3.5 bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] rounded-xl space-y-1.5">
                <div className="font-bold text-[var(--badge-success-text)] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  <span>Check-In GPS Location</span>
                </div>
                {selectedSession.punch_in_location_name && (
                  <div className="text-[var(--text-heading)] font-semibold bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-default)]">
                    {selectedSession.punch_in_location_name}
                  </div>
                )}
                <div className="text-[var(--text-primary)]">Timestamp: <span className="font-mono text-[var(--text-heading)] font-semibold">{selectedSession.check_in ? new Date(selectedSession.check_in).toLocaleString() : 'N/A'}</span></div>
                <div className="text-[var(--text-primary)]">Latitude: <span className="font-mono text-[var(--primary)]">{selectedSession.punch_in_lat || 'N/A'}</span></div>
                <div className="text-[var(--text-primary)]">Longitude: <span className="font-mono text-[var(--primary)]">{selectedSession.punch_in_lng || 'N/A'}</span></div>
                <div className="text-[var(--text-primary)]">Accuracy: <span className="font-mono text-[var(--text-muted)]">{formatAccuracy(selectedSession.punch_in_accuracy)}</span></div>
              </div>

              {/* Check-Out Location Box */}
              <div className="p-3.5 bg-[var(--badge-danger-bg)] border border-[var(--badge-danger-border)] rounded-xl space-y-1.5">
                <div className="font-bold text-[var(--badge-danger-text)] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  <span>Check-Out GPS Location</span>
                </div>
                {selectedSession.punch_out_location_name && (
                  <div className="text-[var(--text-heading)] font-semibold bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-default)]">
                    {selectedSession.punch_out_location_name}
                  </div>
                )}
                <div className="text-[var(--text-primary)]">Timestamp: <span className="font-mono text-[var(--text-heading)] font-semibold">{selectedSession.check_out ? new Date(selectedSession.check_out).toLocaleString() : 'N/A'}</span></div>
                <div className="text-[var(--text-primary)]">Latitude: <span className="font-mono text-[var(--primary)]">{selectedSession.punch_out_lat || 'N/A'}</span></div>
                <div className="text-[var(--text-primary)]">Longitude: <span className="font-mono text-[var(--primary)]">{selectedSession.punch_out_lng || 'N/A'}</span></div>
                <div className="text-[var(--text-primary)]">Accuracy: <span className="font-mono text-[var(--text-muted)]">{formatAccuracy(selectedSession.punch_out_accuracy)}</span></div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-[var(--border-default)]">
              <button type="button" onClick={() => setSelectedSession(null)} className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl text-xs font-semibold cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Regularization Form Modal */}
      {showRegularizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="font-bold text-lg text-[var(--text-heading)] flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-[var(--primary)]" />
                <span>Attendance Regularization Request</span>
              </h3>
              <button type="button" onClick={() => setShowRegularizeModal(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {regError && (
              <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--action-danger-bg)] shrink-0" />
                <span className="font-semibold">{regError}</span>
              </div>
            )}

            <form onSubmit={handleRegularizationSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--text-secondary)] mb-1 font-medium">Date Being Regularized *</label>
                <input
                  type="date"
                  required
                  value={regFormData.attendanceDate}
                  onChange={(e) => setRegFormData(f => ({ ...f, attendanceDate: e.target.value }))}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-[var(--input-text)] font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-secondary)] mb-1 font-medium">Requested In Time *</label>
                  <input
                    type="time"
                    required
                    value={regFormData.requestedPunchIn}
                    onChange={(e) => setRegFormData(f => ({ ...f, requestedPunchIn: e.target.value }))}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-[var(--input-text)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-secondary)] mb-1 font-medium">Requested Out Time *</label>
                  <input
                    type="time"
                    required
                    value={regFormData.requestedPunchOut}
                    onChange={(e) => setRegFormData(f => ({ ...f, requestedPunchOut: e.target.value }))}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-[var(--input-text)] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-secondary)] mb-1 font-medium">Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={regFormData.reason}
                  onChange={(e) => setRegFormData(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Provide a clear justification (e.g. Forgot to punch in/out on client visit)"
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-[var(--input-text)] placeholder-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
                <button
                  type="button"
                  onClick={() => setShowRegularizeModal(false)}
                  className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-default)] font-medium rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-bold rounded-xl shadow-xs cursor-pointer"
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
