import React, { useState, useMemo } from 'react';
import { normalizeDateOnly } from '../../utils/dateUtils';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter,
  CheckCircle2, XCircle, Clock, Palmtree, Award, Briefcase, X
} from 'lucide-react';

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD format
  type: 'ATTENDANCE' | 'LEAVE' | 'HOLIDAY' | 'TASK' | 'WEEKLY_PLAN';
  title: string;
  status?: string;
  source?: string;
  employeeName?: string;
  metadata?: Record<string, any>;
}

export interface SharedCalendarProps {
  events: CalendarEvent[];
  initialYear?: number;
  initialMonth?: number; // 0 = Jan, 11 = Dec
  onMonthChange?: (year: number, month: number) => void;
  onEventClick?: (event: CalendarEvent) => void;
  title?: string;
  subtitle?: string;
  attendanceOnly?: boolean;
  summaryOverride?: { present?: number; absent?: number };
}

export const SharedCalendar: React.FC<SharedCalendarProps> = ({
  events,
  initialYear = new Date().getFullYear(),
  initialMonth = new Date().getMonth(),
  onMonthChange,
  onEventClick,
  subtitle = "Attendance, leave, company holidays, and weekly project tasks in one unified view",
  attendanceOnly = false,
  summaryOverride
}) => {
  const [currentYear, setCurrentYear] = useState<number>(initialYear);
  const [currentMonth, setCurrentMonth] = useState<number>(initialMonth);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ dateStr: string; events: CalendarEvent[] } | null>(null);

  // Filters
  const [showAttendance, setShowAttendance] = useState(true);
  const [showLeave, setShowLeave] = useState(!attendanceOnly);
  const [showHolidays, setShowHolidays] = useState(true);
  const [showTasks, setShowTasks] = useState(!attendanceOnly);

  // Handle Month Navigation
  const handlePrevMonth = () => {
    let newM = currentMonth - 1;
    let newY = currentYear;
    if (newM < 0) {
      newM = 11;
      newY -= 1;
    }
    setCurrentMonth(newM);
    setCurrentYear(newY);
    if (onMonthChange) onMonthChange(newY, newM);
  };

  const handleNextMonth = () => {
    let newM = currentMonth + 1;
    let newY = currentYear;
    if (newM > 11) {
      newM = 0;
      newY += 1;
    }
    setCurrentMonth(newM);
    setCurrentYear(newY);
    if (onMonthChange) onMonthChange(newY, newM);
  };

  // Month Matrix Computation
  const monthData = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon ...

    const weeks: Array<Array<{ date: Date | null; dateStr: string | null }>> = [];
    let currentWeek: Array<{ date: Date | null; dateStr: string | null }> = [];

    // Empty lead-in cells
    for (let i = 0; i < startingDayOfWeek; i++) {
      currentWeek.push({ date: null, dateStr: null });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(currentYear, currentMonth, day);
      const mStr = String(currentMonth + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateStr = `${currentYear}-${mStr}-${dStr}`;

      currentWeek.push({ date: dateObj, dateStr });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Trailing empty cells
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: null, dateStr: null });
      }
      weeks.push(currentWeek);
    }

    return { daysInMonth, weeks };
  }, [currentYear, currentMonth]);

  // Filtered Events Map
  const filteredEventsMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    events.forEach(evt => {
      if (evt.type === 'ATTENDANCE' && !showAttendance) return;
      if (evt.type === 'LEAVE' && !showLeave) return;
      if (evt.type === 'HOLIDAY' && !showHolidays) return;
      if ((evt.type === 'TASK' || evt.type === 'WEEKLY_PLAN') && !showTasks) return;

      const dateKey = normalizeDateOnly(evt.date);
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(evt);
    });

    return map;
  }, [events, showAttendance, showLeave, showHolidays, showTasks]);

  // Monthly Summary Calculations
  const summaryStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;
    let holidays = 0;
    let tasks = 0;

    events.forEach(evt => {
      const dateStr = normalizeDateOnly(evt.date);
      if (!dateStr || !dateStr.includes('-')) return;
      const [y, m] = dateStr.split('-').map(n => parseInt(n, 10));
      if (y === currentYear && m === (currentMonth + 1)) {
        if (evt.type === 'ATTENDANCE') {
          const st = (evt.status || '').toUpperCase();
          if (st === 'PRESENT' || st.includes('PRESENT')) present++;
          else if (st === 'ABSENT' || st.includes('ABSENT')) absent++;
          else if (st === 'HALF_DAY') halfDay++;
        } else if (evt.type === 'LEAVE') {
          leave++;
        } else if (evt.type === 'HOLIDAY') {
          holidays++;
        } else if (evt.type === 'TASK' || evt.type === 'WEEKLY_PLAN') {
          tasks++;
        }
      }
    });

    return { present, absent, halfDay, leave, holidays, tasks };
  }, [events, currentYear, currentMonth]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="space-y-6">
      {/* Calendar Header & Month Navigation */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-sm">
        <div>
          <h2 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[var(--primary)]" />
            <span>{monthNames[currentMonth]} {currentYear}</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] rounded-xl transition-all cursor-pointer shadow-sm"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-4 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm">
            <span>{monthNames[currentMonth]} {currentYear}</span>
          </div>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] rounded-xl transition-all cursor-pointer shadow-sm"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Monthly Summary Bar */}
      {attendanceOnly ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Present</span>
              <p className="text-2xl font-extrabold text-[var(--badge-success-text)] mt-0.5">
                {summaryOverride?.present !== undefined ? summaryOverride.present : summaryStats.present}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-[var(--badge-success-text)]" />
            </div>
          </div>
          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Absent</span>
              <p className="text-2xl font-extrabold text-[var(--action-danger-bg)] mt-0.5">
                {summaryOverride?.absent !== undefined ? summaryOverride.absent : summaryStats.absent}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-[var(--action-danger-bg)]" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Present</span>
              <CheckCircle2 className="w-4 h-4 text-[var(--badge-success-text)]" />
            </div>
            <p className="text-lg font-extrabold text-[var(--badge-success-text)] mt-1">{summaryStats.present}</p>
          </div>
          <div className="p-3.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Absent</span>
              <XCircle className="w-4 h-4 text-[var(--action-danger-bg)]" />
            </div>
            <p className="text-lg font-extrabold text-[var(--action-danger-bg)] mt-1">{summaryStats.absent}</p>
          </div>
          <div className="p-3.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Half Day</span>
              <Clock className="w-4 h-4 text-[var(--badge-warning-text)]" />
            </div>
            <p className="text-lg font-extrabold text-[var(--badge-warning-text)] mt-1">{summaryStats.halfDay}</p>
          </div>
          <div className="p-3.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Leave</span>
              <Palmtree className="w-4 h-4 text-[var(--primary)]" />
            </div>
            <p className="text-lg font-extrabold text-[var(--primary)] mt-1">{summaryStats.leave}</p>
          </div>
          <div className="p-3.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Holidays</span>
              <Award className="w-4 h-4 text-[var(--secondary)]" />
            </div>
            <p className="text-lg font-extrabold text-[var(--secondary)] mt-1">{summaryStats.holidays}</p>
          </div>
          <div className="p-3.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Tasks</span>
              <Briefcase className="w-4 h-4 text-[var(--text-secondary)]" />
            </div>
            <p className="text-lg font-extrabold text-[var(--text-primary)] mt-1">{summaryStats.tasks}</p>
          </div>
        </div>
      )}

      {/* Filter Toggles & Accessibility Legend */}
      {!attendanceOnly && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl text-xs shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>Filters:</span>
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <input type="checkbox" checked={showAttendance} onChange={e => setShowAttendance(e.target.checked)} className="rounded accent-[var(--primary)]" />
              <span>Attendance</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <input type="checkbox" checked={showLeave} onChange={e => setShowLeave(e.target.checked)} className="rounded accent-[var(--primary)]" />
              <span>Leave</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <input type="checkbox" checked={showHolidays} onChange={e => setShowHolidays(e.target.checked)} className="rounded accent-[var(--primary)]" />
              <span>Holidays</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <input type="checkbox" checked={showTasks} onChange={e => setShowTasks(e.target.checked)} className="rounded accent-[var(--primary)]" />
              <span>Tasks</span>
            </label>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[11px] font-medium text-[var(--text-muted)] flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--badge-success-text)]"></span> Present</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--action-danger-bg)]"></span> Absent</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--badge-warning-text)]"></span> Half Day</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--primary)]"></span> Leave</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--secondary)]"></span> Holiday</span>
          </div>
        </div>
      )}

      {/* Main Month Grid */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-sm">
        {/* Weekday Labels */}
        <div className="grid grid-cols-7 bg-[var(--bg-surface-muted)] border-b border-[var(--border-subtle)] text-center py-2.5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          <div className="text-[var(--action-danger-bg)]">Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div className="text-[var(--action-danger-bg)]">Sat</div>
        </div>

        {/* Month Weeks */}
        <div className="divide-y divide-[var(--border-subtle)]">
          {monthData.weeks.map((week, wIdx) => (
            <div key={wIdx} className="grid grid-cols-7 divide-x divide-[var(--border-subtle)]">
              {week.map((cell, cIdx) => {
                if (!cell.date || !cell.dateStr) {
                  return <div key={cIdx} className="min-h-[105px] bg-[var(--bg-surface-muted)]/30" />;
                }

                const dayNum = cell.date.getDate();
                const isWeekend = cIdx === 0 || cIdx === 6;
                const todayStr = normalizeDateOnly(new Date());
                const isToday = cell.dateStr === todayStr;
                const dayEvents = filteredEventsMap.get(cell.dateStr) || [];

                return (
                  <div
                    key={cIdx}
                    onClick={() => dayEvents.length > 0 && setSelectedDayEvents({ dateStr: cell.dateStr!, events: dayEvents })}
                    className={`min-h-[105px] p-2 transition-all cursor-pointer relative group flex flex-col justify-between ${
                      isToday
                        ? 'bg-[var(--primary)]/10 border-2 border-[var(--primary)]'
                        : isWeekend
                        ? 'bg-[var(--bg-surface-muted)]/40 hover:bg-[var(--bg-surface-hover)]'
                        : 'hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    {/* Day Number Header */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
                        isToday ? 'bg-[var(--primary)] text-[var(--primary-text)]' : isWeekend ? 'text-[var(--action-danger-bg)] font-extrabold' : 'text-[var(--text-primary)]'
                      }`}>
                        {dayNum}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] font-mono text-[var(--primary)] font-bold px-1 rounded bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)]">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>

                    {/* Day Events Badges */}
                    <div className="space-y-1 overflow-y-auto max-h-[70px] custom-scrollbar">
                      {dayEvents.slice(0, 3).map((evt, eIdx) => {
                        let badgeStyle = "bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border-[var(--border-subtle)]";
                        if (evt.type === 'ATTENDANCE') {
                          const st = (evt.status || '').toUpperCase();
                          if (st === 'PRESENT') badgeStyle = "bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border border-[var(--badge-success-border)]";
                          else if (st === 'ABSENT') badgeStyle = "bg-[var(--action-danger-soft)] text-[var(--action-danger-bg)] border border-[var(--action-danger-bg)]/30";
                          else if (st === 'HALF_DAY') badgeStyle = "bg-[var(--secondary)]/15 text-[var(--secondary)] border border-[var(--secondary)]/30";
                        } else if (evt.type === 'LEAVE') {
                          badgeStyle = "bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30";
                        } else if (evt.type === 'HOLIDAY') {
                          badgeStyle = "bg-[var(--badge-info-bg)] text-[var(--badge-info-text)] border border-[var(--badge-info-border)]";
                        } else if (evt.type === 'TASK' || evt.type === 'WEEKLY_PLAN') {
                          badgeStyle = "bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)]";
                        }

                        return (
                          <div
                            key={eIdx}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onEventClick) onEventClick(evt);
                              else setSelectedDayEvents({ dateStr: cell.dateStr!, events: dayEvents });
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border truncate transition-all ${badgeStyle}`}
                            title={`${evt.type}: ${evt.title}`}
                          >
                            <span className="font-semibold">{evt.title}</span>
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[9px] text-[var(--text-muted)] font-semibold text-center pt-0.5">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Day Details Modal on Cell Click */}
      {selectedDayEvents && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-default)] p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-[var(--primary)]" />
                  <span>Date Details: {selectedDayEvents.dateStr}</span>
                </h3>
                <p className="text-xs text-[var(--text-muted)]">{selectedDayEvents.events.length} event(s) recorded for this day</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayEvents(null)}
                className="p-1 hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
              {selectedDayEvents.events.map((evt, idx) => (
                <div key={idx} className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--bg-surface)] text-[var(--primary)] border border-[var(--border-subtle)]">
                      {evt.type}
                    </span>
                    {evt.status && (
                      <span className="text-[11px] font-mono text-[var(--text-secondary)] font-semibold">
                        Status: {evt.status}
                      </span>
                    )}
                  </div>
                  <h4 className="font-semibold text-sm text-[var(--text-primary)]">{evt.title}</h4>
                  {evt.employeeName && (
                    <p className="text-xs text-[var(--text-muted)]">Employee: <span className="text-[var(--text-primary)] font-medium">{evt.employeeName}</span></p>
                  )}
                  {evt.metadata && (
                    <div className="text-[11px] text-[var(--text-muted)] space-y-0.5 pt-1 border-t border-[var(--border-subtle)]">
                      {evt.metadata.check_in && <p>Check In: <span className="font-mono text-[var(--badge-success-text)]">{new Date(evt.metadata.check_in).toLocaleTimeString()}</span></p>}
                      {evt.metadata.check_out && <p>Check Out: <span className="font-mono text-[var(--text-primary)]">{new Date(evt.metadata.check_out).toLocaleTimeString()}</span></p>}
                      {evt.metadata.working_hours && <p>Working Hours: <span className="font-mono text-[var(--text-primary)]">{evt.metadata.working_hours} hrs</span></p>}
                      {evt.metadata.description && <p>Description: {evt.metadata.description}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDayEvents(null)}
                className="px-4 py-2 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
