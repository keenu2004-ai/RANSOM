import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { FileText, Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Edit3, Trash2, X, CheckCircle2 } from 'lucide-react';
import { SharedCalendar, CalendarEvent } from '../components/calendar/SharedCalendar';

export const Timesheets: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);
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
    projectId: '',
    date: new Date().toISOString().split('T')[0],
    hours: 8,
    description: ''
  });
  const [formError, setFormError] = useState<string | null>(null);

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

  const fetchTimesheets = useCallback(async () => {
    setLoading(true);
    try {
      const projRes = await apiFetch('/timesheets/projects').catch(() => ({ projects: [] }));
      setProjects(projRes.projects || []);

      let resData: any[] = [];
      if (['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '')) {
        const allRes = await apiFetch('/timesheets', { params: { limit: 500 } }).catch(() => ({ timesheets: [] }));
        resData = allRes.timesheets || [];
      } else if (user?.employeeId) {
        const myRes = await apiFetch('/timesheets/my').catch(() => ({ timesheets: [] }));
        resData = myRes.timesheets || [];
      }

      setTimesheets(resData);

      // Map to Calendar Events
      const events: CalendarEvent[] = resData.map((t: any) => ({
        id: `task-${t.id}`,
        date: t.date,
        type: 'TASK',
        title: `${t.project_name || 'Task'}: ${t.hours}h`,
        status: t.status || 'SUBMITTED',
        employeeName: t.employee_name,
        metadata: { description: t.description, hours: t.hours, project: t.project_name }
      }));

      setCalendarEvents(events);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTimesheets();
  }, [fetchTimesheets]);

  const openCreateModalForDate = (dateStr: string) => {
    setEditingTask(null);
    setFormData({
      projectId: projects[0]?.id || '',
      date: dateStr,
      hours: 8,
      description: ''
    });
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (task: any) => {
    setEditingTask(task);
    const proj = projects.find(p => p.name === task.project_name);
    setFormData({
      projectId: proj?.id || projects[0]?.id || '',
      date: task.date.split('T')[0],
      hours: task.hours || 8,
      description: task.description || ''
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (editingTask) {
        await apiFetch(`/timesheets/${editingTask.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        await apiFetch('/timesheets', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }
      setShowModal(false);
      fetchTimesheets();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save task entry.');
    }
  };

  // Group timesheets by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    timesheets.forEach(t => {
      const dKey = t.date.split('T')[0];
      if (!map.has(dKey)) map.set(dKey, []);
      map.get(dKey)!.push(t);
    });
    return map;
  }, [timesheets]);

  const weekStartStr = weekDays[0].date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  const weekEndStr = weekDays[6].date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-cyan-400" />
            <span>Weekly Work Plan & Timesheets</span>
          </h1>
          <p className="text-xs text-slate-400">Plan tasks for each day of the week, log daily project hours, and visualize team workloads</p>
        </div>

        <button
          onClick={() => openCreateModalForDate(new Date().toISOString().split('T')[0])}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Work Item</span>
        </button>
      </div>

      {/* Weekly Plan Navigation & Grid */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-cyan-400" />
              <span>Weekly Work Plan: {weekStartStr} — {weekEndStr}</span>
            </h2>
            <p className="text-xs text-slate-400">Click any weekday to quickly create a planned task for that date</p>
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
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[160px] group ${
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
                  <div className="space-y-1.5">
                    {dayTasks.map((t, tIdx) => (
                      <div
                        key={tIdx}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(t);
                        }}
                        className="p-2 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl text-xs space-y-0.5 transition-all shadow"
                      >
                        <div className="font-semibold text-slate-100 truncate">{t.project_name || 'Project'}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-2">{t.description}</div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 font-mono text-[10px]">
                          <span className="text-cyan-400 font-bold">{t.hours} hrs</span>
                          {t.employee_code && <span className="text-slate-500">{t.employee_code}</span>}
                        </div>
                      </div>
                    ))}
                    {dayTasks.length === 0 && (
                      <div className="text-[11px] text-slate-500 italic py-4 text-center group-hover:text-slate-400">
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
        subtitle="Visualizing planned work items, logged project hours, company holidays, and leaves"
      />

      {/* Task Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">
                {editingTask ? 'Edit Work Item' : 'Create Weekly Work Item'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl">{formError}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Project *</label>
                <select
                  value={formData.projectId}
                  onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
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
                    required
                    value={formData.hours}
                    onChange={e => setFormData({ ...formData, hours: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Task Title & Description *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  placeholder="Describe planned tasks and deliverables..."
                />
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
                  {editingTask ? 'Save Changes' : 'Create Work Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
