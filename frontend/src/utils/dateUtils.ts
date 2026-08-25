/**
 * THEIAKSHI ENTERPRISE HRMS — CANONICAL DATE-ONLY UTILITY SUITE
 * 
 * Business calendar dates (task date, follow-up date, leave date, holiday date)
 * are DATE-ONLY values ("YYYY-MM-DD").
 * They MUST NOT be subjected to timezone conversion or toISOString() on local midnight Dates.
 */

/**
 * Normalizes any date value (string, Date, timestamp) into a clean "YYYY-MM-DD" string.
 * Prevents timezone offset shifts.
 */
export function normalizeDateOnly(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.includes('T')) {
      return trimmed.split('T')[0];
    }
    return trimmed;
  }
  
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  if (typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  
  return String(val);
}

export const formatDateOnly = normalizeDateOnly;
export const toDateKey = normalizeDateOnly;

/**
 * Parses a "YYYY-MM-DD" string into a local Date object anchored at 12:00:00 (noon).
 * Anchoring at 12:00:00 (noon) prevents DST or timezone boundary issues during date math.
 */
export function parseDateOnlyToLocal(dateStr: string): Date {
  const clean = normalizeDateOnly(dateStr);
  if (!clean || !/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  }
  const parts = clean.split('-').map(n => parseInt(n, 10));
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
}

/**
 * Formats a "YYYY-MM-DD" date string into a user-friendly display string.
 * Example: "2026-08-24" -> "24-Aug-2026" or "Monday, 24-Aug-2026"
 */
export function displayDateOnly(dateStr: string, options?: { includeDayName?: boolean }): string {
  const clean = normalizeDateOnly(dateStr);
  if (!clean || !/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  
  const [y, m, d] = clean.split('-').map(n => parseInt(n, 10));
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const localDate = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dayName = dayNames[localDate.getDay()];
  const monthName = monthNames[m - 1];
  const dayPadded = String(d).padStart(2, '0');
  
  if (options?.includeDayName) {
    return `${dayName}, ${dayPadded}-${monthName}-${y}`;
  }
  return `${dayPadded}-${monthName}-${y}`;
}

/**
 * Adds or subtracts days to a "YYYY-MM-DD" string, returning a clean "YYYY-MM-DD" string.
 */
export function addCalendarDays(dateStr: string, days: number): string {
  const d = parseDateOnlyToLocal(dateStr);
  d.setDate(d.getDate() + days);
  return normalizeDateOnly(d);
}

/**
 * Returns Monday Date (at 12:00 noon) for a reference date or string.
 */
export function getMondayOfWeek(dateInput?: Date | string): Date {
  let d: Date;
  if (typeof dateInput === 'string' && dateInput.trim()) {
    d = parseDateOnlyToLocal(dateInput);
  } else if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    d = new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate(), 12, 0, 0, 0);
  } else {
    const now = new Date();
    d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  }
  
  const day = d.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff, 12, 0, 0, 0);
}

/**
 * Returns Monday date string ("YYYY-MM-DD") for a reference date or string.
 */
export function getMondayOfWeekStr(dateInput?: Date | string): string {
  return normalizeDateOnly(getMondayOfWeek(dateInput));
}

/**
 * Compares two date-only values ("YYYY-MM-DD").
 * Returns -1 if a < b, 0 if a == b, 1 if a > b.
 */
export function compareDateOnly(a: string, b: string): number {
  const keyA = normalizeDateOnly(a);
  const keyB = normalizeDateOnly(b);
  if (keyA < keyB) return -1;
  if (keyA > keyB) return 1;
  return 0;
}
