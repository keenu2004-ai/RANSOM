import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch, apiDownload } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3, Download, Calendar, Filter, FileSpreadsheet,
  CheckCircle2, Clock, PlayCircle, XCircle, ArrowRightLeft, DollarSign, Users, Archive, FileCheck, Loader2, Trash2, AlertTriangle
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

  // State for SUPER_ADMIN Delete Modal
  const [deleteModalArchive, setDeleteModalArchive] = useState<any | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingArchive, setIsDeletingArchive] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Open high-risk confirmation modal
  const handleOpenDeleteModal = (arch: any) => {
    setDeleteModalArchive(arch);
    setDeleteConfirmText('');
    setDeleteErrorMessage(null);
  };

  // Close high-risk modal
  const handleCloseDeleteModal = () => {
    setDeleteModalArchive(null);
    setDeleteConfirmText('');
    setDeleteErrorMessage(null);
  };

  // Perform permanent deletion
  const handlePerformDelete = async () => {
    if (!deleteModalArchive) return;
    if (deleteConfirmText.trim() !== 'DELETE') return;

    try {
      setIsDeletingArchive(true);
      setDeleteErrorMessage(null);

      const targetId = deleteModalArchive.id;
      const res = await apiFetch<{ success: boolean; message: string; archiveId: string }>(
        `/reports/archives/${targetId}`,
        { method: 'DELETE' }
      );

      // Close modal
      handleCloseDeleteModal();

      // Remove archive from local state
      setArchives(prev => prev.filter(a => a.id !== targetId));

      // Show success toast notification
      setDeleteSuccessMessage(res?.message || 'Archived report deleted successfully.');
      setTimeout(() => setDeleteSuccessMessage(null), 5000);
    } catch (err: any) {
      if (err.status === 403) {
        setDeleteErrorMessage('You do not have permission to delete archived reports.');
      } else if (err.status === 404) {
        setDeleteErrorMessage('Archived report no longer exists.');
      } else if (err.code === 'STORAGE_DELETE_FAILED' || (err.message && err.message.includes('storage'))) {
        setDeleteErrorMessage('Could not delete the archived file from storage. The archive was not deleted.');
      } else {
        setDeleteErrorMessage(err.message || 'An error occurred while deleting the report archive.');
      }
    } finally {
      setIsDeletingArchive(false);
    }
  };

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
  const handleDownloadArchive = async (arch: any) => {
    if (arch.storage_status === 'BROKEN' || (!arch.storage_file_id && !arch.object_path)) {
      alert('Archived file is unavailable in storage. Please regenerate this report.');
      return;
    }
    try {
      setDownloadingArchiveId(arch.id);
      const safeName = (arch.report_name || 'Report').replace(/[^a-zA-Z0-9_.-]/g, '_');
      const defaultFilename = `${safeName}.xlsx`;
      await apiDownload(`/reports/archives/${arch.id}/download`, {}, defaultFilename);
    } catch (err: any) {
      if (err.message && (err.message.includes('unavailable') || err.message.includes('not found'))) {
        alert('Archived file is unavailable in storage. Please regenerate this report.');
      } else {
        alert(err.message || 'Unable to download this archived report.');
      }
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
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[var(--color-primary)]" />
            <span>Reports & Archiving Repository</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Enterprise reporting suite, multi-sheet XLSX exports, and private report archives</p>
        </div>

        <button
          onClick={() => apiDownload('/reports/export-csv')}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] text-xs font-semibold rounded-xl border border-[var(--border-default)] transition-all cursor-pointer self-start sm:self-auto shadow-sm"
        >
          <Download className="w-4 h-4 text-[var(--color-primary)]" />
          <span>Export Workforce CSV</span>
        </button>
      </div>

      {/* SECTION 1: WEEKLY WORK & FIELD VISIT EXPORT SYSTEM (CANONICAL XLSX) */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[var(--border-subtle)] pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[var(--color-primary-soft)] border border-[var(--border-subtle)] rounded-xl text-[var(--color-primary)]">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span>Weekly Plan & Field Visit Excel Export</span>
                <span className="px-2 py-0.5 bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/20 text-[10px] font-mono rounded-full font-bold">TRUE .XLSX</span>
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">Generates 6-sheet workbook: Weekly Plan, Executive Summary, Carry Forward, Opportunities, History, & Monthly Tracker</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={downloading}
              onClick={handleGenerateWeeklyPlanXlsx}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 min-w-[140px] cursor-pointer w-full sm:w-auto"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Generating...' : 'Download Excel'}</span>
            </button>

            <button
              type="button"
              disabled={archivingWeekly}
              onClick={handleArchiveWeeklyPlan}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border border-[var(--border-default)] font-semibold text-xs rounded-xl transition-all disabled:opacity-50 min-w-[130px] cursor-pointer w-full sm:w-auto shadow-sm"
            >
              {archivingWeekly ? <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" /> : <Archive className="w-4 h-4 text-[var(--color-primary)]" />}
              <span>Archive Export</span>
            </button>
          </div>
        </div>

        {/* Live Summary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
              <span>Planned</span>
              <Clock className="w-3.5 h-3.5 text-[var(--color-info)]" />
            </div>
            <div className="text-lg font-bold text-[var(--text-primary)] font-mono">{summaryData.planned}</div>
          </div>

          <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
              <span>In Progress</span>
              <PlayCircle className="w-3.5 h-3.5 text-[var(--color-warning)]" />
            </div>
            <div className="text-lg font-bold text-[var(--color-warning)] font-mono">{summaryData.inProgress}</div>
          </div>

          <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
              <span>Completed</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
            </div>
            <div className="text-lg font-bold text-[var(--color-success)] font-mono">{summaryData.completed}</div>
          </div>

          <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
              <span>Cancelled</span>
              <XCircle className="w-3.5 h-3.5 text-[var(--color-danger)]" />
            </div>
            <div className="text-lg font-bold text-[var(--color-danger)] font-mono">{summaryData.cancelled}</div>
          </div>

          <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
              <span>Carry Forward</span>
              <ArrowRightLeft className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            </div>
            <div className="text-lg font-bold text-[var(--color-primary)] font-mono">{summaryData.carryForward}</div>
          </div>

          <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
              <span>Pipeline (₹)</span>
              <DollarSign className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            </div>
            <div className="text-sm font-bold text-[var(--color-primary)] font-mono">₹{summaryData.pipelineValue.toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter Parameters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Week Range */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Start Date (Monday)</label>
              <input
                type="date"
                value={weekStart}
                onChange={e => setWeekStart(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">End Date (Sunday)</label>
              <input
                type="date"
                value={weekEnd}
                onChange={e => setWeekEnd(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>

            {/* Employee Filter */}
            {!isEmployee ? (
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Assigned Employee</label>
                <select
                  value={filterEmployeeId}
                  onChange={e => setFilterEmployeeId(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
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
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Scope</label>
                <input
                  type="text"
                  readOnly
                  value="Personal Workspace"
                  className="w-full bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-muted)] cursor-not-allowed"
                />
              </div>
            )}

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Execution Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
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
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--border-subtle)] pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[var(--color-primary-soft)] border border-[var(--border-subtle)] rounded-xl text-[var(--color-primary)]">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Monthly Enterprise HRMS Report & Archiving</h2>
              <p className="text-xs text-[var(--text-secondary)]">Generates immutable monthly snapshot containing Attendance, Leave, Expenses, Assets, and Field Visits</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(parseInt(e.target.value, 10))}
              className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
            >
              {monthsList.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            <input
              type="number"
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
              className="w-20 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)] font-mono"
            />

            <button
              type="button"
              disabled={archivingMonthly}
              onClick={handleArchiveMonthlyReport}
              className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {archivingMonthly ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              <span>Generate & Archive Month</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: ARCHIVED REPORTS REPOSITORY TABLE */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
          <div className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[var(--color-primary)]" />
            <span>Archived Reports & Document Repository ({archives.length})</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[var(--text-primary)]">
            <thead className="bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] font-semibold uppercase border-b border-[var(--border-default)]">
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
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {archives.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-[var(--text-muted)] italic">
                    No archived reports stored yet. Click "Archive Export" above to preserve a report snapshot.
                  </td>
                </tr>
              ) : (
                archives.map(arch => (
                  <tr key={arch.id} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                    <td className="px-6 py-3.5 font-bold text-[var(--text-primary)]">{arch.report_name}</td>
                    <td className="px-6 py-3.5 font-mono">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--color-primary-soft)] text-[var(--color-primary)] border border-[var(--border-subtle)]">
                        {arch.report_type}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[var(--text-secondary)]">{arch.period_year}-{String(arch.period_month || 1).padStart(2, '0')}</td>
                    <td className="px-6 py-3.5 text-[var(--text-secondary)]">{arch.generated_by_name || 'System'}</td>
                    <td className="px-6 py-3.5 font-mono text-[var(--text-muted)]">{new Date(arch.created_at).toLocaleString()}</td>
                    <td className="px-6 py-3.5 font-mono text-[var(--text-muted)]">{(arch.file_size / 1024).toFixed(1)} KB</td>
                    <td className="px-6 py-3.5 text-right flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={downloadingArchiveId === arch.id}
                        onClick={() => handleDownloadArchive(arch)}
                        className="px-3 py-1.5 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-muted)] disabled:opacity-50 text-[var(--text-primary)] border border-[var(--border-default)] rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                        <span>{downloadingArchiveId === arch.id ? 'Downloading...' : 'Download'}</span>
                      </button>

                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(arch)}
                          className="px-3 py-1.5 bg-[var(--color-danger-soft)] hover:bg-[var(--color-danger)]/20 text-[var(--color-danger)] border border-[var(--color-danger)]/30 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {deleteSuccessMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--bg-surface-elevated)] border border-[var(--color-success)] text-[var(--color-success)] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-[var(--color-success)] shrink-0" />
          <span className="text-xs font-semibold">{deleteSuccessMessage}</span>
        </div>
      )}

      {/* HIGH-RISK CONFIRMATION MODAL FOR SUPER_ADMIN DELETION */}
      {deleteModalArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/20 rounded-xl text-[var(--color-danger)] shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[var(--text-primary)]">Delete Archived Report Permanently?</h3>
                <p className="text-xs text-[var(--color-danger)] font-medium">
                  This permanently deletes the archived report from Google Drive and removes its archive record from Theiakshi. This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Error banner inside modal */}
            {deleteErrorMessage && (
              <div className="bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-xl p-3 text-xs text-[var(--color-danger)]">
                {deleteErrorMessage}
              </div>
            )}

            {/* Archive Details */}
            <div className="bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)] font-semibold">Report Name</span>
                <span className="text-[var(--text-primary)] font-bold max-w-[220px] truncate">{deleteModalArchive.report_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)] font-semibold">Report Type</span>
                <span className="text-[var(--color-primary)] font-mono font-bold">{deleteModalArchive.report_type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)] font-semibold">Period</span>
                <span className="text-[var(--text-primary)] font-mono">{deleteModalArchive.period_year}-{String(deleteModalArchive.period_month || 1).padStart(2, '0')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)] font-semibold">Generated By</span>
                <span className="text-[var(--text-primary)]">{deleteModalArchive.generated_by_name || 'System'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)] font-semibold">Generated At</span>
                <span className="text-[var(--text-muted)] font-mono">{new Date(deleteModalArchive.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[var(--text-secondary)] font-semibold">File Size</span>
                <span className="text-[var(--text-muted)] font-mono">{(deleteModalArchive.file_size / 1024).toFixed(1)} KB</span>
              </div>
            </div>

            {/* Required Input Confirmation */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                Type <span className="text-[var(--color-danger)] font-mono font-bold">DELETE</span> to confirm permanent removal:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--color-danger)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                disabled={isDeletingArchive}
                className="px-4 py-2 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl border border-[var(--border-default)] transition-all cursor-pointer shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText.trim() !== 'DELETE' || isDeletingArchive}
                onClick={handlePerformDelete}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-danger)] hover:opacity-90 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                {isDeletingArchive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: DEPARTMENTAL HEADCOUNT TABLE */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
          <div className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--color-primary)]" />
            <span>Departmental Workforce Headcount Distribution</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[var(--text-primary)]">
            <thead className="bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] font-semibold uppercase border-b border-[var(--border-default)]">
              <tr>
                <th className="px-6 py-3">Department</th>
                <th className="px-6 py-3">Total Active Headcount</th>
                <th className="px-6 py-3">Full Time</th>
                <th className="px-6 py-3">Contract / Intern</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {report.map((r, idx) => (
                <tr key={idx} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                  <td className="px-6 py-3.5 font-bold text-[var(--text-primary)]">{r.department || 'General Admin'}</td>
                  <td className="px-6 py-3.5 font-mono text-[var(--color-primary)] font-bold">{r.total_employees}</td>
                  <td className="px-6 py-3.5 font-mono text-[var(--text-secondary)]">{r.full_time}</td>
                  <td className="px-6 py-3.5 font-mono text-[var(--text-secondary)]">{r.contract}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
