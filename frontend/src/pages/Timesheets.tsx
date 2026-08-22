import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch, apiDownload } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Edit3, Trash2, X, 
  CheckCircle2, User, Clock, AlertTriangle, Filter, Download, ArrowRight, RefreshCw, 
  MapPin, Phone, Mail, DollarSign, Target, Briefcase, Calendar, AlertCircle
} from 'lucide-react';
import { SharedCalendar, CalendarEvent } from '../components/calendar/SharedCalendar';

export const Timesheets: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [pendingCarryForward, setPendingCarryForward] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'weekly' | 'tracker' | 'history'>('weekly');

  // Filter states
  const [filterVisitType, setFilterVisitType] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterOpportunity, setFilterOpportunity] = useState<string>('');
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('');

  // Active Week Date State (Reference Monday Date)
  const [selectedMonday, setSelectedMonday] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay(); // 0 = Sun, 1 = Mon ...
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());

  // Task Create & Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    assignedEmployeeId: '',
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    hours: 8,
    status: 'PLANNED',
    customerName: '',
    contactPerson: '',
    contactDetails: '',
    visitLocation: '',
    visitType: 'New Prospect',
    timeSlot: '10:30-12:00',
    productsToPresent: '',
    visitObjective: '',
    outcomeSummary: '',
    nextAction: '',
    followUpDate: '',
    opportunityStage: 'Qualified',
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
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(selectedMonday);
      d.setDate(selectedMonday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        name: dayNames[i],
        date: d,
        dateStr: dateStr,
        dayNum: d.getDate()
      });
    }
    return days;
  }, [selectedMonday]);

  const handlePrevWeek = () => {
    const prev = new Date(selectedMonday);
    prev.setDate(selectedMonday.getDate() - 7);
    setSelectedMonday(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(selectedMonday);
    next.setDate(selectedMonday.getDate() + 7);
    setSelectedMonday(next);
  };

  const handleThisWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    setSelectedMonday(monday);
  };

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = weekDays[0].dateStr;
      const endDate = weekDays[6].dateStr;

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

      // Map to Calendar Events
      const events: CalendarEvent[] = rawTasks.map((t: any) => ({
        id: `task-${t.id}`,
        date: t.date.split('T')[0],
        type: 'TASK',
        title: `${t.customer_name ? `[${t.customer_name}] ` : ''}${t.title || 'Field Visit'}`,
        status: t.status || 'PLANNED',
        employeeName: t.assigned_employee_name,
        metadata: {
          description: t.description || t.visit_objective,
          hours: t.hours,
          location: t.visit_location,
          contact: t.contact_person,
          createdBy: t.created_by_email
        }
      }));

      setCalendarEvents(events);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [weekDays, isManagement, filterEmployeeId, filterStatus, filterVisitType, filterPriority, filterOpportunity]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const openCreateModalForDate = (dateStr: string) => {
    setEditingTask(null);
    const defaultEmpId = user?.employeeId || (employees.length > 0 ? employees[0].id : '');
    setFormData({
      assignedEmployeeId: defaultEmpId,
      title: '',
      description: '',
      date: dateStr,
      hours: 8,
      status: 'PLANNED',
      customerName: '',
      contactPerson: '',
      contactDetails: '',
      visitLocation: '',
      visitType: 'New Prospect',
      timeSlot: '10:30-12:00',
      productsToPresent: '',
      visitObjective: '',
      outcomeSummary: '',
      nextAction: '',
      followUpDate: '',
      opportunityStage: 'Qualified',
      estimatedValue: 0,
      priority: 'MEDIUM',
      cancellationReason: ''
    });
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (task: any) => {
    setEditingTask(task);
    setFormData({
      assignedEmployeeId: task.assigned_employee_id || '',
      title: task.title || task.description || '',
      description: task.description || '',
      date: task.date ? task.date.split('T')[0] : '',
      hours: task.hours || 8,
      status: task.status || 'PLANNED',
      customerName: task.customer_name || '',
      contactPerson: task.contact_person || '',
      contactDetails: task.contact_details || '',
      visitLocation: task.visit_location || '',
      visitType: task.visit_type || 'New Prospect',
      timeSlot: task.time_slot || '10:30-12:00',
      productsToPresent: task.products_to_present || '',
      visitObjective: task.visit_objective || '',
      outcomeSummary: task.outcome_summary || '',
      nextAction: task.next_action || '',
      followUpDate: task.follow_up_date ? task.follow_up_date.split('T')[0] : '',
      opportunityStage: task.opportunity_stage || 'Qualified',
      estimatedValue: task.estimated_value ? Number(task.estimated_value) : 0,
      priority: task.priority || 'MEDIUM',
      cancellationReason: task.cancellation_reason || ''
    });
    setFormError(null);
    setShowModal(true);
  };

  const openRescheduleModal = (task: any) => {
    setRescheduleTaskItem(task);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setRescheduleNewDate(tomorrow.toISOString().split('T')[0]);
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
      }, `THEIAKSHI_Weekly_Plan_${startDate}_to_${endDate}.csv`);
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
      const dKey = t.date.split('T')[0];
      if (!map.has(dKey)) map.set(dKey, []);
      map.get(dKey)!.push(t);
    });
    return map;
  }, [tasks]);

  // Statistics Summary
  const stats = useMemo(() => {
    let totalPlanned = tasks.length;
    let completed = 0;
    let inProgress = 0;
    let cancelled = 0;
    let rescheduled = 0;
    let pipelineVal = 0;
    let dealsWon = 0;

    tasks.forEach(t => {
      if (t.status === 'COMPLETED') completed++;
      if (t.status === 'IN_PROGRESS') inProgress++;
      if (t.status === 'CANCELLED') cancelled++;
      if (t.rescheduled_to_task_id) rescheduled++;
      if (t.estimated_value) pipelineVal += Number(t.estimated_value);
      if (t.opportunity_stage === 'Won') dealsWon++;
    });

    return { totalPlanned, completed, inProgress, cancelled, rescheduled, pipelineVal, dealsWon };
  }, [tasks]);

  const weekStartStr = weekDays[0].date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  const weekEndStr = weekDays[6].date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-cyan-400" />
            <span>Weekly Work & Field Visit Management System</span>
          </h1>
          <p className="text-xs text-slate-400">Plan customer visits, record meeting outcomes, track pipeline value, and carry forward pending tasks</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
            title="Export Weekly Plan to Excel / CSV"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Downloading...' : 'Download Excel'}</span>
          </button>

          <button
            onClick={() => openCreateModalForDate(new Date().toISOString().split('T')[0])}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Visit / Task</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Total Planned</span>
            <Calendar className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-extrabold text-white">{stats.totalPlanned}</div>
          <div className="text-[10px] text-slate-500">Scheduled visits</div>
        </div>

        <div className="p-4 bg-slate-900 border border-emerald-900/50 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold text-emerald-300">{stats.completed}</div>
          <div className="text-[10px] text-emerald-500/80">Outcomes recorded</div>
        </div>

        <div className="p-4 bg-slate-900 border border-cyan-900/50 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-cyan-400 text-xs font-semibold">
            <span>In Progress</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-extrabold text-cyan-300">{stats.inProgress}</div>
          <div className="text-[10px] text-cyan-500/80">Active meetings</div>
        </div>

        <div className="p-4 bg-slate-900 border border-amber-900/50 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
            <span>Carry Forward</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-extrabold text-amber-300">{pendingCarryForward.length}</div>
          <div className="text-[10px] text-amber-500/80">Pending from past</div>
        </div>

        <div className="p-4 bg-slate-900 border border-rose-900/50 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-rose-400 text-xs font-semibold">
            <span>Cancelled</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-extrabold text-rose-300">{stats.cancelled}</div>
          <div className="text-[10px] text-rose-500/80">Audit preserved</div>
        </div>

        <div className="p-4 bg-slate-900 border border-purple-900/50 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-purple-400 text-xs font-semibold">
            <span>Pipeline Value</span>
            <DollarSign className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg font-extrabold text-purple-300 font-mono">₹{stats.pipelineVal.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-purple-400/80">{stats.dealsWon} deals won</div>
        </div>
      </div>

      {/* Carried Forward Pending Work Banner */}
      {pendingCarryForward.length > 0 && (
        <div className="p-5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/40 border border-amber-800/60 rounded-2xl space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-amber-800/40 pb-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <span>CARRIED FORWARD — {pendingCarryForward.length} PENDING ITEMS FROM PREVIOUS WEEKS</span>
            </div>
            <span className="text-[11px] text-amber-400/80 font-medium">Require Action: Complete, Cancel, or Reschedule</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {pendingCarryForward.map(item => (
              <div key={item.id} className="p-3 bg-slate-950/80 border border-amber-800/40 rounded-xl space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-100 block">{item.title}</span>
                    {item.customer_name && <span className="text-amber-400 text-[11px] font-semibold">Customer: {item.customer_name}</span>}
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                    {item.date}
                  </span>
                </div>

                {item.visit_location && (
                  <div className="text-slate-400 text-[11px] flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>{item.visit_location}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => openEditModal(item)}
                    className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-semibold"
                  >
                    Complete
                  </button>
                  <button
                    onClick={() => openRescheduleModal(item)}
                    className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-[11px] font-semibold flex items-center gap-1"
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

      {/* Main Weekly Navigation & Filters Bar */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-cyan-400" />
              <span>Weekly Work Plan: {weekStartStr} — {weekEndStr}</span>
            </h2>
            <p className="text-xs text-slate-400">Click any day column to add or schedule customer visits and work activities</p>
          </div>

          {/* Controls & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {isManagement && (
              <select
                value={filterEmployeeId}
                onChange={e => setFilterEmployeeId(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3 py-1.5 rounded-xl outline-none"
              >
                <option value="">All Employees</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                ))}
              </select>
            )}

            <select
              value={filterVisitType}
              onChange={e => setFilterVisitType(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3 py-1.5 rounded-xl outline-none"
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

            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs">
              <button
                onClick={handlePrevWeek}
                className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition-all"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleThisWeek}
                className="px-3 py-1 font-semibold text-cyan-400 hover:text-cyan-300 rounded-lg transition-all"
              >
                This Week
              </button>
              <button
                onClick={handleNextWeek}
                className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition-all"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 7-Day Weekly Layout (Mon - Sun) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {weekDays.map((day, idx) => {
            const isToday = day.dateStr === new Date().toISOString().split('T')[0];
            const dayTasks = tasksByDate.get(day.dateStr) || [];

            return (
              <div
                key={idx}
                onClick={() => openCreateModalForDate(day.dateStr)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[220px] group ${
                  isToday 
                    ? 'bg-cyan-950/20 border-cyan-500/50 hover:bg-cyan-950/30' 
                    : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/40 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-2">
                    <span className={`text-xs font-bold ${isToday ? 'text-cyan-400' : 'text-slate-300'}`}>
                      {day.name}
                    </span>
                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                      isToday ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {day.dayNum}
                    </span>
                  </div>

                  {/* Tasks List Cards */}
                  <div className="space-y-2">
                    {dayTasks.map((t, tIdx) => (
                      <div
                        key={t.id || tIdx}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(t);
                        }}
                        className="p-2.5 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl text-xs space-y-1.5 transition-all shadow group/item relative"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="font-bold text-slate-100 line-clamp-1">{t.title || 'Visit Task'}</div>
                          <button
                            onClick={(e) => handleDeleteTask(t.id, e)}
                            className="text-slate-500 hover:text-rose-400 p-0.5 rounded opacity-0 group-hover/item:opacity-100 transition-opacity"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {t.customer_name && (
                          <div className="text-[11px] font-semibold text-cyan-400 truncate">
                            👤 {t.customer_name}
                          </div>
                        )}

                        {t.visit_location && (
                          <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                            <span>{t.visit_location}</span>
                          </div>
                        )}

                        {t.time_slot && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            ⏰ {t.time_slot}
                          </div>
                        )}

                        <div className="pt-1.5 border-t border-slate-800/60 flex flex-col gap-1 text-[10px]">
                          <div className="flex items-center justify-between text-slate-400">
                            <span>Assigned: <strong className="text-slate-200">{t.assigned_employee_name || 'You'}</strong></span>
                            <span className="font-mono text-cyan-400 font-bold">{t.hours}h</span>
                          </div>

                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] border ${
                              t.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                              t.status === 'IN_PROGRESS' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                              t.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                              'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {t.status || 'PLANNED'}
                            </span>

                            {t.priority && (
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                                t.priority === 'HIGH' ? 'bg-rose-950 text-rose-400' :
                                t.priority === 'MEDIUM' ? 'bg-amber-950 text-amber-400' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {t.priority}
                              </span>
                            )}
                          </div>

                          {t.rescheduled_to_task_id && (
                            <div className="text-[9px] text-amber-400 font-mono pt-0.5">
                              🔁 Rescheduled
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {dayTasks.length === 0 && (
                      <div className="text-[11px] text-slate-500 italic py-6 text-center group-hover:text-slate-400">
                        + Add Visit / Task
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Shared Calendar Visualization */}
      <SharedCalendar
        events={calendarEvents}
        initialYear={currentYear}
        initialMonth={currentMonth}
        onMonthChange={(y, m) => {
          setCurrentYear(y);
          setCurrentMonth(m);
        }}
        title="Weekly Work & Field Visit Calendar"
        subtitle="Visualizing customer field meetings, daily tasks, organization holidays, and workforce leaves"
      />

      {/* Task Create / Edit Detail Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-2xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-lg text-white">
                  {editingTask ? 'Edit Work Visit & Task Details' : 'Create Weekly Field Visit & Work Task'}
                </h3>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              {/* AREA 1: PLANNING & VISIT METADATA */}
              <div className="space-y-3">
                <div className="text-cyan-400 font-bold text-xs uppercase tracking-wider border-b border-slate-800 pb-1">
                  1. Visit & Task Planning Details
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {isManagement ? (
                    <div>
                      <label className="block text-slate-300 mb-1 font-medium">Assigned Employee *</label>
                      <select
                        value={formData.assignedEmployeeId || (employees.length > 0 ? employees[0].id : '')}
                        onChange={e => setFormData({ ...formData, assignedEmployeeId: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-semibold"
                      >
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_code})</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs flex items-center justify-between">
                      <span className="text-slate-400">Assigned To:</span>
                      <strong className="text-cyan-400 font-semibold">You (Self-Assigned)</strong>
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Task Title / Objective *</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                      placeholder="e.g. SGT University Visit / Microscope Demo"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Customer / Account Name</label>
                    <input
                      type="text"
                      value={formData.customerName}
                      onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                      placeholder="e.g. IIT Delhi / SGT University"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Contact Person</label>
                    <input
                      type="text"
                      value={formData.contactPerson}
                      onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                      placeholder="e.g. Dr. Vijay Kumar"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Contact Phone / Email</label>
                    <input
                      type="text"
                      value={formData.contactDetails}
                      onChange={e => setFormData({ ...formData, contactDetails: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                      placeholder="+91 9876543210 / email"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Visit Location / Place</label>
                    <input
                      type="text"
                      value={formData.visitLocation}
                      onChange={e => setFormData({ ...formData, visitLocation: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                      placeholder="e.g. Pusa Campus / Client Lab"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Visit Type</label>
                    <select
                      value={formData.visitType}
                      onChange={e => setFormData({ ...formData, visitType: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-semibold"
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
                    <label className="block text-slate-300 mb-1 font-medium">Time Slot</label>
                    <select
                      value={formData.timeSlot}
                      onChange={e => setFormData({ ...formData, timeSlot: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-semibold"
                    >
                      <option value="09:00-10:30">09:00-10:30</option>
                      <option value="10:30-12:00">10:30-12:00</option>
                      <option value="12:00-13:30">12:00-13:30</option>
                      <option value="15:30-17:00">15:30-17:00</option>
                      <option value="Full Day">Full Day</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Planned Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Planned Hours *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      required
                      value={formData.hours}
                      onChange={e => setFormData({ ...formData, hours: parseFloat(e.target.value) || 1 })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={e => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-semibold"
                    >
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Products / Solutions to Present</label>
                  <input
                    type="text"
                    value={formData.productsToPresent}
                    onChange={e => setFormData({ ...formData, productsToPresent: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                    placeholder="e.g. Electron Microscope / Analytical Instruments"
                  />
                </div>
              </div>

              {/* AREA 2: EXECUTION PROGRESS & OUTCOMES */}
              <div className="space-y-3 pt-2">
                <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider border-b border-slate-800 pb-1">
                  2. Visit Progress, Discussion Outcome & Follow-Up
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Task Status *</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-bold"
                    >
                      <option value="PLANNED">PLANNED</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Opportunity Stage</label>
                    <select
                      value={formData.opportunityStage}
                      onChange={e => setFormData({ ...formData, opportunityStage: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-semibold"
                    >
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
                    <label className="block text-slate-300 mb-1 font-medium">Estimated Opportunity Value (₹)</label>
                    <input
                      type="number"
                      value={formData.estimatedValue}
                      onChange={e => setFormData({ ...formData, estimatedValue: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-amber-300 font-mono"
                      placeholder="e.g. 250000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Discussion Outcome / Meeting Summary</label>
                  <textarea
                    rows={2}
                    value={formData.outcomeSummary}
                    onChange={e => setFormData({ ...formData, outcomeSummary: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                    placeholder="Discussed microscope requirements. Customer requested quotation and tech specs..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Next Required Action</label>
                    <input
                      type="text"
                      value={formData.nextAction}
                      onChange={e => setFormData({ ...formData, nextAction: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                      placeholder="Send commercial quotation and technical datasheet..."
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Next Follow-Up Date</label>
                    <input
                      type="date"
                      value={formData.followUpDate}
                      onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                    />
                  </div>
                </div>

                {formData.status === 'CANCELLED' && (
                  <div>
                    <label className="block text-rose-400 mb-1 font-medium">Cancellation Reason *</label>
                    <input
                      type="text"
                      value={formData.cancellationReason}
                      onChange={e => setFormData({ ...formData, cancellationReason: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-rose-800 rounded-xl text-rose-300"
                      placeholder="e.g. Customer cancelled meeting / Rescheduled by client..."
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-semibold shadow"
                >
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Task Modal */}
      {rescheduleTaskItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">Reschedule Task / Field Visit</h3>
              </div>
              <button onClick={() => setRescheduleTaskItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <p className="text-slate-400 font-medium">Task: <span className="text-slate-100 font-bold">{rescheduleTaskItem.title}</span></p>
                <p className="text-slate-400 font-medium">Original Date: <span className="text-amber-400 font-mono">{rescheduleTaskItem.date}</span></p>
                <p className="text-slate-500 text-[11px]">The original historical record will be preserved and linked to the new date.</p>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">New Planned Date *</label>
                <input
                  type="date"
                  required
                  value={rescheduleNewDate}
                  onChange={e => setRescheduleNewDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-cyan-300 font-mono rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Reschedule Reason</label>
                <input
                  type="text"
                  value={rescheduleReason}
                  onChange={e => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Customer requested later date..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl outline-none"
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
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-semibold shadow disabled:opacity-50"
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
