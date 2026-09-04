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

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    tasks.forEach(t => {
      const dKey = normalizeDateOnly(t.date);
      if (dKey) {
        if (!map.has(dKey)) map.set(dKey, []);
        map.get(dKey)!.push(t);
      }
    });
    return map;
  }, [tasks]);

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
    if (status === 'COMPLETED') return 'border-l-purple-500 hover:border-l-purple-400';
    if (status === 'IN_PROGRESS') return 'border-l-cyan-500 hover:border-l-cyan-400';
    if (status === 'CANCELLED') return 'border-l-rose-500 hover:border-l-rose-400';
    const accents = ['border-l-cyan-500', 'border-l-indigo-500', 'border-l-purple-500', 'border-l-emerald-500'];
    return accents[index % accents.length];
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-600/20 text-purple-400 rounded-2xl border border-purple-500/30 shadow-lg shadow-purple-500/10">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">Weekly Plan</h1>
            <p className="text-xs text-slate-400">Plan, track and manage employee customer visits and tasks for the selected period.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View Switcher: [Month] [Week] [List] */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveView('month')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeView === 'month' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setActiveView('week')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeView === 'week' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeView === 'list' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              List
            </button>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-inner">
            <button
              onClick={activeView === 'week' ? handlePrevWeek : handlePrevMonth}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleThisWeek}
              className="px-2.5 py-1 text-xs font-semibold text-purple-400 hover:text-purple-300 rounded-lg transition-all"
            >
              Today
            </button>

            <div className="px-3 text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span>{dateRangeDisplay}</span>
            </div>

            <button
              onClick={activeView === 'week' ? handleNextWeek : handleNextMonth}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            disabled={downloading}
            onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
            title="Export Weekly Plan to Excel"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>{downloading ? 'Downloading...' : 'Export'}</span>
          </button>

          {/* Add Plan Primary Button */}
          <button
            onClick={() => openCreateModalForDate(todayStr || weekDays[0].dateStr)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-600/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Plan</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row (4 Cards Only - Weekly Plan Specific) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL PLANS */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Total Plans</span>
            <div className="text-2xl font-extrabold text-white">{kpis.totalPlans}</div>
            <div className="text-[11px] text-slate-400">Selected period</div>
          </div>
          <div className="p-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl">
            <CalendarIcon className="w-6 h-6" />
          </div>
        </div>

        {/* SCHEDULED VISITS */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Scheduled Visits</span>
            <div className="text-2xl font-extrabold text-white">{kpis.scheduledVisits}</div>
            <div className="text-[11px] text-slate-400">Customer meetings</div>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
            <Send className="w-6 h-6" />
          </div>
        </div>

        {/* PENDING FOLLOW-UPS */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Pending Follow-ups</span>
            <div className="text-2xl font-extrabold text-white">{kpis.pendingFollowUps}</div>
            <div className="text-[11px] text-slate-400">Action required</div>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
            <Hourglass className="w-6 h-6" />
          </div>
        </div>

        {/* COMPLETED */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Completed</span>
            <div className="text-2xl font-extrabold text-white">{kpis.completed}</div>
            <div className="text-[11px] text-slate-400">Marked as completed</div>
          </div>
          <div className="p-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Carried Forward Pending Work Banner */}
      {pendingCarryForward.length > 0 && (
        <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-2xl space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-amber-800/40 pb-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>CARRIED FORWARD — {pendingCarryForward.length} PENDING ITEMS FROM PREVIOUS WEEKS</span>
            </div>
            <span className="text-[10px] text-amber-400/80 font-medium">Require Action: Complete, Cancel, or Reschedule</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {pendingCarryForward.map(item => (
              <div key={item.id} className="p-3 bg-slate-950/80 border border-amber-800/40 rounded-xl space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-100 block">{item.title}</span>
                    {item.assigned_employee_name && (
                      <span className="text-cyan-400 text-[11px] font-semibold block">
                        Employee: {item.assigned_employee_name}
                      </span>
                    )}
                    {item.customer_name && <span className="text-amber-400 text-[11px] font-semibold block">Customer: {item.customer_name}</span>}
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                    {item.date}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => openEditModal(item)}
                    className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-semibold"
                  >
                    Complete
                  </button>
                  <button
                    onClick={() => openRescheduleModal(item)}
                    className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-[10px] font-semibold flex items-center gap-1"
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
                    ? 'bg-slate-900/90 border-purple-500/80 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/40'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Day Header */}
                <div className={`p-3 border-b text-center space-y-0.5 ${
                  isToday ? 'bg-purple-950/40 border-purple-500/40' : 'bg-slate-950/40 border-slate-800'
                }`}>
                  <div className={`text-xs font-extrabold uppercase tracking-wide ${isToday ? 'text-purple-400' : 'text-slate-400'}`}>
                    {day.shortName}
                  </div>
                  <div className={`text-sm font-bold ${isToday ? 'text-white' : 'text-slate-200'}`}>
                    {day.dayNumStr} {day.date.toLocaleString('en-US', { month: 'short' })}
                  </div>
                </div>

                {/* Day Plans List */}
                <div className="p-2.5 flex-1 space-y-2 overflow-y-auto max-h-[480px]">
                  {dayTasks.map((t, tIdx) => (
                    <div
                      key={t.id || tIdx}
                      onClick={() => openEditModal(t)}
                      className={`p-3 bg-slate-950/90 border-l-4 ${getCardAccentColor(tIdx, t.status)} border-y border-r border-slate-800 hover:border-slate-700 rounded-xl space-y-2 cursor-pointer transition-all shadow-md group relative`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>{t.time_slot || '10:00 - 11:00'}</span>
                        <button
                          onClick={(e) => handleDeleteTask(t.id, e)}
                          className="text-slate-500 hover:text-rose-400 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete Plan"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {t.customer_name && (
                        <div className="font-bold text-slate-100 text-xs line-clamp-1">
                          {t.customer_name}
                        </div>
                      )}

                      {t.visit_location && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{t.visit_location}</span>
                        </div>
                      )}

                      <div className="text-[11px] text-slate-300 font-medium line-clamp-2">
                        {t.title || t.visit_objective || 'Customer Meeting'}
                      </div>

                      <div className="pt-1 flex items-center justify-between border-t border-slate-800/80">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider ${
                          t.status === 'COMPLETED' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                          t.status === 'IN_PROGRESS' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                          t.status === 'CANCELLED' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {t.status === 'PLANNED' ? 'Planned' : t.status || 'Planned'}
                        </span>

                        {t.assigned_employee_name && (
                          <span className="text-[9px] text-slate-400 font-semibold truncate max-w-[80px]">
                            {t.assigned_employee_name.split(' ')[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {dayTasks.length === 0 && (
                    <div className="h-full min-h-[220px] flex flex-col items-center justify-center p-4 text-center border-2 border-dashed border-slate-800/60 rounded-xl space-y-2 bg-slate-950/20">
                      <CalendarIcon className="w-7 h-7 text-slate-600" />
                      <span className="text-xs text-slate-400 font-medium">No plans for this day</span>
                      <button
                        onClick={() => openCreateModalForDate(day.dateStr)}
                        className="mt-1 flex items-center gap-1 px-3 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-semibold transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Plan</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. MONTH VIEW (SUN - SAT GRID) */}
      {activeView === 'month' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-extrabold uppercase tracking-wider text-purple-400 border-b border-slate-800 pb-3">
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
                      ? 'bg-slate-950/20 border-slate-900/40 text-slate-600 opacity-40'
                      : isToday
                      ? 'bg-purple-950/30 border-purple-500/80 shadow-md shadow-purple-500/10 ring-1 ring-purple-500/40'
                      : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
                      isToday ? 'bg-purple-600 text-white font-extrabold' : 'text-slate-300'
                    }`}>
                      {cell.dayNum}
                    </span>

                    {dayPlans.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300">
                        {dayPlans.length} {dayPlans.length === 1 ? 'plan' : 'plans'}
                      </span>
                    )}
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
                        className="px-2 py-1 bg-slate-900 border-l-2 border-purple-500 border-slate-800 hover:border-purple-400 rounded text-[10px] truncate transition-all"
                      >
                        <span className="font-bold text-slate-100">{p.customer_name || p.title}</span>
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
                      className="text-[10px] font-bold text-purple-400 hover:text-purple-300 text-left pt-0.5"
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
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Table className="w-4 h-4 text-purple-400" />
              <span>Weekly Plan Records ({tasks.length})</span>
            </h3>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-2xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
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
              <tbody className="divide-y divide-slate-800/80">
                {tasks.map((t, idx) => (
                  <tr key={t.id || idx} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-purple-400">{t.date}</td>
                    <td className="p-3 font-semibold text-slate-200">{t.assigned_employee_name || 'Self'}</td>
                    <td className="p-3 font-bold text-white max-w-[200px] truncate">{t.title}</td>
                    <td className="p-3 text-slate-300 max-w-[200px] truncate">
                      <div>{t.customer_name || '—'}</div>
                      {t.visit_location && <span className="text-[10px] text-slate-500">{t.visit_location}</span>}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                        {t.opportunity_stage || 'No Requirement'}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-400">{t.follow_up_date || '—'}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        t.status === 'COMPLETED' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                        t.status === 'IN_PROGRESS' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' :
                        t.status === 'CANCELLED' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                        'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button onClick={() => openEditModal(t)} className="p-1 text-slate-400 hover:text-purple-400" title="Edit Plan">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => openRescheduleModal(t)} className="p-1 text-slate-400 hover:text-cyan-400" title="Reschedule">
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => handleDeleteTask(t.id, e)} className="p-1 text-slate-400 hover:text-rose-400" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500 italic">No weekly plan records found for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OVERFLOW MODAL FOR MONTH VIEW */}
      {overflowModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-slate-800 p-6 rounded-3xl max-w-lg w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-sm">Plans for {overflowModalData.displayLabel}</h3>
              </div>
              <button onClick={() => setOverflowModalData(null)} className="text-slate-400 hover:text-white">
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
                  className="p-3 bg-slate-950 border border-slate-800 hover:border-purple-500 rounded-xl space-y-1 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{p.title}</span>
                    <span className="text-[10px] font-mono text-purple-400">{p.time_slot || '10:00 - 11:00'}</span>
                  </div>
                  {p.customer_name && <div className="text-[11px] text-cyan-400 font-semibold">{p.customer_name}</div>}
                  {p.visit_location && <div className="text-[10px] text-slate-400">Location: {p.visit_location}</div>}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  const d = overflowModalData.dateStr;
                  setOverflowModalData(null);
                  openCreateModalForDate(d);
                }}
                className="px-3.5 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-xl"
              >
                + Add New Plan
              </button>
              <button onClick={() => setOverflowModalData(null)} className="px-4 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Weekly Plan Modal with 3-Step Stepper */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-slate-800 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] animate-in zoom-in-95 duration-150">

            {/* Modal Left Stepper Sidebar */}
            <div className="w-full md:w-64 bg-[#0D1322] border-b md:border-b-0 md:border-r border-slate-800 p-6 flex flex-col justify-between shrink-0">
              <div className="space-y-6">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30 shrink-0">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base leading-tight">
                      {editingTask ? 'Edit Weekly Plan' : 'Add Weekly Plan'}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Plan a customer visit or task for your team</p>
                  </div>
                </div>

                <div className="relative space-y-6 pl-2 pt-2">
                  <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-800" />

                  {/* Step 1 */}
                  <div
                    onClick={() => setModalStep(1)}
                    className="relative flex items-start gap-3 cursor-pointer group"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all z-10 ${
                      modalStep === 1
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40 ring-4 ring-purple-600/20'
                        : modalStep > 1
                        ? 'bg-emerald-500 text-slate-950 font-extrabold'
                        : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                    }`}>
                      {modalStep > 1 ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${modalStep === 1 ? 'text-white' : 'text-slate-400'}`}>
                        Visit Details
                      </div>
                      <div className="text-[10px] text-slate-500">Basic information</div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div
                    onClick={() => setModalStep(2)}
                    className="relative flex items-start gap-3 cursor-pointer group"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all z-10 ${
                      modalStep === 2
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40 ring-4 ring-purple-600/20'
                        : modalStep > 2
                        ? 'bg-emerald-500 text-slate-950 font-extrabold'
                        : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                    }`}>
                      {modalStep > 2 ? <Check className="w-4 h-4 stroke-[3]" /> : '2'}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${modalStep === 2 ? 'text-white' : 'text-slate-400'}`}>
                        Meeting & Discussion
                      </div>
                      <div className="text-[10px] text-slate-500">Objectives and notes</div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div
                    onClick={() => setModalStep(3)}
                    className="relative flex items-start gap-3 cursor-pointer group"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all z-10 ${
                      modalStep === 3
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40 ring-4 ring-purple-600/20'
                        : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                    }`}>
                      3
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${modalStep === 3 ? 'text-white' : 'text-slate-400'}`}>
                        Follow-Up
                      </div>
                      <div className="text-[10px] text-slate-500">Next steps</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden md:block text-[10px] text-slate-500 pt-4 border-t border-slate-800">
                Theiakshi Enterprise Weekly Planner
              </div>
            </div>

            {/* Modal Right Form Area */}
            <div className="flex-1 bg-[#090D16] p-6 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarIcon className="w-4 h-4" />
                    {modalStep === 1 && 'VISIT & TASK PLANNING DETAILS'}
                    {modalStep === 2 && 'MEETING & DISCUSSION OUTCOME'}
                    {modalStep === 3 && 'NEXT ACTIONS & FOLLOW-UP'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {formError && (
                  <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
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
                            <label className="block text-slate-300 mb-1 font-semibold">Assigned Employee *</label>
                            <select
                              value={formData.assignedEmployeeId || (employees.length > 0 ? employees[0].id : '')}
                              onChange={e => setFormData({ ...formData, assignedEmployeeId: e.target.value })}
                              className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 font-medium focus:border-purple-500 focus:outline-none"
                            >
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_code})</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="p-3 bg-[#060911] border border-slate-800 rounded-xl text-xs flex items-center justify-between">
                            <span className="text-slate-400">Assigned To:</span>
                            <strong className="text-purple-400 font-semibold">You (Self-Assigned)</strong>
                          </div>
                        )}

                        <div>
                          <label className="block text-slate-300 mb-1 font-semibold">Task Title / Objective *</label>
                          <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 focus:border-purple-500 focus:outline-none"
                            placeholder="e.g. CLRI VISIT"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-slate-300 mb-1 font-semibold">Customer / Account Name</label>
                          <input
                            type="text"
                            value={formData.customerName}
                            onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                            className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 focus:border-purple-500 focus:outline-none"
                            placeholder="e.g. CENTRAL LEATHER RESEARCH INSTITUTE"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-300 mb-1 font-semibold">Contact Person</label>
                          <input
                            type="text"
                            value={formData.contactPerson}
                            onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                            className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 focus:border-purple-500 focus:outline-none"
                            placeholder="e.g. Amit Ashok"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-300 mb-1 font-semibold">Contact Phone / Email</label>
                          <input
                            type="text"
                            value={formData.contactDetails}
                            onChange={e => setFormData({ ...formData, contactDetails: e.target.value })}
                            className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 focus:border-purple-500 focus:outline-none"
                            placeholder="04424437137"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-slate-300 mb-1 font-semibold">Visit Location / Place</label>
                          <input
                            type="text"
                            value={formData.visitLocation}
                            onChange={e => setFormData({ ...formData, visitLocation: e.target.value })}
                            className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 focus:border-purple-500 focus:outline-none"
                            placeholder="Adayar"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-300 mb-1 font-semibold">Visit Type</label>
                          <select
                            value={formData.visitType}
                            onChange={e => setFormData({ ...formData, visitType: e.target.value })}
                            className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 font-medium focus:border-purple-500 focus:outline-none"
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
                          <label className="block text-slate-300 mb-1 font-semibold">Time Slot</label>
                          <select
                            value={formData.timeSlot}
                            onChange={e => setFormData({ ...formData, timeSlot: e.target.value })}
                            className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 font-medium focus:border-purple-500 focus:outline-none"
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
                          <label className="block text-slate-300 mb-1 font-semibold">Planned Date *</label>
                          <input
                            type="date"
                            required
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                            className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 font-mono focus:border-purple-500 focus:outline-none"
                          />
                        </div>

                        {/* Opportunity Stage with No Requirement */}
                        <div>
                          <label className="block text-slate-300 mb-1 font-semibold">Opportunity Stage</label>
                          <select
                            value={formData.opportunityStage}
                            onChange={e => setFormData({ ...formData, opportunityStage: e.target.value })}
                            className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 font-medium focus:border-purple-500 focus:outline-none"
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
                          <label className="block text-slate-300 mb-1 font-semibold">Priority</label>
                          <select
                            value={formData.priority}
                            onChange={e => setFormData({ ...formData, priority: e.target.value })}
                            className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 font-medium focus:border-purple-500 focus:outline-none"
                          >
                            <option value="HIGH">HIGH</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="LOW">LOW</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 mb-1 font-semibold">Products / Solutions to Present</label>
                        <input
                          type="text"
                          value={formData.productsToPresent}
                          onChange={e => setFormData({ ...formData, productsToPresent: e.target.value })}
                          className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 focus:border-purple-500 focus:outline-none"
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
                          <label className="block text-slate-300 mb-1 font-semibold">Task Status *</label>
                          <select
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                            className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 font-bold focus:border-purple-500 focus:outline-none"
                          >
                            <option value="PLANNED">PLANNED</option>
                            <option value="IN_PROGRESS">IN PROGRESS</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-300 mb-1 font-semibold">Estimated Opportunity Value (₹)</label>
                          <input
                            type="number"
                            value={formData.estimatedValue}
                            onChange={e => setFormData({ ...formData, estimatedValue: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-amber-300 font-mono focus:border-purple-500 focus:outline-none"
                            placeholder="e.g. 250000"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 mb-1 font-semibold">Visit Objective / Notes</label>
                        <textarea
                          rows={3}
                          value={formData.visitObjective}
                          onChange={e => setFormData({ ...formData, visitObjective: e.target.value })}
                          className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 focus:border-purple-500 focus:outline-none"
                          placeholder="Objectives for the customer visit..."
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 mb-1 font-semibold">Discussion Outcome / Meeting Summary</label>
                        <textarea
                          rows={3}
                          value={formData.outcomeSummary}
                          onChange={e => setFormData({ ...formData, outcomeSummary: e.target.value })}
                          className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 focus:border-purple-500 focus:outline-none"
                          placeholder="Discussed product requirements. Customer requested quotation..."
                        />
                      </div>
                    </div>
                  )}

                  {/* STEP 3: FOLLOW-UP */}
                  {modalStep === 3 && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <div>
                        <label className="block text-slate-300 mb-1 font-semibold">Next Required Action</label>
                        <input
                          type="text"
                          value={formData.nextAction}
                          onChange={e => setFormData({ ...formData, nextAction: e.target.value })}
                          className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 focus:border-purple-500 focus:outline-none"
                          placeholder="Send commercial quotation and technical specs..."
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 mb-1 font-semibold">Next Follow-Up Date</label>
                        <input
                          type="date"
                          value={formData.followUpDate}
                          onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
                          className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 font-mono focus:border-purple-500 focus:outline-none"
                        />
                      </div>

                      {formData.status === 'CANCELLED' && (
                        <div>
                          <label className="block text-rose-400 mb-1 font-semibold">Cancellation Reason *</label>
                          <input
                            type="text"
                            value={formData.cancellationReason}
                            onChange={e => setFormData({ ...formData, cancellationReason: e.target.value })}
                            className="w-full px-3 py-2 bg-[#060911] border border-rose-800 rounded-xl text-rose-300 focus:outline-none"
                            placeholder="e.g. Rescheduled by client..."
                          />
                        </div>
                      )}
                    </div>
                  )}
                </form>
              </div>

              {/* Form Bottom Control Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs transition-all"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  {modalStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setModalStep((modalStep - 1) as any)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs transition-all"
                    >
                      Back
                    </button>
                  )}

                  {modalStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => setModalStep((modalStep + 1) as any)}
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold text-xs shadow-lg shadow-purple-600/25 transition-all"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-xs shadow-lg shadow-purple-600/30 transition-all"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-sm">Reschedule Weekly Plan</h3>
              </div>
              <button onClick={() => setRescheduleTaskItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-[#060911] rounded-xl border border-slate-800 space-y-1">
                <p className="text-slate-400 font-medium">Plan: <span className="text-slate-100 font-bold">{rescheduleTaskItem.title}</span></p>
                <p className="text-slate-400 font-medium">Original Date: <span className="text-amber-400 font-mono">{rescheduleTaskItem.date}</span></p>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">New Planned Date *</label>
                <input
                  type="date"
                  required
                  value={rescheduleNewDate}
                  onChange={e => setRescheduleNewDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#060911] border border-slate-800 text-purple-300 font-mono rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Reschedule Reason</label>
                <input
                  type="text"
                  value={rescheduleReason}
                  onChange={e => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Customer requested later date..."
                  className="w-full px-3 py-2 bg-[#060911] border border-slate-800 text-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRescheduleTaskItem(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduling || !rescheduleNewDate}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold shadow disabled:opacity-50"
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
