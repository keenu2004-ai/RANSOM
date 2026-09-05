import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch, apiDownload } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import {
  FileText, Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Edit3, Trash2, X,
  CheckCircle2, Clock, AlertTriangle, Download, ArrowRight, MapPin, Phone, Mail,
  Target, Briefcase, Calendar, AlertCircle, Send, Hourglass, Check, ListFilter, LayoutGrid, Table
} from 'lucide-react';
import {
  normalizeDateOnly, formatDateOnly, displayDateOnly, addCalendarDays, getMondayOfWeek, getMondayOfWeekStr, parseDateOnlyToLocal
} from '../utils/dateUtils';

export const Timesheets: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [pendingCarryForward, setPendingCarryForward] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View Mode: 'week' | 'month' | 'list'
  const [activeView, setActiveView] = useState<'week' | 'month' | 'list'>('week');

  // Filter states (Specific to Weekly Plan only)
  const [filterVisitType, setFilterVisitType] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterOpportunity, setFilterOpportunity] = useState<string>('');
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('');

  // Active Week Date State (Reference Monday Date String "YYYY-MM-DD")
  const [selectedMondayStr, setSelectedMondayStr] = useState<string>(() => getMondayOfWeekStr());

  // Active Month State for Month View
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(() => new Date());

  // Overflow Popover / Modal for Month View
  const [overflowModalData, setOverflowModalData] = useState<{ dateStr: string; displayLabel: string; plans: any[] } | null>(null);

  // Task Create & Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    assignedEmployeeId: '',
    title: '',
    description: '',
    date: normalizeDateOnly(new Date()),
    hours: 8,
    status: 'PLANNED',
    customerName: '',
    contactPerson: '',
    contactDetails: '',
    visitLocation: '',
    visitType: 'New Prospect',
    timeSlot: '10:00-11:00',
    productsToPresent: '',
    visitObjective: '',
    outcomeSummary: '',
    nextAction: '',
    followUpDate: '',
    opportunityStage: 'No Requirement',
    estimatedValue: 0,
    priority: 'MEDIUM',
    cancellationReason: ''
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Reschedule Modal
  const [rescheduleTaskItem, setRescheduleTaskItem] = useState<any | null>(null);
  const [rescheduleNewDate, setRescheduleNewDate] = useState<string>('');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');
  const [rescheduling, setRescheduling] = useState(false);

  const isManagement = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '');

  // Week Days Array (Monday -> Sunday)
  const weekDays = useMemo(() => {
    const days = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const baseMondayStr = normalizeDateOnly(selectedMondayStr) || getMondayOfWeekStr();
    for (let i = 0; i < 7; i++) {
      const dateStr = addCalendarDays(baseMondayStr, i);
      const localDate = parseDateOnlyToLocal(dateStr);
      const dayNumStr = String(localDate.getDate()).padStart(2, '0');
      const monthShort = localDate.toLocaleString('en-US', { month: 'short' });
      days.push({
        shortName: dayNames[i],
        fullName: fullDayNames[i],
        date: localDate,
        dateStr: dateStr,
        dayNumStr: dayNumStr,
        displayLabel: `${dayNumStr} ${monthShort}`
      });
    }
    return days;
  }, [selectedMondayStr]);

  // Month Days Grid (Sunday -> Saturday)
  const monthCalendarGrid = useMemo(() => {
    const year = selectedMonthDate.getFullYear();
    const month = selectedMonthDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun
    const daysInMonth = lastDayOfMonth.getDate();

    const grid = [];
    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const pDay = prevMonthLastDay - i;
      const d = new Date(year, month - 1, pDay);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(pDay).padStart(2, '0');
      grid.push({
        date: d,
        dateStr: `${yStr}-${mStr}-${dStr}`,
        dayNum: pDay,
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const yStr = d.getFullYear();
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(i).padStart(2, '0');
      grid.push({
        date: d,
        dateStr: `${yStr}-${mStr}-${dStr}`,
        dayNum: i,
        isCurrentMonth: true
      });
    }

    // Next month padding days to complete 35 or 42 grid cells
    const remaining = (7 - (grid.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(i).padStart(2, '0');
      grid.push({
        date: d,
        dateStr: `${yStr}-${mStr}-${dStr}`,
        dayNum: i,
        isCurrentMonth: false
      });
    }

    return grid;
  }, [selectedMonthDate]);

  const handlePrevWeek = () => {
    setSelectedMondayStr(prev => addCalendarDays(prev, -7));
  };

  const handleNextWeek = () => {
    setSelectedMondayStr(prev => addCalendarDays(prev, 7));
  };

  const handleThisWeek = () => {
    setSelectedMondayStr(getMondayOfWeekStr());
    setSelectedMonthDate(new Date());
  };

  const handlePrevMonth = () => {
    setSelectedMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      let startDate = weekDays[0].dateStr;
      let endDate = weekDays[6].dateStr;

      if (activeView === 'month') {
        startDate = monthCalendarGrid[0].dateStr;
        endDate = monthCalendarGrid[monthCalendarGrid.length - 1].dateStr;
      } else if (activeView === 'list') {
        const y = selectedMonthDate.getFullYear();
        const m = selectedMonthDate.getMonth();
        startDate = normalizeDateOnly(new Date(y, m, 1))!;
        endDate = normalizeDateOnly(new Date(y, m + 1, 0))!;
      }

      const [taskRes, pendingRes, empRes] = await Promise.all([
        apiFetch('/timesheets', {
          params: {
            startDate,
            endDate,
            assignedEmployeeId: filterEmployeeId || undefined,
            status: filterStatus || undefined,
            visitType: filterVisitType || undefined,
            priority: filterPriority || undefined,
            opportunityStage: filterOpportunity || undefined
          }
        }).catch(() => null),
        apiFetch('/timesheets/pending-carry-forward', { params: { beforeDate: startDate } }).catch(() => null),
        isManagement ? apiFetch('/employees').catch(() => []) : Promise.resolve([])
      ]);

      const rawTasks = Array.isArray(taskRes) ? taskRes : (taskRes?.tasks || taskRes?.timesheets || taskRes?.data?.tasks || []);
      setTasks(rawTasks);

      const rawPending = pendingRes?.tasks || pendingRes?.data?.tasks || [];
      setPendingCarryForward(rawPending);

      const fetchedEmps = Array.isArray(empRes) ? empRes : (empRes?.employees || empRes?.data || []);
      setEmployees(fetchedEmps);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [weekDays, monthCalendarGrid, activeView, selectedMonthDate, isManagement, filterEmployeeId, filterStatus, filterVisitType, filterPriority, filterOpportunity]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const openCreateModalForDate = (dateStr: string) => {
    setEditingTask(null);
    setModalStep(1);
    const defaultEmpId = user?.employeeId || (employees.length > 0 ? employees[0].id : '');
    setFormData({
      assignedEmployeeId: defaultEmpId,
      title: '',
      description: '',
      date: normalizeDateOnly(dateStr) || normalizeDateOnly(new Date()),
      hours: 8,
      status: 'PLANNED',
      customerName: '',
      contactPerson: '',
      contactDetails: '',
      visitLocation: '',
      visitType: 'New Prospect',
      timeSlot: '10:00 - 11:00',
      productsToPresent: '',
      visitObjective: '',
      outcomeSummary: '',
      nextAction: '',
      followUpDate: '',
      opportunityStage: 'No Requirement',
      estimatedValue: 0,
      priority: 'MEDIUM',
      cancellationReason: ''
    });
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (task: any) => {
    setEditingTask(task);
    setModalStep(1);
    setFormData({
      assignedEmployeeId: task.assigned_employee_id || '',
      title: task.title || task.description || '',
      description: task.description || '',
      date: normalizeDateOnly(task.date),
      hours: task.hours || 8,
      status: task.status || 'PLANNED',
      customerName: task.customer_name || '',
      contactPerson: task.contact_person || '',
      contactDetails: task.contact_details || '',
      visitLocation: task.visit_location || '',
      visitType: task.visit_type || 'New Prospect',
      timeSlot: task.time_slot || '10:00 - 11:00',
      productsToPresent: task.products_to_present || '',
      visitObjective: task.visit_objective || '',
      outcomeSummary: task.outcome_summary || '',
      nextAction: task.next_action || '',
      followUpDate: normalizeDateOnly(task.follow_up_date) || '',
      opportunityStage: task.opportunity_stage || 'No Requirement',
      estimatedValue: task.estimated_value ? Number(task.estimated_value) : 0,
      priority: task.priority || 'MEDIUM',
      cancellationReason: task.cancellation_reason || ''
    });
    setFormError(null);
    setShowModal(true);
  };

  const openRescheduleModal = (task: any) => {
    setRescheduleTaskItem(task);
    const tomorrowStr = addCalendarDays(normalizeDateOnly(new Date()), 1);
    setRescheduleNewDate(tomorrowStr);
    setRescheduleReason('Rescheduled for customer follow-up');
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTaskItem || !rescheduleNewDate) return;

    setRescheduling(true);
    try {
      await apiFetch(`/timesheets/${rescheduleTaskItem.id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({
          newDate: rescheduleNewDate,
          reason: rescheduleReason
        })
      });
      setRescheduleTaskItem(null);
      await fetchTasks();
    } catch (err: any) {
      alert(err.message || 'Failed to reschedule task.');
    } finally {
      setRescheduling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.title || formData.title.trim() === '') {
      setFormError('Task Title / Objective is required.');
      setModalStep(1);
      return;
    }

    const payload = {
      ...formData,
      description: formData.description ? formData.description.trim() : ''
    };
    if (isManagement && (!payload.assignedEmployeeId || payload.assignedEmployeeId.trim() === '')) {
      if (employees.length > 0) {
        payload.assignedEmployeeId = employees[0].id;
      }
    }

    try {
      if (editingTask) {
        await apiFetch(`/timesheets/${editingTask.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/timesheets', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      setShowModal(false);
      await fetchTasks();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save task entry.');
    }
  };

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await apiFetch(`/timesheets/${taskId}`, { method: 'DELETE' });
      await fetchTasks();
    } catch (err: any) {
      alert(err.message || 'Failed to delete task.');
    }
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const startDate = weekDays[0].dateStr;
      const endDate = weekDays[6].dateStr;

      await apiDownload('/timesheets/export', {
        params: {
          startDate,
          endDate,
          assignedEmployeeId: filterEmployeeId || undefined,
          status: filterStatus || undefined,
          visitType: filterVisitType || undefined,
          priority: filterPriority || undefined,
          opportunityStage: filterOpportunity || undefined
        }
      }, `THEIAKSHI_Weekly_Plan_${startDate}_to_${endDate}.xlsx`);
    } catch (err: any) {
      alert(err.message || 'Unable to download Weekly Plan export.');
    } finally {
      setDownloading(false);
    }
  };

  // Active KPI Card Filter ('TOTAL' | 'SCHEDULED' | 'PENDING_FOLLOWUP' | 'COMPLETED')
  const [activeKpiFilter, setActiveKpiFilter] = useState<'TOTAL' | 'SCHEDULED' | 'PENDING_FOLLOWUP' | 'COMPLETED'>('TOTAL');

  // Dynamic Weekly Plan Specific KPIs
  const kpis = useMemo(() => {
    const totalPlans = tasks.length;
    const scheduledVisits = tasks.filter(t => t.visit_type || t.customer_name || t.time_slot).length;
    const pendingFollowUps = tasks.filter(t =>
      (t.follow_up_date || t.next_action || ['PLANNED', 'IN_PROGRESS'].includes(t.status)) &&
      t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
    ).length;
    const completed = tasks.filter(t => t.status === 'COMPLETED').length;

    return { totalPlans, scheduledVisits, pendingFollowUps, completed };
  }, [tasks]);

  // Filtered tasks based on active KPI card
  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (activeKpiFilter === 'SCHEDULED') {
      list = list.filter(t => t.visit_type || t.customer_name || t.time_slot);
    } else if (activeKpiFilter === 'PENDING_FOLLOWUP') {
      list = list.filter(t =>
        (t.follow_up_date || t.next_action || ['PLANNED', 'IN_PROGRESS'].includes(t.status)) &&
        t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
      );
    } else if (activeKpiFilter === 'COMPLETED') {
      list = list.filter(t => t.status === 'COMPLETED');
    }

    // Sort newest-first (created_at DESC, id DESC)
    return [...list].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (bTime !== aTime) {
        return bTime - aTime;
      }
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }, [tasks, activeKpiFilter]);

  // Group filtered tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    filteredTasks.forEach(t => {
      const dKey = normalizeDateOnly(t.date);
      if (dKey) {
        if (!map.has(dKey)) map.set(dKey, []);
        map.get(dKey)!.push(t);
      }
    });
    return map;
  }, [filteredTasks]);

  // Formatted Date Header string: e.g. "31 Aug – 06 Sep 2026"
  const dateRangeDisplay = useMemo(() => {
    if (activeView === 'month' || activeView === 'list') {
      return selectedMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    }
    const dStart = parseDateOnlyToLocal(weekDays[0].dateStr);
    const dEnd = parseDateOnlyToLocal(weekDays[6].dateStr);
    const startStr = `${String(dStart.getDate()).padStart(2, '0')} ${dStart.toLocaleString('en-US', { month: 'short' })}`;
    const endStr = `${String(dEnd.getDate()).padStart(2, '0')} ${dEnd.toLocaleString('en-US', { month: 'short' })} ${dEnd.getFullYear()}`;
    return `${startStr} – ${endStr}`;
  }, [weekDays, activeView, selectedMonthDate]);

  const todayStr = normalizeDateOnly(new Date());

  // Card Left Border Accents
  const getCardAccentColor = (index: number, status: string) => {
    if (status === 'COMPLETED') return 'border-l-[var(--primary)] hover:border-l-[var(--primary)]';
    if (status === 'IN_PROGRESS') return 'border-l-[var(--primary)] hover:border-l-[var(--primary)]';
    if (status === 'CANCELLED') return 'border-l-rose-500 hover:border-l-rose-400';
    const accents = ['border-l-[var(--primary)]', 'border-l-[var(--primary)]', 'border-l-[var(--primary)]', 'border-l-[var(--badge-success-border)]'];
    return accents[index % accents.length];
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[var(--primary)]/20 text-[var(--secondary)] rounded-2xl border border-[var(--primary)]/30 shadow-xs">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">Weekly Plan</h1>
            <p className="text-xs text-[var(--text-secondary)]">Plan, track and manage employee customer visits and tasks for the selected period.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View Switcher: [Month] [Week] [List] */}
          <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-default)] p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveView('month')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeView === 'month' ? 'bg-[var(--primary)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setActiveView('week')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeView === 'week' ? 'bg-[var(--primary)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeView === 'list' ? 'bg-[var(--primary)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              List
            </button>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-1 shadow-inner">
            <button
              onClick={activeView === 'week' ? handlePrevWeek : handlePrevMonth}
              className="p-1.5 text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-surface-muted)] rounded-lg transition-all"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleThisWeek}
              className="px-2.5 py-1 text-xs font-semibold text-[var(--secondary)] hover:text-[var(--secondary)] rounded-lg transition-all"
            >
              Today
            </button>

            <div className="px-3 text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[var(--secondary)]" />
              <span>{dateRangeDisplay}</span>
            </div>

            <button
              onClick={activeView === 'week' ? handleNextWeek : handleNextMonth}
              className="p-1.5 text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-surface-muted)] rounded-lg transition-all"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            disabled={downloading}
            onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border border-[var(--border-default)] font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
            title="Export Weekly Plan to Excel"
          >
            <Download className="w-4 h-4 text-[var(--primary)]" />
            <span>{downloading ? 'Downloading...' : 'Export'}</span>
          </button>

          {/* Add Plan Primary Button */}
          <button
            onClick={() => openCreateModalForDate(todayStr || weekDays[0].dateStr)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-semibold text-xs rounded-xl shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Plan</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row (4 Cards Only - Weekly Plan Specific Filter Controls) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL PLANS */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Filter by Total Plans"
          onClick={() => setActiveKpiFilter('TOTAL')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveKpiFilter('TOTAL'); }}
          className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none flex items-center justify-between group ${
            activeKpiFilter === 'TOTAL'
              ? 'bg-[var(--bg-surface)] border-[var(--primary)]/80 ring-2 ring-1 ring-[var(--primary)]/30 shadow-xs scale-[1.01]'
              : 'bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--primary)]/30 hover:bg-[var(--bg-surface)]'
          }`}
        >
          <div className="space-y-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--primary)]">Total Plans</span>
            <div className="text-2xl font-extrabold text-white">{kpis.totalPlans}</div>
            <div className="text-[11px] text-[var(--text-secondary)]">Selected period</div>
          </div>
          <div className={`p-3 rounded-xl border transition-colors ${
            activeKpiFilter === 'TOTAL'
              ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]'
              : 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30 group-hover:bg-[var(--primary)] group-hover:text-[var(--primary-text)]'
          }`}>
            <CalendarIcon className="w-6 h-6" />
          </div>
        </div>

        {/* SCHEDULED VISITS */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Filter by Scheduled Visits"
          onClick={() => setActiveKpiFilter('SCHEDULED')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveKpiFilter('SCHEDULED'); }}
          className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none flex items-center justify-between group ${
            activeKpiFilter === 'SCHEDULED'
              ? 'bg-[var(--bg-surface)] border-[var(--badge-success-border)] ring-2 ring-1 ring-[var(--primary)]/30 shadow-xs scale-[1.01]'
              : 'bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--badge-success-border)] hover:bg-[var(--bg-surface)]'
          }`}
        >
          <div className="space-y-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--badge-success-text)]">Scheduled Visits</span>
            <div className="text-2xl font-extrabold text-white">{kpis.scheduledVisits}</div>
            <div className="text-[11px] text-[var(--text-secondary)]">Customer meetings</div>
          </div>
          <div className={`p-3 rounded-xl border transition-colors ${
            activeKpiFilter === 'SCHEDULED'
              ? 'bg-[var(--badge-success-bg)] text-[var(--primary-text)] border-[var(--badge-success-border)]'
              : 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border-[var(--badge-success-border)] group-hover:bg-[var(--badge-success-bg)] group-hover:text-[var(--primary-text)]'
          }`}>
            <Send className="w-6 h-6" />
          </div>
        </div>

        {/* PENDING FOLLOW-UPS */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Filter by Pending Follow-ups"
          onClick={() => setActiveKpiFilter('PENDING_FOLLOWUP')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveKpiFilter('PENDING_FOLLOWUP'); }}
          className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none flex items-center justify-between group ${
            activeKpiFilter === 'PENDING_FOLLOWUP'
              ? 'bg-[var(--bg-surface)] border-[var(--badge-warning-border)] ring-2 ring-1 ring-[var(--primary)]/30 shadow-xs scale-[1.01]'
              : 'bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--badge-warning-border)] hover:bg-[var(--bg-surface)]'
          }`}
        >
          <div className="space-y-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--badge-warning-text)]">Pending Follow-ups</span>
            <div className="text-2xl font-extrabold text-white">{kpis.pendingFollowUps}</div>
            <div className="text-[11px] text-[var(--text-secondary)]">Action required</div>
          </div>
          <div className={`p-3 rounded-xl border transition-colors ${
            activeKpiFilter === 'PENDING_FOLLOWUP'
              ? 'bg-[var(--badge-warning-bg)] text-[var(--primary-text)] border-[var(--badge-warning-border)]'
              : 'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border-[var(--badge-warning-border)] group-hover:bg-[var(--badge-warning-bg)] group-hover:text-[var(--primary-text)]'
          }`}>
            <Hourglass className="w-6 h-6" />
          </div>
        </div>

        {/* COMPLETED */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Filter by Completed Plans"
          onClick={() => setActiveKpiFilter('COMPLETED')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveKpiFilter('COMPLETED'); }}
          className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none flex items-center justify-between group ${
            activeKpiFilter === 'COMPLETED'
              ? 'bg-[var(--bg-surface)] border-[var(--primary)]/30 ring-2 ring-1 ring-[var(--primary)]/30 shadow-xs scale-[1.01]'
              : 'bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--primary)]/30 hover:bg-[var(--bg-surface)]'
          }`}
        >
          <div className="space-y-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--secondary)]">Completed</span>
            <div className="text-2xl font-extrabold text-white">{kpis.completed}</div>
            <div className="text-[11px] text-[var(--text-secondary)]">Marked as completed</div>
          </div>
          <div className={`p-3 rounded-xl border transition-colors ${
            activeKpiFilter === 'COMPLETED'
              ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
              : 'bg-[var(--secondary)]/15 text-[var(--secondary)] border-[var(--primary)]/30 group-hover:bg-[var(--primary)] group-hover:text-white'
          }`}>
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Carried Forward Pending Work Banner */}
      {pendingCarryForward.length > 0 && (
        <div className="p-4 bg-[var(--badge-warning-bg)] border border-[var(--badge-warning-border)] rounded-2xl space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--badge-warning-border)] pb-2">
            <div className="flex items-center gap-2 text-[var(--badge-warning-text)] font-bold text-xs">
              <AlertCircle className="w-4 h-4 text-[var(--badge-warning-text)]" />
              <span>CARRIED FORWARD — {pendingCarryForward.length} PENDING ITEMS FROM PREVIOUS WEEKS</span>
            </div>
            <span className="text-[10px] text-[var(--badge-warning-text)]/80 font-medium">Require Action: Complete, Cancel, or Reschedule</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {pendingCarryForward.map(item => (
              <div key={item.id} className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--badge-warning-border)] rounded-xl space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-[var(--text-heading)] block">{item.title}</span>
                    {item.assigned_employee_name && (
                      <span className="text-[var(--primary)] text-[11px] font-semibold block">
                        Employee: {item.assigned_employee_name}
                      </span>
                    )}
                    {item.customer_name && <span className="text-[var(--badge-warning-text)] text-[11px] font-semibold block">Customer: {item.customer_name}</span>}
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border border-[var(--badge-warning-border)]">
                    {item.date}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-default)]">
                  <button
                    onClick={() => openEditModal(item)}
                    className="px-2.5 py-1 bg-[var(--badge-success-bg)] hover:bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border border-[var(--badge-success-border)] rounded-lg text-[10px] font-semibold"
                  >
                    Complete
                  </button>
                  <button
                    onClick={() => openRescheduleModal(item)}
                    className="px-2.5 py-1 bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30 rounded-lg text-[10px] font-semibold flex items-center gap-1"
                  >
                    <span>Reschedule</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1. WEEK VIEW (MON - SUN) */}
      {activeView === 'week' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {weekDays.map((day, idx) => {
            const isToday = day.dateStr === todayStr;
            const dayTasks = tasksByDate.get(day.dateStr) || [];

            return (
              <div
                key={idx}
                className={`rounded-2xl border transition-all flex flex-col justify-between min-h-[360px] overflow-hidden ${
                  isToday
                    ? 'bg-[var(--bg-surface)] border-[var(--primary)]/30 shadow-xs ring-1 ring-1 ring-[var(--primary)]/30'
                    : 'bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--border-default)]'
                }`}
              >
                {/* Day Header */}
                <div className={`p-2.5 sm:p-3 border-b flex items-center justify-between ${
                  isToday ? 'bg-[var(--secondary)]/15 border-[var(--primary)]/30' : 'bg-[var(--bg-surface-muted)] border-[var(--border-default)]'
                }`}>
                  <div className="space-y-0.5 text-left">
                    <div className={`text-xs font-extrabold uppercase tracking-wide ${isToday ? 'text-[var(--secondary)]' : 'text-[var(--text-secondary)]'}`}>
                      {day.shortName}
                    </div>
                    <div className={`text-sm font-bold ${isToday ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                      {day.dayNumStr} {day.date.toLocaleString('en-US', { month: 'short' })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openCreateModalForDate(day.dateStr); }}
                    className="p-1.5 bg-[var(--secondary)]/15 hover:bg-[var(--primary)]/30 text-[var(--secondary)] hover:text-white border border-[var(--primary)]/30 rounded-lg transition-all text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    title={`Add new plan for ${day.displayLabel}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Add</span>
                  </button>
                </div>

                {/* Day Plans List */}
                <div className="p-2.5 flex-1 space-y-2 overflow-y-auto max-h-[480px]">
                  {dayTasks.map((t, tIdx) => (
                    <div
                      key={t.id || tIdx}
                      onClick={() => openEditModal(t)}
                      className={`p-3 bg-[var(--bg-surface-muted)] border-l-4 ${getCardAccentColor(tIdx, t.status)} border-y border-r border-[var(--border-default)] hover:border-[var(--border-default)] rounded-xl space-y-2 cursor-pointer transition-all shadow-md group relative`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-secondary)]">
                        <span>{t.time_slot || '10:00 - 11:00'}</span>
                        <button
                          onClick={(e) => handleDeleteTask(t.id, e)}
                          className="text-[var(--text-muted)] hover:text-[var(--action-danger-bg)] p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete Plan"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {t.customer_name && (
                        <div className="font-bold text-[var(--text-heading)] text-xs line-clamp-1">
                          {t.customer_name}
                        </div>
                      )}

                      {t.visit_location && (
                        <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                          <span className="truncate">{t.visit_location}</span>
                        </div>
                      )}

                      <div className="text-[11px] text-[var(--text-primary)] font-medium line-clamp-2">
                        {t.title || t.visit_objective || 'Customer Meeting'}
                      </div>

                      <div className="pt-1 flex items-center justify-between border-t border-[var(--border-default)]">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider ${
                          t.status === 'COMPLETED' ? 'bg-[var(--primary)]/20 text-[var(--secondary)] border border-[var(--primary)]/30' :
                          t.status === 'IN_PROGRESS' ? 'bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30' :
                          t.status === 'CANCELLED' ? 'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border border-[var(--action-danger-bg)]/30' :
                          'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border border-[var(--border-default)]'
                        }`}>
                          {t.status === 'PLANNED' ? 'Planned' : t.status || 'Planned'}
                        </span>

                        {t.assigned_employee_name && (
                          <span className="text-[9px] text-[var(--text-secondary)] font-semibold truncate max-w-[80px]">
                            {t.assigned_employee_name.split(' ')[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {dayTasks.length === 0 && (
                    <div className="h-full min-h-[220px] flex flex-col items-center justify-center p-4 text-center border-2 border-dashed border-[var(--border-default)] rounded-xl space-y-2 bg-[var(--bg-surface-muted)]">
                      <CalendarIcon className="w-7 h-7 text-[var(--text-muted)]" />
                      <span className="text-xs text-[var(--text-secondary)] font-medium">No plans for this day</span>
                      <button
                        onClick={() => openCreateModalForDate(day.dateStr)}
                        className="mt-1 flex items-center gap-1 px-3 py-1 bg-[var(--secondary)]/15 hover:bg-[var(--primary)]/20 text-[var(--secondary)] border border-[var(--primary)]/30 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Plan</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Day Column Footer Add Action for Occupied Days */}
                {dayTasks.length > 0 && (
                  <div className="p-2 border-t border-[var(--border-default)] bg-[var(--bg-surface-muted)]">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openCreateModalForDate(day.dateStr); }}
                      className="w-full py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--secondary)]/15 border border-[var(--border-default)] hover:border-[var(--primary)]/30 text-[var(--text-primary)] hover:text-[var(--secondary)] rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                      title={`Add another plan for ${day.displayLabel}`}
                    >
                      <Plus className="w-3.5 h-3.5 text-[var(--secondary)]" />
                      <span>Add Plan</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 2. MONTH VIEW (SUN - SAT GRID) */}
      {activeView === 'month' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-extrabold uppercase tracking-wider text-[var(--secondary)] border-b border-[var(--border-default)] pb-3">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {monthCalendarGrid.map((cell, cIdx) => {
              const dayPlans = tasksByDate.get(cell.dateStr) || [];
              const isToday = cell.dateStr === todayStr;

              return (
                <div
                  key={cIdx}
                  onClick={() => openCreateModalForDate(cell.dateStr)}
                  className={`min-h-[110px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                    !cell.isCurrentMonth
                      ? 'bg-[var(--bg-surface-muted)] border-[var(--border-default)] text-[var(--text-muted)] opacity-40'
                      : isToday
                      ? 'bg-[var(--secondary)]/15 border-[var(--primary)]/30 shadow-md shadow-xs ring-1 ring-1 ring-[var(--primary)]/30'
                      : 'bg-[var(--bg-surface-muted)] border-[var(--border-default)] hover:bg-[var(--bg-surface-muted)] hover:border-[var(--border-default)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
                      isToday ? 'bg-[var(--primary)] text-white font-extrabold' : 'text-[var(--text-primary)]'
                    }`}>
                      {cell.dayNum}
                    </span>

                    <div className="flex items-center gap-1">
                      {dayPlans.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--primary)]/20 text-[var(--secondary)]">
                          {dayPlans.length} {dayPlans.length === 1 ? 'plan' : 'plans'}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openCreateModalForDate(cell.dateStr); }}
                        className="p-1 bg-[var(--secondary)]/15 hover:bg-[var(--primary)]/30 text-[var(--secondary)] hover:text-white border border-[var(--primary)]/30 rounded-lg text-[10px] transition-all cursor-pointer"
                        title={`Add new plan for ${cell.dateStr}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Plan Snippets (Max 2 cards) */}
                  <div className="space-y-1 my-1">
                    {dayPlans.slice(0, 2).map((p, pIdx) => (
                      <div
                        key={p.id || pIdx}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(p);
                        }}
                        className="px-2 py-1 bg-[var(--bg-surface)] border-l-2 border-[var(--primary)] border-[var(--border-default)] hover:border-[var(--primary)] rounded text-[10px] truncate transition-all"
                      >
                        <span className="font-bold text-[var(--text-heading)]">{p.customer_name || p.title}</span>
                      </div>
                    ))}
                  </div>

                  {/* Overflow button "+N more" */}
                  {dayPlans.length > 2 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOverflowModalData({
                          dateStr: cell.dateStr,
                          displayLabel: `${cell.dayNum} ${cell.date.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`,
                          plans: dayPlans
                        });
                      }}
                      className="text-[10px] font-bold text-[var(--secondary)] hover:text-[var(--secondary)] text-left pt-0.5"
                    >
                      +{dayPlans.length - 2} more...
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. LIST VIEW (TABULAR FORMAT) */}
      {activeView === 'list' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Table className="w-4 h-4 text-[var(--secondary)]" />
                <span>
                  {activeKpiFilter === 'TOTAL' && `All Plans (${filteredTasks.length})`}
                  {activeKpiFilter === 'SCHEDULED' && `Scheduled Visit Records (${filteredTasks.length})`}
                  {activeKpiFilter === 'PENDING_FOLLOWUP' && `Pending Follow-up Records (${filteredTasks.length})`}
                  {activeKpiFilter === 'COMPLETED' && `Completed Plans (${filteredTasks.length})`}
                </span>
              </h3>
              {activeKpiFilter !== 'TOTAL' && (
                <button
                  type="button"
                  onClick={() => setActiveKpiFilter('TOTAL')}
                  className="px-2.5 py-1 text-[11px] font-medium bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded-lg transition-all border border-[var(--border-default)]"
                >
                  Clear Filter (Show All)
                </button>
              )}
            </div>
            <span className="text-xs text-[var(--text-secondary)] font-mono">Sorted Newest First</span>
          </div>

          <div className="overflow-x-auto border border-[var(--border-default)] rounded-2xl">
            <table className="w-full text-left text-xs text-[var(--text-primary)]">
              <thead className="bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] uppercase font-semibold text-[10px] border-b border-[var(--border-default)]">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Plan / Visit</th>
                  <th className="p-3">Customer / Location</th>
                  <th className="p-3">Opportunity Stage</th>
                  <th className="p-3">Follow-Up Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredTasks.map((t, idx) => (
                  <tr key={t.id || idx} className="hover:bg-[var(--bg-surface-muted)]">
                    <td className="p-3 font-mono font-bold text-[var(--secondary)]">{t.date}</td>
                    <td className="p-3 font-semibold text-[var(--text-primary)]">{t.assigned_employee_name || 'Self'}</td>
                    <td className="p-3 font-bold text-white max-w-[200px] truncate">{t.title}</td>
                    <td className="p-3 text-[var(--text-primary)] max-w-[200px] truncate">
                      <div>{t.customer_name || '—'}</div>
                      {t.visit_location && <span className="text-[10px] text-[var(--text-muted)]">{t.visit_location}</span>}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--secondary)]/15 text-[var(--secondary)] border border-[var(--primary)]/30">
                        {t.opportunity_stage || 'No Requirement'}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[var(--text-secondary)]">{t.follow_up_date || '—'}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        t.status === 'COMPLETED' ? 'bg-[var(--primary)]/20 text-[var(--secondary)] border-[var(--primary)]/30' :
                        t.status === 'IN_PROGRESS' ? 'bg-[var(--primary)]/20 text-[var(--primary)] border-[var(--primary)]/30' :
                        t.status === 'CANCELLED' ? 'bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border-[var(--action-danger-bg)]/30' :
                        'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border-[var(--border-default)]'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button onClick={() => openEditModal(t)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--secondary)]" title="Edit Plan">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => openRescheduleModal(t)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--primary)]" title="Reschedule">
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => handleDeleteTask(t.id, e)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--action-danger-bg)]" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[var(--text-muted)] italic">
                      {activeKpiFilter === 'SCHEDULED' && 'No scheduled visit records found.'}
                      {activeKpiFilter === 'PENDING_FOLLOWUP' && 'No pending follow-ups found.'}
                      {activeKpiFilter === 'COMPLETED' && 'No completed plans yet.'}
                      {activeKpiFilter === 'TOTAL' && 'No weekly plan records found for this period.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OVERFLOW MODAL FOR MONTH VIEW */}
      {overflowModalData && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] p-6 rounded-3xl max-w-lg w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-[var(--secondary)]" />
                <h3 className="font-bold text-white text-sm">Plans for {overflowModalData.displayLabel}</h3>
              </div>
              <button onClick={() => setOverflowModalData(null)} className="text-[var(--text-secondary)] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {overflowModalData.plans.map((p, idx) => (
                <div
                  key={p.id || idx}
                  onClick={() => {
                    setOverflowModalData(null);
                    openEditModal(p);
                  }}
                  className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--border-default)] hover:border-[var(--primary)] rounded-xl space-y-1 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{p.title}</span>
                    <span className="text-[10px] font-mono text-[var(--secondary)]">{p.time_slot || '10:00 - 11:00'}</span>
                  </div>
                  {p.customer_name && <div className="text-[11px] text-[var(--primary)] font-semibold">{p.customer_name}</div>}
                  {p.visit_location && <div className="text-[10px] text-[var(--text-secondary)]">Location: {p.visit_location}</div>}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-default)]">
              <button
                onClick={() => {
                  const d = overflowModalData.dateStr;
                  setOverflowModalData(null);
                  openCreateModalForDate(d);
                }}
                className="px-3.5 py-1.5 bg-[var(--primary)] text-white text-xs font-semibold rounded-xl"
              >
                + Add New Plan
              </button>
              <button onClick={() => setOverflowModalData(null)} className="px-4 py-1.5 bg-[var(--bg-surface-muted)] text-[var(--text-primary)] text-xs rounded-xl font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Weekly Plan Modal with 3-Step Stepper */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-surface-muted)] backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] animate-in zoom-in-95 duration-150">

            {/* Modal Left Stepper Sidebar */}
            <div className="w-full md:w-64 bg-[var(--bg-surface-elevated)] border-b md:border-b-0 md:border-r border-[var(--border-default)] p-6 flex flex-col justify-between shrink-0">
              <div className="space-y-6">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-[var(--primary)]/20 text-[var(--secondary)] rounded-xl border border-[var(--primary)]/30 shrink-0">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base leading-tight">
                      {editingTask ? 'Edit Weekly Plan' : 'Add Weekly Plan'}
                    </h3>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Plan a customer visit or task for your team</p>
                  </div>
                </div>

                <div className="relative space-y-6 pl-2 pt-2">
                  <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-[var(--bg-surface-muted)]" />

                  {/* Step 1 */}
                  <div
                    onClick={() => setModalStep(1)}
                    className="relative flex items-start gap-3 cursor-pointer group"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all z-10 ${
                      modalStep === 1
                        ? 'bg-[var(--primary)] text-white shadow-xs ring-4 ring-1 ring-[var(--primary)]/30'
                        : modalStep > 1
                        ? 'bg-[var(--badge-success-bg)] text-[var(--primary-text)] font-extrabold'
                        : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] group-hover:bg-[var(--bg-surface-hover)]'
                    }`}>
                      {modalStep > 1 ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${modalStep === 1 ? 'text-white' : 'text-[var(--text-secondary)]'}`}>
                        Visit Details
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">Basic information</div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div
                    onClick={() => setModalStep(2)}
                    className="relative flex items-start gap-3 cursor-pointer group"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all z-10 ${
                      modalStep === 2
                        ? 'bg-[var(--primary)] text-white shadow-xs ring-4 ring-1 ring-[var(--primary)]/30'
                        : modalStep > 2
                        ? 'bg-[var(--badge-success-bg)] text-[var(--primary-text)] font-extrabold'
                        : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] group-hover:bg-[var(--bg-surface-hover)]'
                    }`}>
                      {modalStep > 2 ? <Check className="w-4 h-4 stroke-[3]" /> : '2'}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${modalStep === 2 ? 'text-white' : 'text-[var(--text-secondary)]'}`}>
                        Meeting & Discussion
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">Objectives and notes</div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div
                    onClick={() => setModalStep(3)}
                    className="relative flex items-start gap-3 cursor-pointer group"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all z-10 ${
                      modalStep === 3
                        ? 'bg-[var(--primary)] text-white shadow-xs ring-4 ring-1 ring-[var(--primary)]/30'
                        : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] group-hover:bg-[var(--bg-surface-hover)]'
                    }`}>
                      3
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${modalStep === 3 ? 'text-white' : 'text-[var(--text-secondary)]'}`}>
                        Follow-Up
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">Next steps</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden md:block text-[10px] text-[var(--text-muted)] pt-4 border-t border-[var(--border-default)]">
                Theiakshi Weekly Planner
              </div>
            </div>

            {/* Modal Right Form Area */}
            <div className="flex-1 bg-[var(--bg-surface-elevated)] p-6 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
                  <span className="text-xs font-bold text-[var(--secondary)] uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarIcon className="w-4 h-4" />
                    {modalStep === 1 && 'VISIT & TASK PLANNING DETAILS'}
                    {modalStep === 2 && 'MEETING & DISCUSSION OUTCOME'}
                    {modalStep === 3 && 'NEXT ACTIONS & FOLLOW-UP'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="p-1 text-[var(--text-secondary)] hover:text-white rounded-lg transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {formError && (
                  <div className="p-3 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 text-[var(--action-danger-bg)] text-xs rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[var(--action-danger-bg)] shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                  {/* STEP 1: VISIT DETAILS */}
                  {modalStep === 1 && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {isManagement ? (
                          <div>
                            <label className="block text-[var(--text-primary)] mb-1 font-semibold">Assigned Employee *</label>
                            <select
                              value={formData.assignedEmployeeId || (employees.length > 0 ? employees[0].id : '')}
                              onChange={e => setFormData({ ...formData, assignedEmployeeId: e.target.value })}
                              className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-medium focus:border-[var(--primary)] focus:outline-none"
                            >
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_code})</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-xs flex items-center justify-between">
                            <span className="text-[var(--text-secondary)]">Assigned To:</span>
                            <strong className="text-[var(--secondary)] font-semibold">You (Self-Assigned)</strong>
                          </div>
                        )}

                        <div>
                          <label className="block text-[var(--text-primary)] mb-1 font-semibold">Task Title / Objective *</label>
                          <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none"
                            placeholder="e.g. CLRI VISIT"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[var(--text-primary)] mb-1 font-semibold">Customer / Account Name</label>
                          <input
                            type="text"
                            value={formData.customerName}
                            onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none"
                            placeholder="e.g. CENTRAL LEATHER RESEARCH INSTITUTE"
                          />
                        </div>
                        <div>
                          <label className="block text-[var(--text-primary)] mb-1 font-semibold">Contact Person</label>
                          <input
                            type="text"
                            value={formData.contactPerson}
                            onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none"
                            placeholder="e.g. Amit Ashok"
                          />
                        </div>
                        <div>
                          <label className="block text-[var(--text-primary)] mb-1 font-semibold">Contact Phone / Email</label>
                          <input
                            type="text"
                            value={formData.contactDetails}
                            onChange={e => setFormData({ ...formData, contactDetails: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none"
                            placeholder="04424437137"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[var(--text-primary)] mb-1 font-semibold">Visit Location / Place</label>
                          <input
                            type="text"
                            value={formData.visitLocation}
                            onChange={e => setFormData({ ...formData, visitLocation: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none"
                            placeholder="Adayar"
                          />
                        </div>

                        <div>
                          <label className="block text-[var(--text-primary)] mb-1 font-semibold">Visit Type</label>
                          <select
                            value={formData.visitType}
                            onChange={e => setFormData({ ...formData, visitType: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-medium focus:border-[var(--primary)] focus:outline-none"
                          >
                            <option value="New Prospect">New Prospect</option>
                            <option value="Follow-Up">Follow-Up</option>
                            <option value="Demo / Presentation">Demo / Presentation</option>
                            <option value="Technical Support">Technical Support</option>
                            <option value="AMC / Service">AMC / Service</option>
                            <option value="Order Closure">Order Closure</option>
                            <option value="Relationship Call">Relationship Call</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[var(--text-primary)] mb-1 font-semibold">Time Slot</label>
                          <select
                            value={formData.timeSlot}
                            onChange={e => setFormData({ ...formData, timeSlot: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-medium focus:border-[var(--primary)] focus:outline-none"
                          >
                            <option value="09:00-10:30">09:00 - 10:30</option>
                            <option value="10:00-11:00">10:00 - 11:00</option>
                            <option value="11:00-12:00">11:00 - 12:00</option>
                            <option value="12:00-13:30">12:00 - 13:30</option>
                            <option value="14:00-15:30">14:00 - 15:30</option>
                            <option value="15:00-16:00">15:00 - 16:00</option>
                            <option value="Full Day">Full Day</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[var(--text-primary)] mb-1 font-semibold">Planned Date *</label>
                          <input
                            type="date"
                            required
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono focus:border-[var(--primary)] focus:outline-none"
                          />
                        </div>

                        {/* Opportunity Stage with No Requirement */}
                        <div>
                          <label className="block text-[var(--text-primary)] mb-1 font-semibold">Opportunity Stage</label>
                          <select
                            value={formData.opportunityStage}
                            onChange={e => setFormData({ ...formData, opportunityStage: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-medium focus:border-[var(--primary)] focus:outline-none"
                          >
                            <option value="No Requirement">No Requirement</option>
                            <option value="Lead">Lead</option>
                            <option value="Qualified">Qualified</option>
                            <option value="Proposal Sent">Proposal Sent</option>
                            <option value="Negotiation">Negotiation</option>
                            <option value="Won">Won</option>
                            <option value="Lost">Lost</option>
                            <option value="On Hold">On Hold</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[var(--text-primary)] mb-1 font-semibold">Priority</label>
                          <select
                            value={formData.priority}
                            onChange={e => setFormData({ ...formData, priority: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-medium focus:border-[var(--primary)] focus:outline-none"
                          >
                            <option value="HIGH">HIGH</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="LOW">LOW</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[var(--text-primary)] mb-1 font-semibold">Products / Solutions to Present</label>
                        <input
                          type="text"
                          value={formData.productsToPresent}
                          onChange={e => setFormData({ ...formData, productsToPresent: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none"
                          placeholder="e.g. Microscope"
                        />
                      </div>
                    </div>
                  )}

                  {/* STEP 2: MEETING & DISCUSSION */}
                  {modalStep === 2 && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[var(--text-primary)] mb-1 font-semibold">Task Status *</label>
                          <select
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-bold focus:border-[var(--primary)] focus:outline-none"
                          >
                            <option value="PLANNED">PLANNED</option>
                            <option value="IN_PROGRESS">IN PROGRESS</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[var(--text-primary)] mb-1 font-semibold">Estimated Opportunity Value (₹)</label>
                          <input
                            type="number"
                            value={formData.estimatedValue}
                            onChange={e => setFormData({ ...formData, estimatedValue: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--badge-warning-text)] font-mono focus:border-[var(--primary)] focus:outline-none"
                            placeholder="e.g. 250000"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[var(--text-primary)] mb-1 font-semibold">Visit Objective / Notes</label>
                        <textarea
                          rows={3}
                          value={formData.visitObjective}
                          onChange={e => setFormData({ ...formData, visitObjective: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none"
                          placeholder="Objectives for the customer visit..."
                        />
                      </div>

                      <div>
                        <label className="block text-[var(--text-primary)] mb-1 font-semibold">Discussion Outcome / Meeting Summary</label>
                        <textarea
                          rows={3}
                          value={formData.outcomeSummary}
                          onChange={e => setFormData({ ...formData, outcomeSummary: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none"
                          placeholder="Discussed product requirements. Customer requested quotation..."
                        />
                      </div>
                    </div>
                  )}

                  {/* STEP 3: FOLLOW-UP */}
                  {modalStep === 3 && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <div>
                        <label className="block text-[var(--text-primary)] mb-1 font-semibold">Next Required Action</label>
                        <input
                          type="text"
                          value={formData.nextAction}
                          onChange={e => setFormData({ ...formData, nextAction: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none"
                          placeholder="Send commercial quotation and technical specs..."
                        />
                      </div>

                      <div>
                        <label className="block text-[var(--text-primary)] mb-1 font-semibold">Next Follow-Up Date</label>
                        <input
                          type="date"
                          value={formData.followUpDate}
                          onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-mono focus:border-[var(--primary)] focus:outline-none"
                        />
                      </div>

                      {formData.status === 'CANCELLED' && (
                        <div>
                          <label className="block text-[var(--action-danger-bg)] mb-1 font-semibold">Cancellation Reason *</label>
                          <input
                            type="text"
                            value={formData.cancellationReason}
                            onChange={e => setFormData({ ...formData, cancellationReason: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--action-danger-bg)]/30 rounded-xl text-[var(--action-danger-bg)] focus:outline-none"
                            placeholder="e.g. Rescheduled by client..."
                          />
                        </div>
                      )}
                    </div>
                  )}
                </form>
              </div>

              {/* Form Bottom Control Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[var(--border-default)] mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded-xl font-medium text-xs transition-all"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  {modalStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setModalStep((modalStep - 1) as any)}
                      className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded-xl font-semibold text-xs transition-all"
                    >
                      Back
                    </button>
                  )}

                  {modalStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => setModalStep((modalStep + 1) as any)}
                      className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary)] text-white rounded-xl font-semibold text-xs shadow-xs transition-all"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="px-6 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl font-semibold text-xs shadow-xs transition-all"
                    >
                      Save Plan
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Reschedule Task Modal */}
      {rescheduleTaskItem && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-surface-muted)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-[var(--secondary)]" />
                <h3 className="font-bold text-white text-sm">Reschedule Weekly Plan</h3>
              </div>
              <button onClick={() => setRescheduleTaskItem(null)} className="text-[var(--text-secondary)] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] space-y-1">
                <p className="text-[var(--text-secondary)] font-medium">Plan: <span className="text-[var(--text-heading)] font-bold">{rescheduleTaskItem.title}</span></p>
                <p className="text-[var(--text-secondary)] font-medium">Original Date: <span className="text-[var(--badge-warning-text)] font-mono">{rescheduleTaskItem.date}</span></p>
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-semibold">New Planned Date *</label>
                <input
                  type="date"
                  required
                  value={rescheduleNewDate}
                  onChange={e => setRescheduleNewDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--secondary)] font-mono rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-[var(--text-primary)] mb-1 font-semibold">Reschedule Reason</label>
                <input
                  type="text"
                  value={rescheduleReason}
                  onChange={e => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Customer requested later date..."
                  className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-xl outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
                <button
                  type="button"
                  onClick={() => setRescheduleTaskItem(null)}
                  className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduling || !rescheduleNewDate}
                  className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl font-semibold shadow disabled:opacity-50"
                >
                  {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
