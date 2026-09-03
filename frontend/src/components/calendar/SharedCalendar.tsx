import React, { useState, useMemo } from 'react';
import { normalizeDateOnly } from '../../utils/dateUtils';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter, 
  CheckCircle2, XCircle, Clock, AlertTriangle, Palmtree, Award, Briefcase, X
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
}

export const SharedCalendar: React.FC<SharedCalendarProps> = ({
  events,
  initialYear = new Date().getFullYear(),
  initialMonth = new Date().getMonth(),
  onMonthChange,
  onEventClick,
  title = "Unified Organizational Calendar",
  subtitle = "Attendance, leave, company holidays, and weekly project tasks in one unified view",
  attendanceOnly = false
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

  const handleToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    if (onMonthChange) onMonthChange(today.getFullYear(), today.getMonth());
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
          if (st === 'PRESENT') present++;
          else if (st === 'ABSENT') absent++;
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

    // Estimate working days in month (Mon-Fri)
    let workingDays = 0;
    for (let day = 1; day <= monthData.daysInMonth; day++) {
      const dateObj = new Date(currentYear, currentMonth, day);
      const dayOfWeek = dateObj.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }

    return { present, absent, halfDay, leave, holidays, tasks, workingDays };
  }, [events, currentYear, currentMonth, monthData.daysInMonth]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="space-y-6">
      {/* Calendar Header & Month Navigation */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-cyan-400" />
            <span>{monthNames[currentMonth]} {currentYear}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Navigation Controls */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition-all"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-1 font-semibold text-cyan-400 hover:text-cyan-300 rounded-lg transition-all"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition-all"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Present</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg font-extrabold text-emerald-400 mt-1">{summaryStats.present}</p>
        </div>
        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Absent</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-lg font-extrabold text-rose-400 mt-1">{summaryStats.absent}</p>
        </div>
        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Half Day</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-lg font-extrabold text-amber-400 mt-1">{summaryStats.halfDay}</p>
        </div>
        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Leave</span>
            <Palmtree className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-lg font-extrabold text-indigo-400 mt-1">{summaryStats.leave}</p>
        </div>
        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Holidays</span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-lg font-extrabold text-purple-400 mt-1">{summaryStats.holidays}</p>
        </div>
        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tasks</span>
            <Briefcase className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-lg font-extrabold text-cyan-400 mt-1">{summaryStats.tasks}</p>
        </div>
      </div>

      {/* Filter Toggles & Accessibility Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/70 border border-slate-800 rounded-xl text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-slate-400 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>Event Filters:</span>
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input type="checkbox" checked={showAttendance} onChange={e => setShowAttendance(e.target.checked)} className="rounded accent-cyan-500" />
            <span>Attendance</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input type="checkbox" checked={showLeave} onChange={e => setShowLeave(e.target.checked)} className="rounded accent-indigo-500" />
            <span>Leave</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input type="checkbox" checked={showHolidays} onChange={e => setShowHolidays(e.target.checked)} className="rounded accent-purple-500" />
            <span>Holidays</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input type="checkbox" checked={showTasks} onChange={e => setShowTasks(e.target.checked)} className="rounded accent-cyan-500" />
            <span>Tasks / Weekly Plan</span>
          </label>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-400 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Present</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400"></span> Absent</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Half Day</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400"></span> Leave</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400"></span> Holiday</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400"></span> Task</span>
        </div>
      </div>

      {/* Main Month Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Weekday Labels */}
        <div className="grid grid-cols-7 bg-slate-950/80 border-b border-slate-800 text-center py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <div className="text-rose-400/90">Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div className="text-rose-400/90">Sat</div>
        </div>

        {/* Month Weeks */}
        <div className="divide-y divide-slate-800/60">
          {monthData.weeks.map((week, wIdx) => (
            <div key={wIdx} className="grid grid-cols-7 divide-x divide-slate-800/60">
              {week.map((cell, cIdx) => {
                if (!cell.date || !cell.dateStr) {
                  return <div key={cIdx} className="min-h-[110px] bg-slate-950/30" />;
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
                    className={`min-h-[110px] p-2 transition-all cursor-pointer relative group flex flex-col justify-between ${
                      isToday ? 'bg-cyan-950/30 border-2 border-cyan-500/50' : isWeekend ? 'bg-slate-950/20 hover:bg-slate-800/30' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Day Number Header */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
                        isToday ? 'bg-cyan-500 text-slate-950' : isWeekend ? 'text-rose-400' : 'text-slate-300'
                      }`}>
                        {dayNum}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] font-mono text-cyan-400 font-bold px-1 rounded bg-slate-800">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>

                    {/* Day Events Badges */}
                    <div className="space-y-1 overflow-y-auto max-h-[75px] scrollbar-thin">
                      {dayEvents.slice(0, 3).map((evt, eIdx) => {
                        let badgeBg = "bg-slate-800 text-slate-300 border-slate-700";
                        if (evt.type === 'ATTENDANCE') {
                          const st = (evt.status || '').toUpperCase();
                          if (st === 'PRESENT') badgeBg = "bg-emerald-950/60 text-emerald-300 border-emerald-800/60";
                          else if (st === 'ABSENT') badgeBg = "bg-rose-950/60 text-rose-300 border-rose-800/60";
                          else if (st === 'HALF_DAY') badgeBg = "bg-amber-950/60 text-amber-300 border-amber-800/60";
                        } else if (evt.type === 'LEAVE') {
                          badgeBg = "bg-indigo-950/60 text-indigo-300 border-indigo-800/60";
                        } else if (evt.type === 'HOLIDAY') {
                          badgeBg = "bg-purple-950/60 text-purple-300 border-purple-800/60";
                        } else if (evt.type === 'TASK' || evt.type === 'WEEKLY_PLAN') {
                          badgeBg = "bg-cyan-950/60 text-cyan-300 border-cyan-800/60";
                        }

                        return (
                          <div
                            key={eIdx}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onEventClick) onEventClick(evt);
                              else setSelectedDayEvents({ dateStr: cell.dateStr!, events: dayEvents });
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border truncate transition-all hover:scale-[1.02] ${badgeBg}`}
                            title={`${evt.type}: ${evt.title}`}
                          >
                            <span className="font-semibold">{evt.title}</span>
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[9px] text-slate-400 font-semibold text-center pt-0.5">
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-cyan-400" />
                  <span>Date Details: {selectedDayEvents.dateStr}</span>
                </h3>
                <p className="text-xs text-slate-400">{selectedDayEvents.events.length} event(s) recorded for this day</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayEvents(null)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {selectedDayEvents.events.map((evt, idx) => (
                <div key={idx} className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-cyan-400">
                      {evt.type}
                    </span>
                    {evt.status && (
                      <span className="text-[11px] font-mono text-slate-300 font-semibold">
                        Status: {evt.status}
                      </span>
                    )}
                  </div>
                  <h4 className="font-semibold text-sm text-slate-100">{evt.title}</h4>
                  {evt.employeeName && (
                    <p className="text-xs text-slate-400">Employee: <span className="text-slate-200 font-medium">{evt.employeeName}</span></p>
                  )}
                  {evt.metadata && (
                    <div className="text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-800/80">
                      {evt.metadata.check_in && <p>Check In: <span className="font-mono text-emerald-400">{new Date(evt.metadata.check_in).toLocaleTimeString()}</span></p>}
                      {evt.metadata.check_out && <p>Check Out: <span className="font-mono text-cyan-400">{new Date(evt.metadata.check_out).toLocaleTimeString()}</span></p>}
                      {evt.metadata.working_hours && <p>Working Hours: <span className="font-mono text-slate-200">{evt.metadata.working_hours} hrs</span></p>}
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
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
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
