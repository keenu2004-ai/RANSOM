import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import {
  CalendarCheck, Plus, Trash2, Edit3, Search, ChevronLeft, ChevronRight,
  MapPin, Users, Globe, Clock, X, AlertTriangle, Calendar as CalendarIcon, Check
} from 'lucide-react';

export const Holidays: React.FC = () => {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Month navigation for Left Monthly Calendar Grid
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(() => new Date());
  const [activeTab, setActiveTab] = useState<'month' | 'week' | 'list'>('month');

  // Filters for Right Holiday List
  const [listSearch, setListSearch] = useState('');
  const [listRegionFilter, setListRegionFilter] = useState<'ALL' | 'UPCOMING' | 'NORTH' | 'SOUTH'>('ALL');

  // Add / Edit Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [empSearch, setEmpSearch] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    date: '',
    holidayType: 'COMPANY',
    description: '',
    assignmentScope: 'ALL' as 'ALL' | 'REGION' | 'EMPLOYEES',
    region: 'NORTH' as 'NORTH' | 'SOUTH',
    selectedEmployeeIds: [] as string[]
  });

  const isManagement = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user?.role || '');

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const year = selectedMonthDate.getFullYear();
      const [holRes, empRes] = await Promise.all([
        apiFetch('/holidays', { params: { year } }),
        isManagement ? apiFetch('/employees').catch(() => []) : Promise.resolve([])
      ]);

      const fetchedHols = holRes.holidays || holRes.data?.holidays || [];
      setHolidays(fetchedHols);

      const fetchedEmps = Array.isArray(empRes) ? empRes : (empRes?.employees || empRes?.data || []);
      setEmployees(fetchedEmps);
    } catch (err) {
      console.error('Error fetching holidays:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonthDate, isManagement]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const totalHolidays = holidays.length;
    const northHolidays = holidays.filter(h => h.assignment_scope === 'REGION' && h.region === 'NORTH').length;
    const southHolidays = holidays.filter(h => h.assignment_scope === 'REGION' && h.region === 'SOUTH').length;

    const today = new Date();
    today.setHours(0,0,0,0);
    const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const upcomingHolidays = holidays.filter(h => {
      const d = new Date(h.date);
      return d >= today && d <= in30Days;
    }).length;

    return { totalHolidays, northHolidays, southHolidays, upcomingHolidays };
  }, [holidays]);

  // Group holidays by date string "YYYY-MM-DD"
  const holidaysByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    holidays.forEach(h => {
      const dKey = h.date;
      if (dKey) {
        if (!map.has(dKey)) map.set(dKey, []);
        map.get(dKey)!.push(h);
      }
    });
    return map;
  }, [holidays]);

  // Left Calendar Days Grid (Sun -> Sat)
  const monthGrid = useMemo(() => {
    const year = selectedMonthDate.getFullYear();
    const month = selectedMonthDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDay = firstDay.getDay(); // 0 = Sun
    const totalDays = lastDay.getDate();

    const grid = [];
    const prevLastDay = new Date(year, month, 0).getDate();

    // Padding previous month
    for (let i = startDay - 1; i >= 0; i--) {
      const dayNum = prevLastDay - i;
      const d = new Date(year, month - 1, dayNum);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      grid.push({
        date: d,
        dateStr: `${yStr}-${mStr}-${dStr}`,
        dayNum,
        isCurrentMonth: false
      });
    }

    // Current month
    for (let i = 1; i <= totalDays; i++) {
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

    // Padding next month
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

  // Right Side Filtered Holidays List
  const filteredHolidaysList = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);

    return holidays.filter(h => {
      if (listSearch) {
        const term = listSearch.toLowerCase();
        const titleMatch = h.title?.toLowerCase().includes(term);
        const descMatch = h.description?.toLowerCase().includes(term);
        if (!titleMatch && !descMatch) return false;
      }

      if (listRegionFilter === 'NORTH') {
        if (!(h.assignment_scope === 'REGION' && h.region === 'NORTH')) return false;
      } else if (listRegionFilter === 'SOUTH') {
        if (!(h.assignment_scope === 'REGION' && h.region === 'SOUTH')) return false;
      } else if (listRegionFilter === 'UPCOMING') {
        const d = new Date(h.date);
        if (d < today) return false;
      }
      return true;
    });
  }, [holidays, listSearch, listRegionFilter]);

  // Modal Handlers
  const handleOpenAddModal = (defaultDate?: string) => {
    setEditingHoliday(null);
    setFormError(null);
    setEmpSearch('');
    setFormData({
      title: '',
      date: defaultDate || '',
      holidayType: 'COMPANY',
      description: '',
      assignmentScope: 'ALL',
      region: 'NORTH',
      selectedEmployeeIds: []
    });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (holiday: any) => {
    setEditingHoliday(holiday);
    setFormError(null);
    setEmpSearch('');

    const assignedIds = Array.isArray(holiday.assigned_employees)
      ? holiday.assigned_employees.map((e: any) => e.id)
      : [];

    setFormData({
      title: holiday.title || '',
      date: holiday.date || '',
      holidayType: holiday.holiday_type || 'COMPANY',
      description: holiday.description || '',
      assignmentScope: holiday.assignment_scope || 'ALL',
      region: holiday.region || 'NORTH',
      selectedEmployeeIds: assignedIds
    });
    setShowAddModal(true);
  };

  const handleToggleEmployeeSelect = (empId: string) => {
    setFormData(prev => {
      const exists = prev.selectedEmployeeIds.includes(empId);
      if (exists) {
        return { ...prev, selectedEmployeeIds: prev.selectedEmployeeIds.filter(id => id !== empId) };
      } else {
        return { ...prev, selectedEmployeeIds: [...prev.selectedEmployeeIds, empId] };
      }
    });
  };

  const filteredEmployeesForModal = useMemo(() => {
    if (!empSearch) return employees;
    const term = empSearch.toLowerCase();
    return employees.filter(e =>
      e.first_name?.toLowerCase().includes(term) ||
      e.last_name?.toLowerCase().includes(term) ||
      e.employee_code?.toLowerCase().includes(term)
    );
  }, [employees, empSearch]);

  const handleSelectAllVisible = () => {
    const visibleIds = filteredEmployeesForModal.map(e => e.id);
    setFormData(prev => ({
      ...prev,
      selectedEmployeeIds: Array.from(new Set([...prev.selectedEmployeeIds, ...visibleIds]))
    }));
  };

  const handleClearSelection = () => {
    setFormData(prev => ({ ...prev, selectedEmployeeIds: [] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.title || formData.title.trim() === '') {
      setFormError('Holiday title is required.');
      return;
    }
    if (!formData.date) {
      setFormError('Holiday date is required.');
      return;
    }

    if (formData.assignmentScope === 'REGION' && !formData.region) {
      setFormError('Please select a valid Region (North or South).');
      return;
    }

    if (formData.assignmentScope === 'EMPLOYEES' && formData.selectedEmployeeIds.length === 0) {
      setFormError('Please select at least one employee for Specific Employees scope.');
      return;
    }

    const payload = {
      title: formData.title.trim(),
      date: formData.date,
      holidayType: formData.holidayType,
      description: formData.description ? formData.description.trim() : undefined,
      assignmentScope: formData.assignmentScope,
      region: formData.assignmentScope === 'REGION' ? formData.region : null,
      employeeIds: formData.assignmentScope === 'EMPLOYEES' ? formData.selectedEmployeeIds : []
    };

    try {
      if (editingHoliday) {
        await apiFetch(`/holidays/${editingHoliday.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/holidays', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setShowAddModal(false);
      await fetchHolidays();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save holiday entry.');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this holiday entry?')) return;
    try {
      await apiFetch(`/holidays/${id}`, { method: 'DELETE' });
      await fetchHolidays();
    } catch (err: any) {
      alert(err.message || 'Failed to delete holiday.');
    }
  };

  const currentMonthDisplay = selectedMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-600/20 text-purple-400 rounded-2xl border border-purple-500/30 shadow-lg shadow-purple-500/10">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">Holiday Calendar</h1>
            <p className="text-xs text-slate-400">Manage and view company and regional holidays assigned to specific employees</p>
          </div>
        </div>

        {isManagement && (
          <button
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-600/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Holiday</span>
          </button>
        )}
      </div>

      {/* KPI Cards (4 Cards Only - Holiday Specific) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL HOLIDAYS */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Total Holidays</span>
            <div className="text-2xl font-extrabold text-white">{kpis.totalHolidays}</div>
            <div className="text-[11px] text-slate-400">This year</div>
          </div>
          <div className="p-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl">
            <CalendarIcon className="w-6 h-6" />
          </div>
        </div>

        {/* NORTH REGION */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">North Region</span>
            <div className="text-2xl font-extrabold text-white">{kpis.northHolidays}</div>
            <div className="text-[11px] text-slate-400">Assigned holidays</div>
          </div>
          <div className="p-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl">
            <Globe className="w-6 h-6" />
          </div>
        </div>

        {/* SOUTH REGION */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">South Region</span>
            <div className="text-2xl font-extrabold text-white">{kpis.southHolidays}</div>
            <div className="text-[11px] text-slate-400">Assigned holidays</div>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* UPCOMING HOLIDAYS */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Upcoming Holidays</span>
            <div className="text-2xl font-extrabold text-white">{kpis.upcomingHolidays}</div>
            <div className="text-[11px] text-slate-400">Next 30 days</div>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left Monthly Calendar | Right Holidays List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Side: Monthly Holiday Calendar (8 Cols) */}
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">

          {/* Calendar Header Controls */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="p-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl transition-all"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-base font-extrabold text-white tracking-tight px-2">{currentMonthDisplay}</h2>
              <button
                onClick={() => setSelectedMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="p-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl transition-all"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setActiveTab('month')}
                className={`px-3 py-1 rounded-lg transition-all ${activeTab === 'month' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
              >
                Month
              </button>
              <button
                onClick={() => setActiveTab('week')}
                className={`px-3 py-1 rounded-lg transition-all ${activeTab === 'week' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
              >
                Week
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`px-3 py-1 rounded-lg transition-all ${activeTab === 'list' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
              >
                List
              </button>
            </div>
          </div>

          {/* 7-Column Sunday -> Saturday Grid Header */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-extrabold uppercase tracking-wider text-purple-400 border-b border-slate-800 pb-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Month Day Cells */}
          <div className="grid grid-cols-7 gap-2">
            {monthGrid.map((cell, cIdx) => {
              const dayHols = holidaysByDate.get(cell.dateStr) || [];
              const isToday = cell.dateStr === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={cIdx}
                  onClick={() => isManagement && handleOpenAddModal(cell.dateStr)}
                  className={`min-h-[105px] p-2 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer group ${
                    !cell.isCurrentMonth
                      ? 'bg-slate-950/20 border-slate-900/40 text-slate-600 opacity-40'
                      : isToday
                      ? 'bg-purple-950/30 border-purple-500/80 shadow-md ring-1 ring-purple-500/40'
                      : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
                      isToday ? 'bg-purple-600 text-white font-extrabold' : 'text-slate-300'
                    }`}>
                      {cell.dayNum}
                    </span>
                  </div>

                  {/* Holiday Event Badges */}
                  <div className="space-y-1 my-1">
                    {dayHols.map((h, hIdx) => {
                      const isNorth = h.assignment_scope === 'REGION' && h.region === 'NORTH';
                      const isSouth = h.assignment_scope === 'REGION' && h.region === 'SOUTH';
                      const isAll = h.assignment_scope === 'ALL';

                      return (
                        <div
                          key={h.id || hIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isManagement) handleOpenEditModal(h);
                          }}
                          className={`p-1.5 rounded-lg border text-[10px] space-y-0.5 shadow transition-all ${
                            isNorth ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-200' :
                            isSouth ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200' :
                            isAll ? 'bg-purple-950/80 border-purple-500/50 text-purple-200' :
                            'bg-cyan-950/80 border-cyan-500/50 text-cyan-200'
                          }`}
                        >
                          <div className="font-extrabold truncate leading-tight">{h.title}</div>
                          <div className="text-[8px] opacity-80 uppercase font-semibold">
                            {isNorth ? 'North Region' : isSouth ? 'South Region' : isAll ? 'All Hands' : `${h.assigned_employee_count || 0} Employees`}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {dayHols.length === 0 && (
                    <div className="text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity text-center">
                      + Add
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Holidays List Panel (4 Cols) */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">Holidays List</h3>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search holidays..."
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-semibold">
              <button
                onClick={() => setListRegionFilter('ALL')}
                className={`px-3 py-1 rounded-xl transition-all ${
                  listRegionFilter === 'ALL' ? 'bg-purple-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setListRegionFilter('UPCOMING')}
                className={`px-3 py-1 rounded-xl transition-all ${
                  listRegionFilter === 'UPCOMING' ? 'bg-purple-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Upcoming
              </button>
              <button
                onClick={() => setListRegionFilter('NORTH')}
                className={`px-3 py-1 rounded-xl transition-all ${
                  listRegionFilter === 'NORTH' ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                North Region
              </button>
              <button
                onClick={() => setListRegionFilter('SOUTH')}
                className={`px-3 py-1 rounded-xl transition-all ${
                  listRegionFilter === 'SOUTH' ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                South Region
              </button>
            </div>

            {/* List Cards */}
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredHolidaysList.map(h => {
                const isNorth = h.assignment_scope === 'REGION' && h.region === 'NORTH';
                const isSouth = h.assignment_scope === 'REGION' && h.region === 'SOUTH';
                const isAll = h.assignment_scope === 'ALL';

                return (
                  <div
                    key={h.id}
                    className="p-3 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-2xl space-y-2 transition-all shadow-md group relative"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl border ${
                          isNorth ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' :
                          isSouth ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        }`}>
                          <CalendarIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-100 text-xs">{h.title}</h4>
                          <span className="font-mono text-[10px] text-slate-400">{h.date}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          isNorth ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' :
                          isSouth ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                          isAll ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' :
                          'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                        }`}>
                          {isNorth ? 'North Region' : isSouth ? 'South Region' : isAll ? 'All Employees' : `${h.assigned_employee_count || 0} Employees`}
                        </span>

                        {isManagement && (
                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenEditModal(h)} className="p-1 text-slate-400 hover:text-purple-400" title="Edit">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => handleDelete(h.id, e)} className="p-1 text-slate-400 hover:text-rose-400" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {h.description && (
                      <p className="text-[11px] text-slate-400 pl-9 line-clamp-2">{h.description}</p>
                    )}
                  </div>
                );
              })}

              {filteredHolidaysList.length === 0 && (
                <div className="p-8 text-center text-slate-500 italic text-xs border border-slate-800/80 rounded-2xl">
                  No holidays match the selected filter.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ADD / EDIT HOLIDAY MODAL WITH MULTI-SELECT EMPLOYEES */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base leading-tight">
                    {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Create a holiday and assign it to specific employees or regions</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Holiday Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Diwali, Christmas, Local Holiday"
                    className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 font-mono focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Holiday Type *</label>
                  <select
                    value={formData.holidayType}
                    onChange={e => setFormData({ ...formData, holidayType: e.target.value })}
                    className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 font-medium focus:border-purple-500 focus:outline-none"
                  >
                    <option value="COMPANY">Company Holiday</option>
                    <option value="NATIONAL">National Holiday</option>
                    <option value="OPTIONAL">Optional Holiday</option>
                    <option value="REGIONAL">Regional Holiday</option>
                  </select>
                </div>

                {formData.assignmentScope === 'REGION' && (
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Region *</label>
                    <select
                      value={formData.region}
                      onChange={e => setFormData({ ...formData, region: e.target.value as any })}
                      className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 font-semibold focus:border-purple-500 focus:outline-none"
                    >
                      <option value="NORTH">North Region</option>
                      <option value="SOUTH">South Region</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add a short description..."
                  className="w-full px-3 py-2 bg-[#060911] border border-slate-800 rounded-xl text-slate-200 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Assignment Scope Selector */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="block text-slate-300 font-semibold">Assign To *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div
                    onClick={() => setFormData({ ...formData, assignmentScope: 'ALL' })}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      formData.assignmentScope === 'ALL'
                        ? 'bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/20 text-white font-bold'
                        : 'bg-[#060911] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs">All Employees</div>
                    <div className="text-[10px] text-slate-500 font-normal">Company wide</div>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, assignmentScope: 'REGION' })}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      formData.assignmentScope === 'REGION'
                        ? 'bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/20 text-white font-bold'
                        : 'bg-[#060911] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs">Entire Region</div>
                    <div className="text-[10px] text-slate-500 font-normal">North or South region</div>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, assignmentScope: 'EMPLOYEES' })}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      formData.assignmentScope === 'EMPLOYEES'
                        ? 'bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/20 text-white font-bold'
                        : 'bg-[#060911] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs">Specific Employees</div>
                    <div className="text-[10px] text-slate-500 font-normal">Multi-select employees</div>
                  </div>
                </div>
              </div>

              {/* Specific Employees Multi-Select Box */}
              {formData.assignmentScope === 'EMPLOYEES' && (
                <div className="space-y-3 p-4 bg-[#060911] border border-slate-800 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 text-xs">
                      Select Employees * ({formData.selectedEmployeeIds.length} selected)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllVisible}
                        className="text-[10px] font-bold text-purple-400 hover:text-purple-300"
                      >
                        Select All Visible
                      </button>
                      <span className="text-slate-700">|</span>
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        className="text-[10px] font-bold text-slate-400 hover:text-white"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search employees by name or code..."
                      value={empSearch}
                      onChange={e => setEmpSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {filteredEmployeesForModal.map(emp => {
                      const isChecked = formData.selectedEmployeeIds.includes(emp.id);
                      return (
                        <div
                          key={emp.id}
                          onClick={() => handleToggleEmployeeSelect(emp.id)}
                          className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all text-xs ${
                            isChecked
                              ? 'bg-purple-950/30 border-purple-500 text-white font-semibold'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                            />
                            <div>
                              <span>{emp.first_name} {emp.last_name}</span>
                              <span className="text-[10px] font-mono text-slate-500 ml-1.5">({emp.employee_code})</span>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            emp.region === 'SOUTH' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            emp.region === 'NORTH' ? 'bg-indigo-950 text-indigo-400 border border-indigo-800' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {emp.region || 'Unassigned'}
                          </span>
                        </div>
                      );
                    })}
                    {filteredEmployeesForModal.length === 0 && (
                      <div className="p-4 text-center text-slate-500 italic text-xs">No matching employees found.</div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-xs shadow-lg shadow-purple-600/25"
                >
                  Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
