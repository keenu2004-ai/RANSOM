import { query } from '../db';

export interface CalendarEventDTO {
  id: string;
  type: 'ATTENDANCE' | 'LEAVE' | 'HOLIDAY' | 'TASK';
  date: string;
  title: string;
  description?: string;
  status: string;
  startTime?: string;
  endTime?: string;
  sourceId: string;
  employeeId?: string;
  employeeName?: string;
  metadata?: Record<string, any>;
}

export class CalendarRepository {
  static async getEvents(
    organizationId: string,
    startDate: string,
    endDate: string,
    filterEmployeeId?: string
  ): Promise<CalendarEventDTO[]> {
    const events: CalendarEventDTO[] = [];

    // Parallel database queries for performance across date range
    const attendancePromise = (async () => {
      let sql = `
        SELECT 
          a.id, a.employee_id, a.date::text as date_str, a.check_in, a.check_out, a.status,
          a.working_hours, a.break_duration_mins, a.shift_name, a.is_late, a.is_overtime,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name
        FROM attendance a
        INNER JOIN employees e ON a.employee_id = e.id
        WHERE a.organization_id = $1 AND a.date >= $2 AND a.date <= $3
      `;
      const params: any[] = [organizationId, startDate, endDate];
      if (filterEmployeeId) {
        sql += ` AND a.employee_id = $4`;
        params.push(filterEmployeeId);
      }
      const res = await query(sql, params);
      return res.rows;
    })();

    const leavePromise = (async () => {
      let sql = `
        SELECT 
          l.id, l.employee_id, l.start_date::text as start_str, l.end_date::text as end_str,
          l.total_days, l.reason, l.status,
          lt.name as leave_type_name,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name
        FROM leave_requests l
        INNER JOIN leave_types lt ON l.leave_type_id = lt.id
        INNER JOIN employees e ON l.employee_id = e.id
        WHERE l.organization_id = $1 AND l.status = 'APPROVED'
          AND l.start_date <= $3 AND l.end_date >= $2
      `;
      const params: any[] = [organizationId, startDate, endDate];
      if (filterEmployeeId) {
        sql += ` AND l.employee_id = $4`;
        params.push(filterEmployeeId);
      }
      const res = await query(sql, params);
      return res.rows;
    })();

    const holidayPromise = (async () => {
      const sql = `
        SELECT id, title, date::text as date_str, holiday_type, description
        FROM holidays
        WHERE organization_id = $1 AND date >= $2 AND date <= $3
        ORDER BY date ASC
      `;
      const res = await query(sql, [organizationId, startDate, endDate]);
      return res.rows;
    })();

    const taskPromise = (async () => {
      let sql = `
        SELECT 
          t.id, t.employee_id, t.date::text as date_str, t.hours, t.description, t.status,
          p.name as project_name,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name
        FROM timesheets t
        INNER JOIN projects p ON t.project_id = p.id
        INNER JOIN employees e ON t.employee_id = e.id
        WHERE t.organization_id = $1 AND t.date >= $2 AND t.date <= $3
      `;
      const params: any[] = [organizationId, startDate, endDate];
      if (filterEmployeeId) {
        sql += ` AND t.employee_id = $4`;
        params.push(filterEmployeeId);
      }
      const res = await query(sql, params);
      return res.rows;
    })();

    const [attRows, leaveRows, holRows, taskRows] = await Promise.all([
      attendancePromise,
      leavePromise,
      holidayPromise,
      taskPromise
    ]);

    // 1. Map Attendance Events (Grouped per employee per date for multi-session support)
    const attGrouped = new Map<string, any[]>();
    attRows.forEach(a => {
      const key = `${a.employee_id}_${a.date_str}`;
      if (!attGrouped.has(key)) {
        attGrouped.set(key, []);
      }
      attGrouped.get(key)!.push(a);
    });

    attGrouped.forEach((sessions, key) => {
      const first = sessions[0];
      let totalHours = 0;
      let totalBreak = 0;
      let minCheckIn: string | null = null;
      let maxCheckOut: string | null = null;
      let hasActive = false;

      sessions.forEach(s => {
        totalHours += parseFloat(s.working_hours || 0);
        totalBreak += parseInt(s.break_duration_mins || 0, 10);
        if (!minCheckIn || new Date(s.check_in) < new Date(minCheckIn)) {
          minCheckIn = s.check_in;
        }
        if (s.check_out) {
          if (!maxCheckOut || new Date(s.check_out) > new Date(maxCheckOut)) {
            maxCheckOut = s.check_out;
          }
        } else {
          hasActive = true;
        }
      });

      const sessionCount = sessions.length;
      const roundedHours = Math.round(totalHours * 100) / 100;
      const formatTime = (ts: any) => ts ? new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : undefined;
      const statusStr = hasActive ? 'PRESENT (Active)' : first.status;
      const titleStr = sessionCount > 1 
        ? `${first.employee_name}: ${statusStr} (${sessionCount} sessions, ${roundedHours} hrs)` 
        : `${first.employee_name}: ${statusStr}`;

      events.push({
        id: `att-${first.id}`,
        type: 'ATTENDANCE',
        date: first.date_str,
        title: titleStr,
        status: first.status,
        startTime: formatTime(minCheckIn),
        endTime: formatTime(maxCheckOut),
        sourceId: first.id,
        employeeId: first.employee_id,
        employeeName: first.employee_name,
        metadata: {
          sessionCount,
          totalWorkingHours: roundedHours,
          totalBreakDurationMins: totalBreak,
          firstCheckIn: minCheckIn,
          lastCheckOut: maxCheckOut,
          sessions: sessions.map(s => ({
            id: s.id,
            checkIn: s.check_in,
            checkOut: s.check_out,
            workingHours: s.working_hours,
            breakDurationMins: s.break_duration_mins
          }))
        }
      });
    });

    // 2. Map Approved Leave Events (expand multi-day leave range)
    leaveRows.forEach(l => {
      const start = new Date(l.start_str);
      const end = new Date(l.end_str);
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);

      const cur = new Date(start);
      while (cur <= end) {
        if (cur >= rangeStart && cur <= rangeEnd) {
          const dateISO = cur.toISOString().split('T')[0];
          events.push({
            id: `leave-${l.id}-${dateISO}`,
            type: 'LEAVE',
            date: dateISO,
            title: `${l.employee_name}: ${l.leave_type_name}`,
            description: l.reason,
            status: l.status,
            sourceId: l.id,
            employeeId: l.employee_id,
            employeeName: l.employee_name,
            metadata: {
              startDate: l.start_str,
              endDate: l.end_str,
              totalDays: l.total_days,
              leaveTypeName: l.leave_type_name
            }
          });
        }
        cur.setDate(cur.getDate() + 1);
      }
    });

    // 3. Map Holiday Events
    holRows.forEach(h => {
      events.push({
        id: `hol-${h.id}`,
        type: 'HOLIDAY',
        date: h.date_str,
        title: h.title,
        description: h.description || undefined,
        status: h.holiday_type || 'HOLIDAY',
        sourceId: h.id,
        metadata: { holidayType: h.holiday_type }
      });
    });

    // 4. Map Weekly Plan / Task Events
    taskRows.forEach(t => {
      events.push({
        id: `task-${t.id}`,
        type: 'TASK',
        date: t.date_str,
        title: `${t.project_name}: ${t.description.substring(0, 35)}`,
        description: t.description,
        status: t.status,
        sourceId: t.id,
        employeeId: t.employee_id,
        employeeName: t.employee_name,
        metadata: {
          projectName: t.project_name,
          hours: t.hours
        }
      });
    });

    return events;
  }
}
