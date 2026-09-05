import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAttendance } from '../context/AttendanceContext';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../services/api-client';
import { getDisplayName } from '../utils/displayName';
import {
  Users, CheckCircle2, CalendarDays, CheckSquare,
  Activity, ArrowRight, Sparkles, Clock, CalendarCheck, RefreshCw
} from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  path: string;
  icon: React.ElementType;
  iconBgVar: string;
  iconColorVar: string;
  trendText?: string;
  loading?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  path,
  icon: Icon,
  iconBgVar,
  iconColorVar,
  trendText,
  loading = false
}) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (path === '/employees') navigate('/employees');
    else if (path === '/attendance') navigate('/attendance');
    else if (path === '/leave') navigate('/leave');
    else if (path === '/expenses') navigate('/expenses');
    else navigate(path);
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] rounded-2xl p-5 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-all hover:translate-y-[-2px] cursor-pointer relative overflow-hidden group flex flex-col justify-between"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            {title}
          </p>
          {loading ? (
            <div className="h-9 w-20 bg-[var(--bg-surface-muted)] rounded-lg animate-pulse my-1" />
          ) : (
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
              {value ?? 0}
            </h2>
          )}
        </div>

        <div
          className="p-3 rounded-2xl border border-[var(--border-subtle)] group-hover:scale-105 transition-transform shrink-0"
          style={{ backgroundColor: `var(${iconBgVar})`, color: `var(${iconColorVar})` }}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
        {trendText && (
          <span className="font-semibold text-[var(--primary)] text-[11px] inline-flex items-center gap-1">
            {trendText}
          </span>
        )}
        {subtitle && (
          <p className="text-xs text-[var(--text-muted)] font-medium truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

export const DesktopKpiCard = KpiCard;

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { todaySummary } = useAttendance();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [attendanceChartRange, setAttendanceChartRange] = useState('This Week');

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await apiFetch<any>(`/dashboard?period=${encodeURIComponent(attendanceChartRange)}`);
      if (res && res.data) {
        setDashboardData(res.data);
      } else if (res) {
        setDashboardData(res);
      }
    } catch (err) {
      console.warn('Dashboard real-time fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [attendanceChartRange]);

  // Initial fetch and range filter change
  useEffect(() => {
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  // React to Attendance punch actions instantly
  useEffect(() => {
    fetchDashboardData(true);
  }, [todaySummary?.firstCheckIn, todaySummary?.lastCheckOut, fetchDashboardData]);

  // Tab visibility refresh & 45s background polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData(true);
      }
    }, 45000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [fetchDashboardData]);

  const summary = dashboardData?.summary || {};
  const formattedName = getDisplayName(user);

  // Formatted date string (e.g., "Saturday, Sep 5, 2026")
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Calculate attendance percentage for KPI
  const totalEmployees = summary.totalEmployees || 0;
  const presentToday = summary.presentToday || 0;
  const attendancePct = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;

  // Weekly Attendance Points
  const weeklyAttendancePoints: Array<{ day: string; date: string; presentCount: number; pct: number }> =
    dashboardData?.weeklyAttendance?.points || [
      { day: 'Mon', date: '', presentCount: 0, pct: 0 },
      { day: 'Tue', date: '', presentCount: 0, pct: 0 },
      { day: 'Wed', date: '', presentCount: 0, pct: 0 },
      { day: 'Thu', date: '', presentCount: 0, pct: 0 },
      { day: 'Fri', date: '', presentCount: 0, pct: 0 },
      { day: 'Sat', date: '', presentCount: 0, pct: 0 },
      { day: 'Sun', date: '', presentCount: 0, pct: 0 }
    ];

  // SVG Chart Polyline / Polygon coordinates calculation
  const svgWidth = 700;
  const svgHeight = 160;
  const numPoints = weeklyAttendancePoints.length || 7;
  const stepX = svgWidth / (numPoints - 1 || 1);

  const chartCoords = weeklyAttendancePoints.map((pt, idx) => {
    const x = Math.round(idx * stepX);
    const pctClamped = Math.max(0, Math.min(100, pt.pct || 0));
    const y = Math.round(140 - (pctClamped / 100) * 125);
    return { x, y, val: `${pctClamped}%`, day: pt.day, count: pt.presentCount };
  });

  const polylinePointsStr = chartCoords.map(c => `${c.x},${c.y}`).join(' ');
  const polygonPointsStr = `0,${svgHeight} ` + polylinePointsStr + ` ${svgWidth},${svgHeight}`;

  // Department distribution data
  const departmentData: any[] = dashboardData?.departments || [];

  // Recent activities list
  const recentActivities: any[] = dashboardData?.recentActivities || [];

  // Recent leave requests list
  const leaveRequestsData: any[] = dashboardData?.recentLeaveRequests || [];

  // Chart theme color resolver
  const getThemeChartColor = () => {
    if (theme === 'merino') return '#16587B'; // Venice Blue
    return '#5D0D18'; // Bloodstone (Vanilla default)
  };

  return (
    <div className="space-y-6 pb-8">
      {/* ─── WELCOME HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--bg-surface)] p-4 sm:p-6 rounded-2xl border border-[var(--border-subtle)] shadow-[var(--card-shadow)] relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Welcome back, {formattedName} 👋
            </h1>
            {refreshing && (
              <RefreshCw className="w-4 h-4 text-[var(--primary)] animate-spin shrink-0" />
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium">
            Here's what's happening in your organization today.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0 self-start sm:self-auto">
          <div className="px-3.5 py-1.5 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded-xl text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-2 shadow-sm">
            <Clock className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <span>{todayFormatted}</span>
          </div>
        </div>
      </div>

      {/* ─── KPI CARDS ROW (4 Columns) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Employees"
          value={summary.totalEmployees ?? 0}
          subtitle={summary.totalEmployees ? `${summary.totalEmployees} active workforce` : 'Active headcount'}
          path="/employees"
          icon={Users}
          iconBgVar="--kpi-emp-bg"
          iconColorVar="--kpi-emp-icon"
          trendText={summary.totalEmployees ? `${summary.totalEmployees} active` : undefined}
          loading={loading}
        />

        <KpiCard
          title="Present Today"
          value={summary.presentToday ?? 0}
          subtitle={`${attendancePct}% attendance`}
          path="/attendance"
          icon={CheckCircle2}
          iconBgVar="--kpi-present-bg"
          iconColorVar="--kpi-present-icon"
          loading={loading}
        />

        <KpiCard
          title="On Leave"
          value={summary.onLeaveToday ?? 0}
          subtitle={summary.pendingLeaves > 0 ? `${summary.pendingLeaves} pending approval` : 'View leave requests'}
          path="/leave"
          icon={CalendarDays}
          iconBgVar="--kpi-leave-bg"
          iconColorVar="--kpi-leave-icon"
          loading={loading}
        />

        <KpiCard
          title="Weekly Plan / Expenses"
          value={summary.totalPendingItems ?? (summary.pendingExpenses || 0) + (summary.pendingTasks || 0)}
          subtitle="Awaiting manager review"
          path="/expenses"
          icon={CheckSquare}
          iconBgVar="--kpi-plan-bg"
          iconColorVar="--kpi-plan-icon"
          loading={loading}
        />
      </div>

      {/* ─── MAIN DASHBOARD GRID (ATTENDANCE & RECENT ACTIVITIES) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Overview Line Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-[var(--card-shadow)] space-y-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--border-subtle)]">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[var(--text-primary)]">Attendance Overview</h3>
                <p className="text-xs text-[var(--text-muted)]">Weekly attendance tracking trend</p>
              </div>
            </div>

            <select
              value={attendanceChartRange}
              onChange={(e) => setAttendanceChartRange(e.target.value)}
              className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-xs text-[var(--text-primary)] font-semibold px-3 py-1.5 focus:outline-none focus:border-[var(--primary)] cursor-pointer shadow-sm"
            >
              <option value="This Week">This Week</option>
              <option value="Last Week">Last Week</option>
              <option value="This Month">This Month</option>
            </select>
          </div>

          {/* SVG Line / Area Chart */}
          <div className="relative h-56 w-full pt-4">
            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-[var(--text-muted)] font-mono pointer-events-none pb-6">
              <div className="border-b border-[var(--border-subtle)] flex justify-between"><span>100%</span></div>
              <div className="border-b border-[var(--border-subtle)] flex justify-between"><span>75%</span></div>
              <div className="border-b border-[var(--border-subtle)] flex justify-between"><span>50%</span></div>
              <div className="border-b border-[var(--border-subtle)] flex justify-between"><span>25%</span></div>
              <div className="border-b border-[var(--border-subtle)] flex justify-between"><span>0%</span></div>
            </div>

            {/* SVG Curve */}
            <svg className="w-full h-44 overflow-visible relative z-10" viewBox="0 0 700 160" preserveAspectRatio="none">
              <defs>
                <linearGradient id="themeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={getThemeChartColor()} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={getThemeChartColor()} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Filled Area */}
              <polygon
                points={polygonPointsStr}
                fill="url(#themeAreaGradient)"
              />

              {/* Theme Curve Line */}
              <polyline
                fill="none"
                stroke={getThemeChartColor()}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polylinePointsStr}
              />

              {/* Data points */}
              {chartCoords.map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.x}
                  cy={pt.y}
                  r="4.5"
                  fill="var(--bg-surface)"
                  stroke={getThemeChartColor()}
                  strokeWidth="2.5"
                  className="hover:r-6 transition-all cursor-pointer"
                >
                  <title>{`${pt.day}: ${pt.val} (${pt.count} present)`}</title>
                </circle>
              ))}
            </svg>

            {/* X Axis Labels */}
            <div className="flex justify-between text-xs text-[var(--text-muted)] font-semibold pt-2">
              {weeklyAttendancePoints.map((p) => (
                <span key={p.day}>{p.day}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activities Feed (1 Col) */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-[var(--card-shadow)] space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
            <h3 className="font-bold text-base text-[var(--text-primary)]">Recent Activities</h3>
            <button
              type="button"
              onClick={() => navigate('/audit-logs')}
              className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-64 custom-scrollbar pr-1">
            {recentActivities.length > 0 ? (
              recentActivities.map((act, i) => (
                <div
                  key={act.id || i}
                  className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded-xl flex items-start gap-3 hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  <div className="p-2 bg-[var(--primary-soft)] text-[var(--primary)] rounded-lg shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {act.userName ? `${act.userName}: ${act.action}` : (act.action || act.entityName || 'System event')}
                    </p>
                    {act.entityName && (
                      <p className="text-[11px] text-[var(--text-secondary)] truncate">
                        {act.module ? `[${act.module}] ` : ''}{act.entityName}
                      </p>
                    )}
                    <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                      {act.createdAt ? new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                Nothing recent reported.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── BOTTOM DASHBOARD GRID (DEPARTMENT DISTRIBUTION & LEAVE REQUESTS) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Distribution (1 Col) */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-[var(--card-shadow)] space-y-4">
          <div className="border-b border-[var(--border-subtle)] pb-4">
            <h3 className="font-bold text-base text-[var(--text-primary)]">Department Distribution</h3>
            <p className="text-xs text-[var(--text-muted)]">Headcount percentage across departments</p>
          </div>

          {departmentData.length > 0 ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-center py-2">
                {/* Clean Donut representation */}
                <div
                  className="w-32 h-32 rounded-full border-8 flex items-center justify-center shadow-sm relative"
                  style={{ borderColor: getThemeChartColor() }}
                >
                  <div className="w-20 h-20 rounded-full bg-[var(--bg-surface)] flex flex-col items-center justify-center text-center">
                    <span className="text-xs text-[var(--text-muted)] font-medium">Depts</span>
                    <span className="text-base font-extrabold text-[var(--text-primary)]">{departmentData.length}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                {departmentData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color || getThemeChartColor() }}></span>
                      <span className="font-semibold text-[var(--text-secondary)]">{d.name}</span>
                    </div>
                    <span className="font-mono text-[var(--text-muted)]">{d.percentage}% ({d.count})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              No department data available.
            </div>
          )}
        </div>

        {/* Leave Requests Table Widget (2 Cols) */}
        <div className="lg:col-span-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-[var(--card-shadow)] space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
            <div>
              <h3 className="font-bold text-base text-[var(--text-primary)]">Leave Requests</h3>
              <p className="text-xs text-[var(--text-muted)]">Recent workforce leave applications</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/leave')}
              className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View all requests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            {leaveRequestsData.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Dates</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {leaveRequestsData.map((req, i) => (
                    <tr key={req.id || i} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] font-bold text-xs flex items-center justify-center border border-[var(--border-subtle)]">
                            {(req.employeeName || req.employee_name || 'E').charAt(0)}
                          </div>
                          <span className="font-semibold text-[var(--text-primary)]">{req.employeeName || req.employee_name || 'Employee'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)] font-medium">{req.leaveType || req.leave_type || 'Annual Leave'}</td>
                      <td className="py-3 px-3 text-[var(--text-muted)] font-mono">{req.daysCount || req.days || 1} day(s)</td>
                      <td className="py-3 px-3 text-[var(--text-muted)] font-mono">
                        {req.startDate ? `${new Date(req.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${new Date(req.endDate || req.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : 'Recent'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            (req.status || 'PENDING') === 'PENDING'
                              ? 'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border border-[var(--badge-warning-border)]'
                              : (req.status || '') === 'APPROVED'
                              ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border border-[var(--badge-success-border)]'
                              : 'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border border-[var(--action-danger-bg)]/30'
                          }`}
                        >
                          {req.status || 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                No leave requests found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── UPCOMING HOLIDAYS SECTION ─── */}
      {dashboardData?.upcomingHolidays?.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-[var(--card-shadow)] space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-4">
            <CalendarCheck className="w-5 h-5 text-[var(--primary)]" />
            <h3 className="font-bold text-base text-[var(--text-primary)]">Upcoming Holidays</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {dashboardData.upcomingHolidays.map((h: any) => (
              <div key={h.date} className="p-4 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-[var(--text-primary)]">{h.title}</p>
                  <span className="text-[10px] text-[var(--text-muted)] font-semibold">{h.holiday_type || 'Public Holiday'}</span>
                </div>
                <span className="text-xs font-mono font-bold text-[var(--text-secondary)] bg-[var(--bg-surface)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)]">
                  {h.date}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
