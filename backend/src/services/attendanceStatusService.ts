import { query } from '../db';

export interface AttendanceSessionRecord {
  id: string;
  organization_id: string;
  employee_id: string;
  date: string;
  check_in: string | Date | null;
  check_out: string | Date | null;
  punch_in_lat?: number | string | null;
  punch_in_lng?: number | string | null;
  punch_in_accuracy?: number | string | null;
  punch_in_location_name?: string | null;
  punch_out_lat?: number | string | null;
  punch_out_lng?: number | string | null;
  punch_out_accuracy?: number | string | null;
  punch_out_location_name?: string | null;
  break_duration_mins?: number | null;
  shift_name?: string | null;
  status?: string | null;
  session_state?: string | null;
  working_hours?: number | string | null;
}

export interface ResolvedDayAttendance {
  date: string;
  dayName: string;
  status: string; // PRESENT, LATE PRESENT, EARLY CHECKOUT, LATE PRESENT / EARLY CHECKOUT, ABSENT, HOLIDAY, ACTIVE, LEAVE
  displayStatus: string;
  sessionState?: string; // ACTIVE, COMPLETED, REGULARIZATION_REQUIRED, ROLLOVER_TERMINATED
  totalWorkingHours: number;
  totalWorkingHoursFormatted: string;
  sessions: AttendanceSessionRecord[];
  isHoliday: boolean;
  holidayTitle?: string | null;
  isLeave: boolean;
  leaveTypeName?: string | null;
  canRegularize: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
}

export class AttendanceStatusService {
  /**
   * Calculates whether a given date is a 2nd or 4th Saturday of its month.
   */
  static isSecondOrFourthSaturday(d: Date): boolean {
    if (d.getDay() !== 6) return false; // 6 = Saturday
    const dayOfMonth = d.getDate();
    // 2nd Saturday falls on days 8-14; 4th Saturday falls on days 22-28
    return (dayOfMonth >= 8 && dayOfMonth <= 14) || (dayOfMonth >= 22 && dayOfMonth <= 28);
  }

  /**
   * Helper: Check if date is Sunday, 2nd Saturday, or 4th Saturday
   */
  static getCalendarHolidayName(dateStr: string): string | null {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    if (dateObj.getDay() === 0) {
      return 'Sunday';
    }
    if (dateObj.getDay() === 6) {
      const dayOfMonth = dateObj.getDate();
      if (dayOfMonth >= 8 && dayOfMonth <= 14) {
        return '2nd Saturday';
      }
      if (dayOfMonth >= 22 && dayOfMonth <= 28) {
        return '4th Saturday';
      }
    }
    return null;
  }

