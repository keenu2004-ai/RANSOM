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
   * Determines check-in punctuality relative to 09:00 AM start with 15-min grace period (up to 09:15 AM).
   */
  static isCheckInLate(checkInTimestamp: string | Date, timeZone: string = 'Asia/Kolkata'): boolean {
    try {
      const d = typeof checkInTimestamp === 'string' ? new Date(checkInTimestamp) : checkInTimestamp;
      if (isNaN(d.getTime())) return false;

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      });
      const parts = formatter.formatToParts(d);
      let hour = 0;
      let minute = 0;

      for (const p of parts) {
        if (p.type === 'hour') hour = parseInt(p.value, 10);
        if (p.type === 'minute') minute = parseInt(p.value, 10);
      }

      // 09:00 AM to 09:15 AM => PRESENT
      // 09:16 AM onwards => LATE PRESENT
      if (hour > 9) return true;
      if (hour === 9 && minute > 15) return true;
      return false;
    } catch {
      return false;
    }
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
        const isLate = firstCheckIn ? this.isCheckInLate(firstCheckIn, timeZone) : false;
        const isEarly = totalWorkingHours < 8.0;

        if (isLate && isEarly) {
          status = 'LATE PRESENT / EARLY CHECKOUT';
          displayStatus = 'LATE PRESENT / EARLY CHECKOUT';
        } else if (isLate) {
          status = 'LATE PRESENT';
          displayStatus = 'LATE PRESENT';
        } else if (isEarly) {
          status = 'EARLY CHECKOUT';
          displayStatus = 'EARLY CHECKOUT';
        } else {
          status = 'PRESENT';
          displayStatus = 'PRESENT';
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
