import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { FileText, Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Edit3, Trash2, X, CheckCircle2, User, Clock, AlertTriangle, Filter } from 'lucide-react';
import { SharedCalendar, CalendarEvent } from '../components/calendar/SharedCalendar';

export const Timesheets: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

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
    status: 'PLANNED'
  });
  const [formError, setFormError] = useState<string | null>(null);

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

      const [taskRes, empRes] = await Promise.all([
        apiFetch('/timesheets', { params: { startDate, endDate } }).catch(() => null),
        isManagement ? apiFetch('/employees').catch(() => []) : Promise.resolve([])
      ]);

      const rawTasks = Array.isArray(taskRes) ? taskRes : (taskRes?.tasks || taskRes?.timesheets || taskRes?.data?.tasks || []);
      setTasks(rawTasks);

      const fetchedEmps = Array.isArray(empRes) ? empRes : (empRes?.employees || empRes?.data || []);
      setEmployees(fetchedEmps);

      // Map to Calendar Events
      const events: CalendarEvent[] = rawTasks.map((t: any) => ({
        id: `task-${t.id}`,
        date: t.date.split('T')[0],
        type: 'TASK',
        title: `${t.assigned_employee_name || 'Employee'}: ${t.title || t.description || 'Daily Task'}`,
        status: t.status || 'PLANNED',
        employeeName: t.assigned_employee_name,
        metadata: {
          description: t.description,
          hours: t.hours,
          createdBy: t.created_by_email
        }
      }));

      setCalendarEvents(events);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [weekDays, isManagement]);

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
      status: 'PLANNED'
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
      date: task.date.split('T')[0],
      hours: task.hours || 8,
      status: task.status || 'PLANNED'
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.title || formData.title.trim() === '') {
      setFormError('Task Title is required.');
      return;
    }

    const payload = { ...formData };
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
      setFormError(err.message || 'Failed to save daily task entry.');
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

  const weekStartStr = weekDays[0].date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  const weekEndStr = weekDays[6].date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-cyan-400" />
            <span>Weekly Work Plan & Daily Task Management</span>
          </h1>
          <p className="text-xs text-slate-400">Plan daily tasks, assign work items to team members, and track daily progress</p>
        </div>

        <button
          onClick={() => openCreateModalForDate(new Date().toISOString().split('T')[0])}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create Daily Task</span>
        </button>
      </div>

      {/* Weekly Plan Navigation & Grid */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-cyan-400" />
              <span>Weekly Tasks: {weekStartStr} — {weekEndStr}</span>
            </h2>
            <p className="text-xs text-slate-400">Click any weekday to add a daily task for that date</p>
          </div>

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

        {/* 7-Day Weekly Grid (Mon - Sun) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {weekDays.map((day, idx) => {
            const isToday = day.dateStr === new Date().toISOString().split('T')[0];
            const dayTasks = tasksByDate.get(day.dateStr) || [];

            return (
              <div
                key={idx}
                onClick={() => openCreateModalForDate(day.dateStr)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[180px] group ${
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

                  {/* Tasks List */}
                  <div className="space-y-2">
                    {dayTasks.map((t, tIdx) => (
                      <div
                        key={t.id || tIdx}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(t);
                        }}
                        className="p-2.5 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl text-xs space-y-1 transition-all shadow group/item relative"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="font-bold text-slate-100 line-clamp-1">{t.title || t.description || 'Task'}</div>
                          <button
                            onClick={(e) => handleDeleteTask(t.id, e)}
                            className="text-slate-500 hover:text-rose-400 p-0.5 rounded opacity-0 group-hover/item:opacity-100 transition-opacity"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {t.description && <div className="text-[11px] text-slate-400 line-clamp-2">{t.description}</div>}

                        <div className="pt-1.5 border-t border-slate-800/60 flex flex-col gap-1 text-[10px]">
                          <div className="flex items-center justify-between text-slate-400">
                            <span>Assigned: <strong className="text-slate-200">{t.assigned_employee_name || 'You'}</strong></span>
                            <span className="font-mono text-cyan-400 font-bold">{t.hours}h</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] border ${
                              t.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                              t.status === 'IN_PROGRESS' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                              'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {t.status || 'PLANNED'}
                            </span>
                            {t.created_by_email && (
                              <span className="text-[9px] text-slate-500 truncate max-w-[80px]" title={`Created by ${t.created_by_email}`}>
                                By: {t.created_by_email.split('@')[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {dayTasks.length === 0 && (
                      <div className="text-[11px] text-slate-500 italic py-6 text-center group-hover:text-slate-400">
                        + Add Task
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unified Shared Calendar Visualization */}
      <SharedCalendar
        events={calendarEvents}
        initialYear={currentYear}
        initialMonth={currentMonth}
        onMonthChange={(y, m) => {
          setCurrentYear(y);
          setCurrentMonth(m);
        }}
        title="Weekly Plan & Task Calendar"
        subtitle="Visualizing planned work items, assigned employee tasks, company holidays, and leaves"
      />

      {/* Task Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">
                {editingTask ? 'Edit Daily Task' : 'Create Daily Task'}
              </h3>
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

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
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
                <label className="block text-slate-300 mb-1 font-medium">Task Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="e.g. Visit Client Site / Prepare Proposal"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="Additional task details and expected deliverables..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Status *</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-semibold"
                >
                  <option value="PLANNED">PLANNED</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-semibold shadow"
                >
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