  /**
   * Formats decimal hours into "Xh Ym" string (e.g. 8.33 -> "8h 20m")
   */
  static formatWorkingHours(decimalHours: number | string | null | undefined): string {
    const val = Number(decimalHours || 0);
    if (!Number.isFinite(val) || val <= 0) return '0h 00m';
    const totalMinutes = Math.round(val * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }

  /**
   * Formats ISO timestamp or Date object to 12-hour IST time string (e.g. "09:05 AM")
   */
  static formatTime(timestamp: string | Date | null | undefined, timeZone: string = 'Asia/Kolkata'): string {
    if (!timestamp) return '—';
    try {
      const d = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      if (isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat('en-IN', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(d);
    } catch {
      return '—';
    }
  }

  /**
   * Evaluates check-in timestamp against exact Master Attendance Rules:
   * Rule A (PRESENT): 09:00:00 to 09:15:00
   * Rule B (SHORT LEAVE): 09:15:01 to 09:30:00
   * Rule C (LATE PRESENT): 09:30:01 to 10:59:59
   * Rule D (HALF DAY): 11:00:00 to 12:59:59
   * Rule E (ABSENT): 13:00:00 onward
   */
  static getPunctualityCategory(checkInTimestamp: string | Date, timeZone: string = 'Asia/Kolkata'): 'PRESENT' | 'SHORT_LEAVE' | 'LATE_PRESENT' | 'HALF_DAY' | 'ABSENT' {
    try {
      const d = typeof checkInTimestamp === 'string' ? new Date(checkInTimestamp) : checkInTimestamp;
      if (isNaN(d.getTime())) return 'PRESENT';

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      });
      const parts = formatter.formatToParts(d);
      let hour = 0;
      let minute = 0;
      let second = 0;

      for (const p of parts) {
        if (p.type === 'hour') hour = parseInt(p.value, 10);
        if (p.type === 'minute') minute = parseInt(p.value, 10);
        if (p.type === 'second') second = parseInt(p.value, 10);
      }

      const totalSecs = hour * 3600 + minute * 60 + second;

      // 09:00:00 is 32400s
      // 09:15:00 is 33300s
      // 09:30:00 is 34200s
      // 11:00:00 is 39600s
      // 13:00:00 is 46800s

      if (totalSecs <= 33300) {
        return 'PRESENT'; // 09:00 - 09:15
      } else if (totalSecs <= 34200) {
        return 'SHORT_LEAVE'; // 09:15:01 - 09:30:00
      } else if (totalSecs < 39600) {
        return 'LATE_PRESENT'; // 09:30:01 - 10:59:59
      } else if (totalSecs < 46800) {
        return 'HALF_DAY'; // 11:00:00 - 12:59:59
      } else {
        return 'ABSENT'; // 13:00:00 onward
      }
    } catch {
      return 'PRESENT';
    }
  }

  /**
   * Determines check-in punctuality relative to 09:00 AM start with 15-min grace period (up to 09:15 AM).
   */
  static isCheckInLate(checkInTimestamp: string | Date, timeZone: string = 'Asia/Kolkata'): boolean {
    const category = this.getPunctualityCategory(checkInTimestamp, timeZone);
    return category !== 'PRESENT';
  }

  /**
   * Primary Centralized Status Resolver for an employee's day
   */
  static resolveDayStatus(params: {
    dateStr: string;
    todayStr: string;
    sessions: AttendanceSessionRecord[];
    holiday?: { title: string; holiday_type?: string } | null;
    leave?: { leave_type_name: string } | null;
    pendingRegularization?: any | null;
    timeZone?: string;
  }): ResolvedDayAttendance {
    const { dateStr, todayStr, sessions, holiday, leave, pendingRegularization, timeZone = 'Asia/Kolkata' } = params;

    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dateObj.getDay()];

    const calendarHolidayName = this.getCalendarHolidayName(dateStr);
    const isHoliday = !!calendarHolidayName || !!holiday;
    const holidayTitle = holiday?.title || calendarHolidayName || null;
    const isLeave = !!leave;

    let totalWorkingHours = 0;
    let firstCheckIn: string | null = null;
    let lastCheckOut: string | null = null;
    let hasActiveSession = false;
    let hasUnclosedPastSession = false;

    sessions.forEach(s => {
      totalWorkingHours += Number(s.working_hours || 0);
      if (s.check_in) {
        const inStr = typeof s.check_in === 'string' ? s.check_in : s.check_in.toISOString();
        if (!firstCheckIn || new Date(inStr) < new Date(firstCheckIn)) {
          firstCheckIn = inStr;
        }
      }
      if (s.check_out) {
        const outStr = typeof s.check_out === 'string' ? s.check_out : s.check_out.toISOString();
        if (!lastCheckOut || new Date(outStr) > new Date(lastCheckOut)) {
          lastCheckOut = outStr;
        }
      } else {
        // check_out IS NULL
        if (dateStr < todayStr) {
          hasUnclosedPastSession = true;
        } else if (dateStr === todayStr) {
          hasActiveSession = true;
        }
      }
    });

    totalWorkingHours = Math.round(totalWorkingHours * 100) / 100;
    const totalWorkingHoursFormatted = this.formatWorkingHours(totalWorkingHours);

    // Rule Resolution Hierarchy
    let status = 'ABSENT';
    let displayStatus = 'ABSENT';
    let sessionState: string | undefined = undefined;
    let canRegularize = false;

    if (isLeave && sessions.length === 0) {
      status = 'LEAVE';
      displayStatus = `LEAVE (${leave.leave_type_name})`;
    } else if (isHoliday && sessions.length === 0) {
      status = 'HOLIDAY';
      displayStatus = 'HOLIDAY';
    } else if (sessions.length === 0) {
      if (dateStr < todayStr) {
        status = 'ABSENT';
        displayStatus = 'ABSENT';
        canRegularize = true;
      } else if (dateStr === todayStr) {
        status = 'NOT_CHECKED_IN';
        displayStatus = 'NOT CHECKED IN';
      } else {
        status = 'FUTURE';
        displayStatus = '—';
      }
    } else {
      // Employee has attendance sessions on this date
      if (hasActiveSession && dateStr === todayStr) {
        status = 'ACTIVE';
        displayStatus = 'ACTIVE';
        sessionState = 'ACTIVE';
      } else if (hasUnclosedPastSession) {
        // Past day with missing checkout (EOD reconciliation)
        status = 'ABSENT';
        displayStatus = 'ABSENT';
        sessionState = 'REGULARIZATION_REQUIRED';
        canRegularize = true;
      } else {
        // Completed sessions present
        sessionState = 'COMPLETED';
        const checkInCategory = firstCheckIn ? this.getPunctualityCategory(firstCheckIn, timeZone) : 'PRESENT';

        // Check if final checkout reached office end time (05:00 PM / 17:00:00 IST)
        let reachedOfficeEnd = false;
        if (lastCheckOut) {
          try {
            const outDate = typeof lastCheckOut === 'string' ? new Date(lastCheckOut) : lastCheckOut;
            const formatter = new Intl.DateTimeFormat('en-US', {
              timeZone,
              hour: 'numeric',
              minute: 'numeric',
              hour12: false
            });
            const parts = formatter.formatToParts(outDate);
            let outHour = 0;
            let outMinute = 0;
            for (const p of parts) {
              if (p.type === 'hour') outHour = parseInt(p.value, 10);
              if (p.type === 'minute') outMinute = parseInt(p.value, 10);
            }
            if (outHour >= 17) reachedOfficeEnd = true;
          } catch {
            reachedOfficeEnd = false;
          }
        }

        const isEarlyOut = !reachedOfficeEnd && totalWorkingHours < 8.0 && totalWorkingHours >= 4.0;

        if (checkInCategory === 'ABSENT') {
          status = 'ABSENT';
          displayStatus = 'ABSENT';
        } else if (checkInCategory === 'HALF_DAY') {
          status = 'HALF DAY';
          displayStatus = 'HALF DAY';
        } else if (checkInCategory === 'SHORT_LEAVE') {
          status = isEarlyOut ? 'SHORT LEAVE / EARLY CHECKOUT' : 'SHORT LEAVE';
          displayStatus = isEarlyOut ? 'SHORT LEAVE / EARLY CHECKOUT' : 'SHORT LEAVE';
        } else if (checkInCategory === 'LATE_PRESENT') {
          status = isEarlyOut ? 'LATE PRESENT / EARLY CHECKOUT' : 'LATE PRESENT';
          displayStatus = isEarlyOut ? 'LATE PRESENT / EARLY CHECKOUT' : 'LATE PRESENT';
        } else {
          // Check-in was PRESENT (09:00 - 09:15)
          if (totalWorkingHours < 4.0) {
            status = 'HALF DAY';
            displayStatus = 'HALF DAY';
          } else if (isEarlyOut) {
            status = 'EARLY CHECKOUT';
            displayStatus = 'EARLY CHECKOUT';
          } else {
            status = 'PRESENT';
            displayStatus = 'PRESENT';
          }
        }
      }
    }

    const canCheckIn = !hasActiveSession && !isLeave && dateStr === todayStr;
    const canCheckOut = hasActiveSession && dateStr === todayStr;

    return {
      date: dateStr,
      dayName,
      status,
      displayStatus,
      sessionState,
      totalWorkingHours,
      totalWorkingHoursFormatted,
      sessions,
      isHoliday,
      holidayTitle,
      isLeave,
      leaveTypeName: leave?.leave_type_name || null,
      canRegularize,
      canCheckIn,
      canCheckOut,
      firstCheckIn,
      lastCheckOut
    };
  }
}
