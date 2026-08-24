import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch, apiDownload } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart3, Download, Calendar, Filter, FileSpreadsheet,
  CheckCircle2, Clock, PlayCircle, XCircle, ArrowRightLeft, DollarSign, Users, Archive, FileCheck, Loader2
} from 'lucide-react';

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const isEmployee = user?.role === 'EMPLOYEE';

  // State for Departmental Headcount Report
  const [report, setReport] = useState<any[]>([]);

  // State for Employees List (for filter dropdown)
  const [employees, setEmployees] = useState<any[]>([]);

  // State for Archived Reports
  const [archives, setArchives] = useState<any[]>([]);
  const [archivingWeekly, setArchivingWeekly] = useState(false);
  const [archivingMonthly, setArchivingMonthly] = useState(false);
  const [downloadingArchiveId, setDownloadingArchiveId] = useState<string | null>(null);

  // State for Monthly Report Selection
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

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

  // Fetch archived reports list
  const fetchArchives = useCallback(async () => {
    try {
      const res = await apiFetch<{ archives: any[] }>('/reports/archives');
      setArchives(res.archives || []);
    } catch (err) {
      console.warn('Failed to load report archives:', err);
    }
  }, []);

  useEffect(() => {
    fetchArchives();
  }, [fetchArchives]);

  // Fetch live Weekly Plan summary preview for selected filters
  const fetchSummaryPreview = useCallback(async () => {
    try {
      const res = await apiFetch<any[]>('/timesheets', {
        params: {
          startDate: weekStart,
          endDate: weekEnd,
          employeeId: filterEmployeeId || undefined,
          status: filterStatus || undefined,
          priority: filterPriority || undefined,
          visitType: filterVisitType || undefined,
          opportunityStage: filterOpportunity || undefined
        }
      });

      const tasksList = Array.isArray(res) ? res : (res as any).timesheets || [];
      let p = 0, ip = 0, c = 0, can = 0, cf = 0, val = 0;
      tasksList.forEach((t: any) => {
        if (t.status === 'PLANNED') p++;
        else if (t.status === 'IN_PROGRESS') ip++;
        else if (t.status === 'COMPLETED') c++;
        else if (t.status === 'CANCELLED') can++;
        else if (t.status === 'RESCHEDULED') cf++;
        val += Number(t.estimated_value || 0);
      });

      setSummaryData({ planned: p, inProgress: ip, completed: c, cancelled: can, carryForward: cf, pipelineValue: val });
    } catch (err) {
      console.warn('Failed to load summary preview:', err);
    }
  }, [weekStart, weekEnd, filterEmployeeId, filterStatus, filterPriority, filterVisitType, filterOpportunity]);

  useEffect(() => {
    fetchSummaryPreview();
  }, [fetchSummaryPreview]);

  // Trigger Weekly Plan XLSX Download
  const handleGenerateWeeklyPlanXlsx = async () => {
    try {
      setDownloading(true);
      const params = new URLSearchParams({
        startDate: weekStart,
        endDate: weekEnd
      });
      if (filterEmployeeId) params.append('employeeId', filterEmployeeId);
      if (filterStatus) params.append('status', filterStatus);
      if (filterPriority) params.append('priority', filterPriority);
      if (filterVisitType) params.append('visitType', filterVisitType);
      if (filterOpportunity) params.append('opportunityStage', filterOpportunity);

      const downloadUrl = `/timesheets/export-xlsx?${params.toString()}`;
      await apiDownload(downloadUrl);
    } catch (err: any) {
      alert(`Excel Export Failed: ${err.message || 'Error generating workbook'}`);
    } finally {
      setDownloading(false);
    }
  };

  // Archive Weekly Plan
  const handleArchiveWeeklyPlan = async () => {
    try {
      setArchivingWeekly(true);
      await apiFetch('/reports/archives/weekly-plan', {
        method: 'POST',
        body: JSON.stringify({ startDate: weekStart, endDate: weekEnd })
      });
      await fetchArchives();
      alert('Weekly Plan workbook successfully archived to storage!');
    } catch (err: any) {
      alert(`Failed to archive weekly plan: ${err.message || 'Error saving archive'}`);
    } finally {
      setArchivingWeekly(false);
    }
  };

  // Archive Monthly Report
  const handleArchiveMonthlyReport = async () => {
    try {
      setArchivingMonthly(true);
      await apiFetch('/reports/archives/monthly-report', {
        method: 'POST',
        body: JSON.stringify({ year: selectedYear, month: selectedMonth })
      });
      await fetchArchives();
      alert('Monthly Enterprise Report successfully generated and archived!');
    } catch (err: any) {
      alert(`Failed to archive monthly report: ${err.message || 'Error generating archive'}`);
    } finally {
      setArchivingMonthly(false);
    }
  };

  // Download Archived Report
  const handleDownloadArchive = async (archiveId: string, filename: string) => {
    try {
      setDownloadingArchiveId(archiveId);
      const res = await apiFetch<{ downloadUrl: string }>(`/reports/archives/${archiveId}/download`);
      if (res.downloadUrl) {
        window.open(res.downloadUrl, '_blank');
      }
    } catch (err: any) {
      alert(`Download failed: ${err.message || 'Error fetching download link'}`);
    } finally {
      setDownloadingArchiveId(null);
    }
  };

  const monthsList = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            <span>Reports & Archiving Repository</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Enterprise reporting suite, multi-sheet XLSX exports, and private report archives</p>
        </div>

        <button
          onClick={() => apiDownload('/reports/export-csv')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-cyan-400" />
          <span>Export Workforce CSV</span>
        </button>
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={downloading}
              onClick={handleGenerateWeeklyPlanXlsx}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 min-w-[140px] cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Generating...' : 'Download Excel'}</span>
            </button>

            <button
              type="button"
              disabled={archivingWeekly}
              onClick={handleArchiveWeeklyPlan}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 font-bold text-xs rounded-xl transition-all disabled:opacity-50 min-w-[130px] cursor-pointer"
            >
              {archivingWeekly ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              <span>Archive Export</span>
            </button>
          </div>
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

        {/* Filter Controls Grid */}
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter Parameters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Week Range */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Start Date (Monday)</label>
              <input
                type="date"
                value={weekStart}
                onChange={e => setWeekStart(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">End Date (Sunday)</label>
              <input
                type="date"
                value={weekEnd}
                onChange={e => setWeekEnd(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Employee Filter */}
            {!isEmployee ? (
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Assigned Employee</label>
                <select
                  value={filterEmployeeId}
                  onChange={e => setFilterEmployeeId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">All Workforce</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_code})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Scope</label>
                <input
                  type="text"
                  readOnly
                  value="Personal Workspace"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-400 cursor-not-allowed"
                />
              </div>
            )}

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Execution Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Statuses</option>
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="RESCHEDULED">Rescheduled</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: MONTHLY REPORT GENERATION & ARCHIVING */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Monthly Enterprise HRMS Report & Archiving</h2>
              <p className="text-xs text-slate-400">Generates immutable monthly snapshot containing Attendance, Leave, Expenses, Assets, and Field Visits</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(parseInt(e.target.value, 10))}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              {monthsList.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            <input
              type="number"
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
              className="w-20 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
            />

            <button
              type="button"
              disabled={archivingMonthly}
              onClick={handleArchiveMonthlyReport}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {archivingMonthly ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              <span>Generate & Archive Month</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: ARCHIVED REPORTS REPOSITORY TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="font-semibold text-xs text-slate-300 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-cyan-400" />
            <span>Archived Reports & Document Repository ({archives.length})</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Report Name</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Period</th>
                <th className="px-6 py-3">Generated By</th>
                <th className="px-6 py-3">Generated At</th>
                <th className="px-6 py-3">File Size</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {archives.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500 italic">
                    No archived reports stored yet. Click "Archive Export" above to preserve a report snapshot.
                  </td>
                </tr>
              ) : (
                archives.map(arch => (
                  <tr key={arch.id} className="hover:bg-slate-800/40">
                    <td className="px-6 py-3.5 font-bold text-slate-200">{arch.report_name}</td>
                    <td className="px-6 py-3.5 font-mono">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        arch.report_type === 'WEEKLY_PLAN' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}>
                        {arch.report_type}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono">{arch.period_year}-{String(arch.period_month || 1).padStart(2, '0')}</td>
                    <td className="px-6 py-3.5 text-slate-300">{arch.generated_by_name || 'System'}</td>
                    <td className="px-6 py-3.5 font-mono text-slate-400">{new Date(arch.created_at).toLocaleString()}</td>
                    <td className="px-6 py-3.5 font-mono text-slate-400">{(arch.file_size / 1024).toFixed(1)} KB</td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        type="button"
                        disabled={downloadingArchiveId === arch.id}
                        onClick={() => handleDownloadArchive(arch.id, arch.report_name)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: DEPARTMENTAL HEADCOUNT TABLE */}
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
