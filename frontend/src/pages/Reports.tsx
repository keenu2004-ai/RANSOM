import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch, apiDownload, getApiUrl } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart3, Download, Calendar, Filter, FileSpreadsheet,
  CheckCircle2, Clock, PlayCircle, XCircle, ArrowRightLeft, DollarSign, Users, Briefcase
} from 'lucide-react';

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const isEmployee = user?.role === 'EMPLOYEE';

  // State for Departmental Headcount Report
  const [report, setReport] = useState<any[]>([]);

  // State for Employees List (for filter dropdown)
  const [employees, setEmployees] = useState<any[]>([]);

  // State for Weekly Plan Export Filters
  const [weekStart, setWeekStart] = useState<string>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  });

  const [weekEnd, setWeekEnd] = useState<string>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? 0 : 7); // Sunday
    const sunday = new Date(d.setDate(diff));
    return sunday.toISOString().split('T')[0];
  });

  const [filterEmployeeId, setFilterEmployeeId] = useState<string>(isEmployee ? (user?.employeeId || '') : '');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterVisitType, setFilterVisitType] = useState<string>('');
  const [filterOpportunity, setFilterOpportunity] = useState<string>('');

  const [downloading, setDownloading] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    planned: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    carryForward: number;
    pipelineValue: number;
  }>({
    planned: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    carryForward: 0,
    pipelineValue: 0
  });

  // Fetch workforce headcount report
  useEffect(() => {
    apiFetch('/reports/workforce')
      .then(res => setReport(res.report || []))
      .catch(console.error);
  }, []);

  // Fetch employees list if manager / admin
  useEffect(() => {
    if (!isEmployee) {
      apiFetch('/employees')
        .then(res => setEmployees(res.employees || res || []))
        .catch(console.error);
    }
  }, [isEmployee]);

  // Fetch live Weekly Plan summary preview for selected filters
  const fetchSummaryPreview = useCallback(async () => {
    try {
      const res = await apiFetch<any[]>('/timesheets', {
        params: {
          startDate: weekStart,
          endDate: weekEnd,
          assignedEmployeeId: filterEmployeeId || undefined,
          status: filterStatus || undefined,
          visitType: filterVisitType || undefined,
          priority: filterPriority || undefined,
          opportunityStage: filterOpportunity || undefined
        }
      });
      const tasks = res || [];

      let planned = 0, inProgress = 0, completed = 0, cancelled = 0, pipelineValue = 0;
      tasks.forEach(t => {
        if (t.status === 'PLANNED') planned++;
        if (t.status === 'IN_PROGRESS') inProgress++;
        if (t.status === 'COMPLETED') completed++;
        if (t.status === 'CANCELLED') cancelled++;
        pipelineValue += Number(t.estimated_value || 0);
      });

      // Fetch pending carry forward count
      let carryForward = 0;
      try {
        const carryRes = await apiFetch<{ tasks: any[] }>('/timesheets/pending-carry-forward', {
          params: { beforeDate: weekStart }
        });
        carryForward = carryRes?.tasks?.length || 0;
      } catch (_) {}

      setSummaryData({ planned, inProgress, completed, cancelled, carryForward, pipelineValue });
    } catch (err) {
      console.error('Error fetching export summary preview:', err);
    }
  }, [weekStart, weekEnd, filterEmployeeId, filterStatus, filterPriority, filterVisitType, filterOpportunity]);

  useEffect(() => {
    fetchSummaryPreview();
  }, [fetchSummaryPreview]);

  // Existing Workforce CSV export
  const handleExportWorkforceCsv = () => {
    const token = localStorage.getItem('theiakshi_auth_token');
    const url = `${getApiUrl('/reports/export-csv')}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = 'THEIAKSHI_Workforce_Report.csv';
        a.click();
      });
  };

  // Weekly Plan XLSX Export handler
  const handleGenerateWeeklyPlanXlsx = async () => {
    setDownloading(true);
    try {
      await apiDownload(
        '/timesheets/export',
        {
          params: {
            startDate: weekStart,
            endDate: weekEnd,
            assignedEmployeeId: filterEmployeeId || undefined,
            status: filterStatus || undefined,
            priority: filterPriority || undefined,
            visitType: filterVisitType || undefined,
            opportunityStage: filterOpportunity || undefined
          }
        },
        `THEIAKSHI_Weekly_Plan_${weekStart}_to_${weekEnd}.xlsx`
      );
    } catch (err: any) {
      alert(err.message || 'Unable to download Weekly Plan export.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            <span>Reports & Workforce Analytics</span>
          </h1>
          <p className="text-xs text-slate-400">Generate executive multi-sheet Excel reports, workforce analytics, and department headcounts</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportWorkforceCsv}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs rounded-xl transition-all shadow"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>Workforce CSV</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: WEEKLY WORK & FIELD VISIT EXPORT SYSTEM (CANONICAL XLSX) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Weekly Plan & Field Visit Excel Export</span>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono rounded-full font-bold">TRUE .XLSX</span>
              </h2>
              <p className="text-xs text-slate-400">Generates 6-sheet workbook: Weekly Plan, Executive Summary, Carry Forward, Opportunities, History, & Monthly Tracker</p>
            </div>
          </div>

          <button
            type="button"
            disabled={downloading}
            onClick={handleGenerateWeeklyPlanXlsx}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 min-w-[160px]"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Generating Excel...' : 'Generate Excel'}</span>
          </button>
        </div>

        {/* Live Summary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Planned</span>
              <Clock className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">{summaryData.planned}</div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>In Progress</span>
              <PlayCircle className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg font-bold text-amber-400 font-mono">{summaryData.inProgress}</div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Completed</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-emerald-400 font-mono">{summaryData.completed}</div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Cancelled</span>
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-lg font-bold text-rose-400 font-mono">{summaryData.cancelled}</div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Carry Forward</span>
              <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-lg font-bold text-purple-400 font-mono">{summaryData.carryForward}</div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Pipeline (₹)</span>
              <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-sm font-bold text-cyan-400 font-mono">₹{summaryData.pipelineValue.toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* Filters Grid Form */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export Scope & Filter Controls</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Week Start */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Week Start Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={weekStart}
                  onChange={e => setWeekStart(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            {/* Week End */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Week End Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={weekEnd}
                  onChange={e => setWeekEnd(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            {/* Employee Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Assigned Employee</label>
              {isEmployee ? (
                <input
                  type="text"
                  readOnly
                  value="My Weekly Plan (Self)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-400 cursor-not-allowed font-medium"
                />
              ) : (
                <select
                  value={filterEmployeeId}
                  onChange={e => setFilterEmployeeId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">All Authorized Employees</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_code || 'EMP'})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Task Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Task Statuses</option>
                <option value="PLANNED">PLANNED</option>
                <option value="IN_PROGRESS">IN PROGRESS</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Priority Level</label>
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Priorities</option>
                <option value="HIGH">HIGH Priority</option>
                <option value="MEDIUM">MEDIUM Priority</option>
                <option value="LOW">LOW Priority</option>
              </select>
            </div>

            {/* Visit Type Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Visit / Activity Type</label>
              <select
                value={filterVisitType}
                onChange={e => setFilterVisitType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Visit Types</option>
                <option value="New Prospect">New Prospect</option>
                <option value="Follow-Up">Follow-Up</option>
                <option value="Demo / Presentation">Demo / Presentation</option>
                <option value="Technical Support">Technical Support</option>
                <option value="AMC / Service">AMC / Service</option>
                <option value="Order Closure">Order Closure</option>
                <option value="Relationship Call">Relationship Call</option>
              </select>
            </div>

            {/* Opportunity Stage Filter */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Opportunity Stage</label>
              <select
                value={filterOpportunity}
                onChange={e => setFilterOpportunity(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Opportunity Stages</option>
                <option value="Lead">Lead</option>
                <option value="Qualified">Qualified</option>
                <option value="Proposal Sent">Proposal Sent</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: DEPARTMENTAL HEADCOUNT TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="font-semibold text-xs text-slate-300 flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span>Departmental Workforce Headcount Distribution</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Department</th>
                <th className="px-6 py-3">Total Active Headcount</th>
                <th className="px-6 py-3">Full Time</th>
                <th className="px-6 py-3">Contract / Intern</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {report.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="px-6 py-3.5 font-bold text-slate-200">{r.department || 'General Admin'}</td>
                  <td className="px-6 py-3.5 font-mono text-cyan-400 font-bold">{r.total_employees}</td>
                  <td className="px-6 py-3.5 font-mono">{r.full_time}</td>
                  <td className="px-6 py-3.5 font-mono">{r.contract}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
