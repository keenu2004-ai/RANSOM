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
          <div className="p-3 bg-[var(--color-primary-soft)] text-[var(--color-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-sm">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">Holiday Calendar</h1>
            <p className="text-xs text-[var(--text-secondary)]">Manage and view company and regional holidays assigned to specific employees</p>
          </div>
        </div>

        {isManagement && (
          <button
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Holiday</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className={`grid grid-cols-1 ${isManagement ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'} gap-4`}>
        {/* TOTAL HOLIDAYS */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[var(--text-secondary)] tracking-wider uppercase">Total Holidays</span>
            <div className="text-2xl font-extrabold text-[var(--text-primary)]">{kpis.totalHolidays}</div>
            <div className="text-[11px] text-[var(--text-muted)]">This year</div>
          </div>
          <div className="p-3 bg-[var(--color-primary-soft)] text-[var(--color-primary)] border border-[var(--border-subtle)] rounded-xl">
            <CalendarIcon className="w-6 h-6" />
          </div>
        </div>

        {/* NORTH REGION - Management Only */}
        {isManagement && (
          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)] tracking-wider uppercase">North Region</span>
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">{kpis.northHolidays}</div>
              <div className="text-[11px] text-[var(--text-muted)]">Assigned holidays</div>
            </div>
            <div className="p-3 bg-[var(--color-info-soft)] text-[var(--color-info)] border border-[var(--color-info)]/20 rounded-xl">
              <Globe className="w-6 h-6" />
            </div>
          </div>
        )}

        {/* SOUTH REGION - Management Only */}
        {isManagement && (
          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)] tracking-wider uppercase">South Region</span>
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">{kpis.southHolidays}</div>
              <div className="text-[11px] text-[var(--text-muted)]">Assigned holidays</div>
            </div>
            <div className="p-3 bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/20 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
          </div>
        )}

        {/* UPCOMING HOLIDAYS */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[var(--text-secondary)] tracking-wider uppercase">Upcoming Holidays</span>
            <div className="text-2xl font-extrabold text-[var(--text-primary)]">{kpis.upcomingHolidays}</div>
            <div className="text-[11px] text-[var(--text-muted)]">Next 30 days</div>
          </div>
          <div className="p-3 bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[var(--color-warning)]/20 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left Monthly Calendar | Right Holidays List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Side: Monthly Holiday Calendar (8 Cols) */}
        <div className="lg:col-span-8 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-5 shadow-sm space-y-4">

          {/* Calendar Header Controls */}
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="p-1.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] rounded-xl transition-all shadow-sm cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight px-2">{currentMonthDisplay}</h2>
              <button
                onClick={() => setSelectedMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="p-1.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] rounded-xl transition-all shadow-sm cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setActiveTab('month')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${activeTab === 'month' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-[var(--text-secondary)]'}`}
              >
                Month
              </button>
              <button
                onClick={() => setActiveTab('week')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${activeTab === 'week' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-[var(--text-secondary)]'}`}
              >
                Week
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${activeTab === 'list' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-[var(--text-secondary)]'}`}
              >
                List
              </button>
            </div>
          </div>

          {/* 7-Column Sunday -> Saturday Grid Header */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase tracking-wider text-[var(--color-primary)] border-b border-[var(--border-subtle)] pb-2">
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
                      ? 'bg-[var(--bg-surface-muted)]/40 border-[var(--border-subtle)] text-[var(--text-muted)] opacity-40'
                      : isToday
                      ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary)] shadow-sm ring-1 ring-[var(--color-primary)]/40'
                      : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] hover:border-[var(--border-default)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
                      isToday ? 'bg-[var(--color-primary)] text-white font-extrabold' : 'text-[var(--text-secondary)]'
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
                          className={`p-1.5 rounded-lg border text-[10px] space-y-0.5 shadow-sm transition-all ${
                            isNorth ? 'bg-[var(--color-info-soft)] border-[var(--color-info)]/30 text-[var(--color-info)]' :
                            isSouth ? 'bg-[var(--color-success-soft)] border-[var(--color-success)]/30 text-[var(--color-success)]' :
                            isAll ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary)]/30 text-[var(--color-primary)]' :
                            'bg-[var(--color-warning-soft)] border-[var(--color-warning)]/30 text-[var(--color-warning)]'
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
                    <div className="text-[10px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity text-center">
                      + Add
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Holidays List Panel (4 Cols) */}
        <div className="lg:col-span-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="font-bold text-[var(--text-primary)] text-sm">Holidays List</h3>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search holidays..."
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-semibold">
              <button
                onClick={() => setListRegionFilter('ALL')}
                className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                  listRegionFilter === 'ALL' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setListRegionFilter('UPCOMING')}
                className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                  listRegionFilter === 'UPCOMING' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)]'
                }`}
              >
                Upcoming
              </button>
              {isManagement && (
                <>
                  <button
                    onClick={() => setListRegionFilter('NORTH')}
                    className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                      listRegionFilter === 'NORTH' ? 'bg-[var(--color-info)] text-white shadow-sm' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)]'
                    }`}
                  >
                    North Region
                  </button>
                  <button
                    onClick={() => setListRegionFilter('SOUTH')}
                    className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                      listRegionFilter === 'SOUTH' ? 'bg-[var(--color-success)] text-white shadow-sm' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)]'
                    }`}
                  >
                    South Region
                  </button>
                </>
              )}
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
                    className="p-3 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] rounded-2xl space-y-2 transition-all shadow-sm group relative"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl border ${
                          isNorth ? 'bg-[var(--color-info-soft)] text-[var(--color-info)] border-[var(--color-info)]/30' :
                          isSouth ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/30' :
                          'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[var(--border-subtle)]'
                        }`}>
                          <CalendarIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-[var(--text-primary)] text-xs">{h.title}</h4>
                          <span className="font-mono text-[10px] text-[var(--text-muted)]">{h.date}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {isManagement ? (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            isNorth ? 'bg-[var(--color-info-soft)] text-[var(--color-info)] border-[var(--color-info)]/30' :
                            isSouth ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/30' :
                            isAll ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[var(--border-subtle)]' :
                            'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]/30'
                          }`}>
                            {isNorth ? 'North Region' : isSouth ? 'South Region' : isAll ? 'All Employees' : `${h.assigned_employee_count || 0} Employees`}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[var(--border-subtle)]">
                            Company Holiday
                          </span>
                        )}

                        {isManagement && (
                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenEditModal(h)} className="p-1 text-[var(--text-muted)] hover:text-[var(--color-primary)] cursor-pointer" title="Edit">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => handleDelete(h.id, e)} className="p-1 text-[var(--text-muted)] hover:text-[var(--color-danger)] cursor-pointer" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isManagement && h.description && (
                      <p className="text-[11px] text-[var(--text-secondary)] pl-9 line-clamp-2">{h.description}</p>
                    )}
                  </div>
                );
              })}

              {filteredHolidaysList.length === 0 && (
                <div className="p-8 text-center text-[var(--text-muted)] italic text-xs border border-[var(--border-subtle)] rounded-2xl">
                  No holidays match the selected filter.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ADD / EDIT HOLIDAY MODAL WITH MULTI-SELECT EMPLOYEES */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[var(--color-primary-soft)] text-[var(--color-primary)] rounded-xl border border-[var(--border-subtle)]">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[var(--text-primary)] text-base leading-tight">
                    {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Create a holiday and assign it to specific employees or regions</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-secondary)] mb-1 font-semibold">Holiday Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Diwali, Christmas, Local Holiday"
                    className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-secondary)] mb-1 font-semibold">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text-primary)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-secondary)] mb-1 font-semibold">Holiday Type *</label>
                  <select
                    value={formData.holidayType}
                    onChange={e => setFormData({ ...formData, holidayType: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text-primary)] font-medium focus:border-[var(--color-primary)] focus:outline-none"
                  >
                    <option value="COMPANY">Company Holiday</option>
                    <option value="NATIONAL">National Holiday</option>
                    <option value="OPTIONAL">Optional Holiday</option>
                    <option value="REGIONAL">Regional Holiday</option>
                  </select>
                </div>

                {formData.assignmentScope === 'REGION' && (
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1 font-semibold">Region *</label>
                    <select
                      value={formData.region}
                      onChange={e => setFormData({ ...formData, region: e.target.value as any })}
                      className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text-primary)] font-semibold focus:border-[var(--color-primary)] focus:outline-none"
                    >
                      <option value="NORTH">North Region</option>
                      <option value="SOUTH">South Region</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[var(--text-secondary)] mb-1 font-semibold">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add a short description..."
                  className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
                />
              </div>

              {/* Assignment Scope Selector */}
              <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                <label className="block text-[var(--text-secondary)] font-semibold">Assign To *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div
                    onClick={() => setFormData({ ...formData, assignmentScope: 'ALL' })}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      formData.assignmentScope === 'ALL'
                        ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20 text-[var(--text-primary)] font-bold'
                        : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div className="text-xs">All Employees</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-normal">Company wide</div>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, assignmentScope: 'REGION' })}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      formData.assignmentScope === 'REGION'
                        ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20 text-[var(--text-primary)] font-bold'
                        : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div className="text-xs">Entire Region</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-normal">North or South region</div>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, assignmentScope: 'EMPLOYEES' })}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      formData.assignmentScope === 'EMPLOYEES'
                        ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20 text-[var(--text-primary)] font-bold'
                        : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div className="text-xs">Specific Employees</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-normal">Multi-select employees</div>
                  </div>
                </div>
              </div>

              {/* Specific Employees Multi-Select Box */}
              {formData.assignmentScope === 'EMPLOYEES' && (
                <div className="space-y-3 p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--text-primary)] text-xs">
                      Select Employees * ({formData.selectedEmployeeIds.length} selected)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllVisible}
                        className="text-[10px] font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
                      >
                        Select All Visible
                      </button>
                      <span className="text-[var(--border-default)]">|</span>
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search employees by name or code..."
                      value={empSearch}
                      onChange={e => setEmpSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-primary)]"
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
                              ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary)] text-[var(--text-primary)] font-semibold'
                              : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded border-[var(--border-default)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                            />
                            <div>
                              <span>{emp.first_name} {emp.last_name}</span>
                              <span className="text-[10px] font-mono text-[var(--text-muted)] ml-1.5">({emp.employee_code})</span>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            emp.region === 'SOUTH' ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/20' :
                            emp.region === 'NORTH' ? 'bg-[var(--color-info-soft)] text-[var(--color-info)] border border-[var(--color-info)]/20' :
                            'bg-[var(--bg-surface-muted)] text-[var(--text-muted)]'
                          }`}>
                            {emp.region || 'Unassigned'}
                          </span>
                        </div>
                      );
                    })}
                    {filteredEmployeesForModal.length === 0 && (
                      <div className="p-4 text-center text-[var(--text-muted)] italic text-xs">No matching employees found.</div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] rounded-xl font-medium text-xs border border-[var(--border-default)] shadow-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-semibold text-xs shadow-sm cursor-pointer"
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
