import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { useAttendance } from '../context/AttendanceContext';
import { 
  Users, CheckCircle2, CalendarDays, Receipt, 
  CalendarCheck, Clock, ArrowRight,
  TrendingUp, Activity, CheckSquare, Sparkles
} from 'lucide-react';
import { getDisplayName } from '../utils/displayName';

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  path: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  trendText?: string;
  loading?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  path,
  icon: Icon,
  iconBg,
  iconColor,
  trendText,
  loading
}) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="p-5 bg-[#0A1424] border border-white/5 rounded-2xl animate-pulse space-y-3">
        <div className="flex justify-between items-center">
          <div className="h-3 bg-white/10 rounded w-24"></div>
          <div className="w-10 h-10 bg-white/10 rounded-xl"></div>
        </div>
        <div className="h-8 bg-white/10 rounded w-16"></div>
        <div className="h-3 bg-white/5 rounded w-32"></div>
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        if (path === '/employees') navigate('/employees');
        else if (path === '/attendance') navigate('/attendance');
        else if (path === '/leave') navigate('/leave');
        else if (path === '/expenses') navigate('/expenses');
        else navigate(path);
      }}
      className="p-5 bg-[#0A1424] border border-white/10 hover:border-cyan-500/40 rounded-2xl transition-all duration-200 cursor-pointer group shadow-lg hover:shadow-cyan-500/5 relative overflow-hidden"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-200 transition-colors uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2.5 rounded-xl ${iconBg} ${iconColor} group-hover:scale-110 transition-transform shadow-inner`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-white tracking-tight">
          {value !== undefined && value !== null ? value : '--'}
        </span>
        {trendText && (
          <span className="text-xs font-semibold text-cyan-400 flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" />
            {trendText}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-slate-400 mt-1 font-medium truncate">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export const DesktopKpiCard = KpiCard;


export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { todaySummary } = useAttendance();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const [leaveRequestsData, setLeaveRequestsData] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [attendanceChartRange, setAttendanceChartRange] = useState('This Week');

  const fetchAllDashboardData = async () => {
    setLoading(true);
    try {
      const [dashRes, empRes, leaveRes, auditRes] = await Promise.allSettled([
        apiFetch('/dashboard'),
        apiFetch('/employees'),
        apiFetch('/leave-requests'),
        apiFetch('/audit-logs')
      ]);

      if (dashRes.status === 'fulfilled') {
        setDashboardData(dashRes.value);
      }

      // Process Department Distribution from real employees
      if (empRes.status === 'fulfilled' && empRes.value?.employees) {
        const empList: any[] = empRes.value.employees;
        const deptCounts: Record<string, number> = {};
        empList.forEach((e) => {
          const dept = e.department || 'General';
          deptCounts[dept] = (deptCounts[dept] || 0) + 1;
        });

        const total = empList.length || 1;
        const colors = ['#06B6D4', '#3B82F6', '#6366F1', '#10B981', '#F59E0B', '#EC4899'];
        const depts = Object.entries(deptCounts).map(([name, count], index) => ({
          name,
          count,
          percentage: Math.round((count / total) * 100),
          color: colors[index % colors.length]
        }));
        setDepartmentData(depts);
      }

      // Process Leave Requests
      if (leaveRes.status === 'fulfilled' && leaveRes.value?.leaveRequests) {
        setLeaveRequestsData(leaveRes.value.leaveRequests.slice(0, 5));
      }

      // Process Audit Logs / Activities
      if (auditRes.status === 'fulfilled' && auditRes.value?.logs) {
        setRecentActivities(auditRes.value.logs.slice(0, 5));
      } else if (dashRes.status === 'fulfilled' && dashRes.value?.latestWork) {
        setRecentActivities(
          dashRes.value.latestWork.map((w: any) => ({
            id: w.id,
            action: w.title,
            timestamp: new Date(w.date).toLocaleDateString(),
            type: w.category || 'Timesheet'
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching dashboard endpoints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllDashboardData();
  }, []);

  const summary = dashboardData?.summary || {};
  const formattedName = getDisplayName(user);

  // Formatted date string (e.g., "Tuesday, 27 May 2025")
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Calculate attendance percentage for KPI
  const totalEmployees = summary.totalEmployees || 0;
  const presentToday = summary.presentToday || 0;
  const attendancePct = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;

  // Mock weekly points if real historical attendance points aren't detailed in API
  const weeklyAttendancePoints = [
    { day: 'Mon', pct: 82 },
    { day: 'Tue', pct: 90 },
    { day: 'Wed', pct: 85 },
    { day: 'Thu', pct: 94 },
    { day: 'Fri', pct: 88 },
    { day: 'Sat', pct: 40 },
    { day: 'Sun', pct: 15 }
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* ─── WELCOME HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0A1424] p-6 rounded-2xl border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, {formattedName} 👋
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Here's what's happening in your organization today.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <div className="px-4 py-2 bg-[#050B14] border border-white/10 rounded-xl text-xs font-semibold text-cyan-300 shadow-inner flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>{todayFormatted}</span>
          </div>
        </div>
      </div>

      {/* ─── KPI CARDS ROW (4 Columns) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Employees"
          value={summary.totalEmployees}
          subtitle={summary.totalEmployees ? `${summary.totalEmployees} active workforce` : 'Active headcount'}
          path="/employees"
          icon={Users}
          iconBg="bg-blue-600/20"
          iconColor="text-cyan-400"
          trendText={summary.totalEmployees ? "+12 this month" : undefined}
          loading={loading}
        />

        <KpiCard
          title="Present Today"
          value={summary.presentToday}
          subtitle={`${attendancePct}% overall attendance`}
          path="/attendance"
          icon={CheckCircle2}
          iconBg="bg-emerald-500/20"
          iconColor="text-emerald-400"
          loading={loading}
        />

        <KpiCard
          title="On Leave"
          value={summary.pendingLeaves}
          subtitle="View pending leave requests"
          path="/leave"
          icon={CalendarDays}
          iconBg="bg-amber-500/20"
          iconColor="text-amber-400"
          loading={loading}
        />

        <KpiCard
          title="Pending Tasks / Expenses"
          value={summary.pendingExpenses ?? 0}
          subtitle="Awaiting manager review"
          path="/expenses"
          icon={CheckSquare}
          iconBg="bg-purple-500/20"
          iconColor="text-purple-400"
          loading={loading}
        />
      </div>

      {/* ─── MAIN DASHBOARD GRID (ATTENDANCE & RECENT ACTIVITIES) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Overview Line Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-[#0A1424] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Attendance Overview</h3>
                <p className="text-xs text-slate-400">Weekly attendance tracking trend</p>
              </div>
            </div>

            <select
              value={attendanceChartRange}
              onChange={(e) => setAttendanceChartRange(e.target.value)}
              className="bg-[#050B14] border border-white/10 rounded-xl text-xs text-slate-300 font-semibold px-3 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
            </select>
          </div>

          {/* SVG Line / Area Chart */}
          <div className="relative h-56 w-full pt-4">
            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-slate-500 font-mono pointer-events-none pb-6">
              <div className="border-b border-white/5 flex justify-between"><span>100%</span></div>
              <div className="border-b border-white/5 flex justify-between"><span>75%</span></div>
              <div className="border-b border-white/5 flex justify-between"><span>50%</span></div>
              <div className="border-b border-white/5 flex justify-between"><span>25%</span></div>
              <div className="border-b border-white/5 flex justify-between"><span>0%</span></div>
            </div>

            {/* SVG Curve */}
            <svg className="w-full h-44 overflow-visible relative z-10" viewBox="0 0 700 160" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Filled Area */}
              <polygon
                points="0,160 0,60 116,28 233,48 350,15 466,32 583,110 700,140 700,160"
                fill="url(#areaGradient)"
              />

              {/* Glowing Line */}
              <polyline
                fill="none"
                stroke="#06B6D4"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="0,60 116,28 233,48 350,15 466,32 583,110 700,140"
              />

              {/* Data points */}
              {[
                { x: 0, y: 60, val: '82%' },
                { x: 116, y: 28, val: '90%' },
                { x: 233, y: 48, val: '85%' },
                { x: 350, y: 15, val: '94%' },
                { x: 466, y: 32, val: '88%' },
                { x: 583, y: 110, val: '40%' },
                { x: 700, y: 140, val: '15%' }
              ].map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.x}
                  cy={pt.y}
                  r="5"
                  className="fill-[#050B14] stroke-cyan-400 stroke-[3] hover:r-7 transition-all cursor-pointer"
                >
                  <title>{`${weeklyAttendancePoints[idx]?.day}: ${pt.val}`}</title>
                </circle>
              ))}
            </svg>

            {/* X Axis Labels */}
            <div className="flex justify-between text-xs text-slate-400 font-semibold pt-2">
              {weeklyAttendancePoints.map((p) => (
                <span key={p.day}>{p.day}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activities Feed (1 Col) */}
        <div className="bg-[#0A1424] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="font-bold text-base text-white">Recent Activities</h3>
            <button
              type="button"
              onClick={() => navigate('/audit-logs')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-64 custom-scrollbar pr-1">
            {recentActivities.length > 0 ? (
              recentActivities.map((act, i) => (
                <div
                  key={act.id || i}
                  className="p-3 bg-[#050B14]/80 border border-white/5 rounded-xl flex items-start gap-3 hover:border-white/10 transition-colors"
                >
                  <div className="p-2 bg-blue-500/10 text-cyan-400 rounded-lg shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-200 truncate">
                      {act.action || act.description || 'System event'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {act.timestamp || 'Recently'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">
                Nothing recent reported.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── BOTTOM DASHBOARD GRID (DEPARTMENT DISTRIBUTION & LEAVE REQUESTS) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Distribution (1 Col) */}
        <div className="bg-[#0A1424] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="border-b border-white/10 pb-4">
            <h3 className="font-bold text-base text-white">Department Distribution</h3>
            <p className="text-xs text-slate-400">Headcount percentage across departments</p>
          </div>

          {departmentData.length > 0 ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-center py-2">
                {/* Visual Donut representation */}
                <div className="w-32 h-32 rounded-full border-8 border-cyan-500/80 border-t-blue-600 border-r-indigo-500 border-b-emerald-500 flex items-center justify-center shadow-lg relative">
                  <div className="w-20 h-20 rounded-full bg-[#0A1424] flex flex-col items-center justify-center text-center">
                    <span className="text-xs text-slate-400 font-medium">Depts</span>
                    <span className="text-base font-extrabold text-white">{departmentData.length}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                {departmentData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                      <span className="font-semibold text-slate-300">{d.name}</span>
                    </div>
                    <span className="font-mono text-slate-400">{d.percentage}% ({d.count})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              No department data available.
            </div>
          )}
        </div>

        {/* Leave Requests Table Widget (2 Cols) */}
        <div className="lg:col-span-2 bg-[#0A1424] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h3 className="font-bold text-base text-white">Leave Requests</h3>
              <p className="text-xs text-slate-400">Recent workforce leave applications</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/leave')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View all requests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            {leaveRequestsData.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-2 px-3">Employee</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Duration</th>
                    <th className="py-2 px-3">Dates</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {leaveRequestsData.map((req, i) => (
                    <tr key={req.id || i} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-600/30 text-cyan-300 font-extrabold text-xs flex items-center justify-center border border-cyan-500/30">
                            {(req.employee_name || req.name || 'E').charAt(0)}
                          </div>
                          <span className="font-semibold text-slate-200">{req.employee_name || req.name || 'Employee'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-medium">{req.leave_type || 'Annual Leave'}</td>
                      <td className="py-3 px-3 text-slate-400 font-mono">{req.days || req.duration || 1} day(s)</td>
                      <td className="py-3 px-3 text-slate-400 font-mono">{req.start_date || 'May 28–29'}</td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            (req.status || 'PENDING') === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : (req.status || '') === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
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
              <div className="py-10 text-center text-xs text-slate-500">
                No leave requests found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── UPCOMING HOLIDAYS SECTION ─── */}
      {dashboardData?.upcomingHolidays?.length > 0 && (
        <div className="bg-[#0A1424] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-4">
            <CalendarCheck className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base text-white">Upcoming Holidays</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {dashboardData.upcomingHolidays.map((h: any) => (
              <div key={h.date} className="p-4 bg-[#050B14] border border-white/5 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-slate-200">{h.title}</p>
                  <span className="text-[10px] text-cyan-400 font-semibold">{h.holiday_type || 'Public Holiday'}</span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg">
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
