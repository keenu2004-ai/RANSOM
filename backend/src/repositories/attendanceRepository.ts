import { query } from '../db';

export class AttendanceRepository {
  /**
   * Find current open active session (check_out IS NULL)
   */
  static async findActiveSession(employeeId: string, organizationId: string) {
    const text = `
      SELECT 
        a.id, a.organization_id, a.employee_id, a.date, a.check_in, a.check_out,
        a.punch_in_lat, a.punch_in_lng, a.punch_in_accuracy,
        a.punch_out_lat, a.punch_out_lng, a.punch_out_accuracy,
        a.break_duration_mins, a.shift_name, a.status, a.working_hours, a.location_id
      FROM attendance a
      WHERE a.employee_id = $1 AND a.organization_id = $2 AND a.check_out IS NULL
      ORDER BY a.check_in DESC
      LIMIT 1
    `;
    const res = await query(text, [employeeId, organizationId]);
    return res.rows[0] || null;
  }

  /**
   * Find all attendance sessions for an employee on a given date
   */
  static async findTodaySessions(employeeId: string, organizationId: string, dateStr: string) {
    const text = `
      SELECT 
        a.id, a.organization_id, a.employee_id, a.date, a.check_in, a.check_out,
        a.punch_in_lat, a.punch_in_lng, a.punch_in_accuracy,
        a.punch_out_lat, a.punch_out_lng, a.punch_out_accuracy,
        a.break_duration_mins, a.shift_name, a.status, a.working_hours, a.location_id
      FROM attendance a
      WHERE a.employee_id = $1 AND a.organization_id = $2 AND a.date = $3
      ORDER BY a.check_in ASC
    `;
    const res = await query(text, [employeeId, organizationId, dateStr]);
    return res.rows;
  }

  /**
   * Aggregate daily summary across all sessions for an employee on a date
   */
  static async getTodaySummary(employeeId: string, organizationId: string, dateStr: string) {
    const sessions = await this.findTodaySessions(employeeId, organizationId, dateStr);
    const activeSession = await this.findActiveSession(employeeId, organizationId);

    let totalWorkingHours = 0;
    let totalBreakMins = 0;
    let firstCheckIn: string | null = null;
    let lastCheckOut: string | null = null;

    sessions.forEach(s => {
      totalWorkingHours += parseFloat(s.working_hours || 0);
      totalBreakMins += parseInt(s.break_duration_mins || 0, 10);
      if (!firstCheckIn || new Date(s.check_in) < new Date(firstCheckIn)) {
        firstCheckIn = s.check_in;
      }
      if (s.check_out && (!lastCheckOut || new Date(s.check_out) > new Date(lastCheckOut))) {
        lastCheckOut = s.check_out;
      }
    });

    return {
      date: dateStr,
      activeSession,
      sessions,
      totalSessions: sessions.length,
      totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
      totalBreakMins,
      firstCheckIn,
      lastCheckOut,
      status: activeSession ? 'ACTIVE' : (sessions.length > 0 ? 'COMPLETED' : 'NOT_CHECKED_IN')
    };
  }

  /**
   * Create a new attendance check-in session
   */
  static async checkIn(
    organizationId: string,
    employeeId: string,
    dateStr: string,
    latitude?: number,
    longitude?: number,
    accuracy?: number,
    shiftName: string = 'General Shift',
    locationId?: string,
    ipAddress?: string
  ) {
    // 1. Guard against active session in application layer
    const active = await this.findActiveSession(employeeId, organizationId);
    if (active) {
      throw new Error('Employee has an active check-in session. Please check out before checking in again.');
    }

    const text = `
      INSERT INTO attendance (
        organization_id, employee_id, date, check_in, status,
        punch_in_lat, punch_in_lng, punch_in_accuracy, shift_name, location_id, ip_address
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'PRESENT', $4, $5, $6, $7, $8, $9)
      RETURNING id, employee_id, date, check_in, status, punch_in_lat, punch_in_lng, punch_in_accuracy, shift_name
    `;
    try {
      const res = await query(text, [
        organizationId, employeeId, dateStr,
        latitude || null, longitude || null, accuracy || null, shiftName, locationId || null, ipAddress || null
      ]);
      return res.rows[0];
    } catch (err: any) {
      if (err.code === '23505' || (err.message && (err.message.includes('idx_attendance_active_session') || err.message.includes('unique')))) {
        throw new Error('Employee has an active check-in session. Please check out before checking in again.');
      }
      throw err;
    }
  }

  /**
   * Complete the currently active check-in session
   */
  static async checkOut(
    organizationId: string,
    employeeId: string,
    latitude?: number,
    longitude?: number,
    accuracy?: number
  ) {
    const active = await this.findActiveSession(employeeId, organizationId);
    if (!active) {
      throw new Error('No active check-in session found.');
    }

    const text = `
      UPDATE attendance
      SET 
        check_out = CURRENT_TIMESTAMP,
        punch_out_lat = $1,
        punch_out_lng = $2,
        punch_out_accuracy = $3,
        working_hours = ROUND(GREATEST(0, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - check_in)) / 3600.0 - (COALESCE(break_duration_mins, 0) / 60.0))::numeric, 2),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND organization_id = $5 AND check_out IS NULL
      RETURNING id, employee_id, date, check_in, check_out, punch_in_lat, punch_in_lng, punch_in_accuracy, punch_out_lat, punch_out_lng, punch_out_accuracy, working_hours, break_duration_mins, status
    `;
    const res = await query(text, [latitude || null, longitude || null, accuracy || null, active.id, organizationId]);
    if (!res.rows[0]) {
      throw new Error('No active check-in session found or session already completed.');
    }
    return res.rows[0];
  }

  /**
   * Record break duration for the currently active session
   */
  static async updateBreak(organizationId: string, employeeId: string, breakMinutes: number) {
    const active = await this.findActiveSession(employeeId, organizationId);
    if (!active) {
      throw new Error('Must have an active check-in session to record a break.');
    }

    const text = `
      UPDATE attendance
      SET 
        break_duration_mins = COALESCE(break_duration_mins, 0) + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND organization_id = $3 AND check_out IS NULL
      RETURNING id, employee_id, date, break_duration_mins
    `;
    const res = await query(text, [breakMinutes, active.id, organizationId]);
    return res.rows[0];
  }

  // Attendance Regularization Queries
  static async applyRegularization(
    organizationId: string,
    employeeId: string,
    attendanceDate: string,
    requestedPunchIn: string | null,
    requestedPunchOut: string | null,
    reason: string
  ) {
    const text = `
      INSERT INTO attendance_regularizations (
        organization_id, employee_id, attendance_date, requested_punch_in, requested_punch_out, reason, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
      RETURNING *
    `;
    const res = await query(text, [
      organizationId, employeeId, attendanceDate,
      requestedPunchIn ? new Date(requestedPunchIn).toISOString() : null,
      requestedPunchOut ? new Date(requestedPunchOut).toISOString() : null,
      reason
    ]);
    return res.rows[0];
  }

  static async getRegularizations(organizationId: string, filters: { employeeId?: string; status?: string }) {
    let whereClause = `WHERE r.organization_id = $1`;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filters.employeeId) {
      whereClause += ` AND r.employee_id = $${paramIndex}`;
      params.push(filters.employeeId);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND r.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    const sql = `
      SELECT 
        r.id, r.organization_id, r.employee_id,
        e.employee_code, CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        r.attendance_date, r.requested_punch_in, r.requested_punch_out, r.reason,
        r.status, r.approved_by, r.approved_at, r.rejection_reason, r.created_at
      FROM attendance_regularizations r
      INNER JOIN employees e ON r.employee_id = e.id
      ${whereClause}
      ORDER BY r.created_at DESC
    `;
    const res = await query(sql, params);
    return res.rows;
  }

  static async approveRegularization(organizationId: string, regularizationId: string, approverId: string) {
    const regRes = await query(
      `SELECT * FROM attendance_regularizations WHERE id = $1 AND organization_id = $2 AND status = 'PENDING'`,
      [regularizationId, organizationId]
    );
    const reg = regRes.rows[0];
    if (!reg) {
      throw new Error('Pending regularization request not found.');
    }

    // 1. Update regularization status
    await query(
      `UPDATE attendance_regularizations SET status = 'APPROVED', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [approverId, regularizationId]
    );

    // 2. Insert new regularized session
    const dateStr = new Date(reg.attendance_date).toISOString().split('T')[0];
    const checkInTime = reg.requested_punch_in ? new Date(reg.requested_punch_in) : null;
    const checkOutTime = reg.requested_punch_out ? new Date(reg.requested_punch_out) : null;

    let workingHours = 0;
    if (checkInTime && checkOutTime) {
      workingHours = Math.max(0, Number(((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)).toFixed(2)));
    }

    const insertSql = `
      INSERT INTO attendance (
        organization_id, employee_id, date, check_in, check_out, working_hours, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PRESENT')
      RETURNING *
    `;
    const attRes = await query(insertSql, [organizationId, reg.employee_id, dateStr, checkInTime, checkOutTime, workingHours]);

    return { regularization: { ...reg, status: 'APPROVED' }, attendance: attRes.rows[0] };
  }

  static async rejectRegularization(organizationId: string, regularizationId: string, approverId: string, rejectionReason?: string) {
    const res = await query(
      `UPDATE attendance_regularizations SET status = 'REJECTED', approved_by = $1, approved_at = CURRENT_TIMESTAMP, rejection_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND organization_id = $4 AND status = 'PENDING' RETURNING *`,
      [approverId, rejectionReason || 'Rejected by manager', regularizationId, organizationId]
    );
    if (!res.rows[0]) {
      throw new Error('Pending regularization request not found.');
    }
    return res.rows[0];
  }

  static async findAll(organizationId: string, filters: { date?: string; startDate?: string; endDate?: string; employeeId?: string; departmentId?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 500;
    const offset = (page - 1) * limit;

    let whereClause = `WHERE a.organization_id = $1`;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filters.date) {
      whereClause += ` AND a.date = $${paramIndex}`;
      params.push(filters.date);
      paramIndex++;
    }

    if (filters.startDate) {
      whereClause += ` AND a.date >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      whereClause += ` AND a.date <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters.employeeId) {
      whereClause += ` AND a.employee_id = $${paramIndex}`;
      params.push(filters.employeeId);
      paramIndex++;
    }

    if (filters.departmentId) {
      whereClause += ` AND e.department_id = $${paramIndex}`;
      params.push(filters.departmentId);
      paramIndex++;
    }

    const countSql = `
      SELECT COUNT(*)::int as total
      FROM attendance a
      INNER JOIN employees e ON a.employee_id = e.id
      ${whereClause}
    `;
    const countRes = await query<{ total: number }>(countSql, params);

    const dataSql = `
      SELECT 
        a.id, a.organization_id, a.employee_id,
        e.employee_code, CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        d.name as department_name,
        a.date, a.check_in, a.check_out, 
        a.punch_in_lat, a.punch_in_lng, a.punch_in_accuracy,
        a.punch_out_lat, a.punch_out_lng, a.punch_out_accuracy,
        a.break_duration_mins, a.shift_name, a.status, a.working_hours
      FROM attendance a
      INNER JOIN employees e ON a.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      ${whereClause}
      ORDER BY a.date DESC, a.check_in DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const dataRes = await query(dataSql, params);

    return {
      attendance: dataRes.rows,
      pagination: {
        total: countRes.rows[0].total,
        page,
        limit,
        totalPages: Math.ceil(countRes.rows[0].total / limit)
      }
    };
  }

  static async getWorkforceSummary(organizationId: string, dateStr: string) {
    const text = `
      SELECT 
        (SELECT COUNT(*)::int FROM employees WHERE organization_id = $1 AND status = 'ACTIVE') as total_employees,
        (SELECT COUNT(DISTINCT employee_id)::int FROM attendance WHERE organization_id = $1 AND date = $2 AND status IN ('PRESENT', 'LATE')) as present_today,
        (SELECT COUNT(DISTINCT employee_id)::int FROM attendance WHERE organization_id = $1 AND date = $2 AND status = 'LATE') as late_today,
        (SELECT COUNT(*)::int FROM leave_requests WHERE organization_id = $1 AND $2 BETWEEN start_date AND end_date AND status = 'APPROVED') as on_leave_today
    `;
    const res = await query(text, [organizationId, dateStr]);
    const row = res.rows[0] || { total_employees: 0, present_today: 0, late_today: 0, on_leave_today: 0 };
    const absent_today = Math.max(0, row.total_employees - (row.present_today + row.on_leave_today));

    return {
      totalEmployees: row.total_employees,
      presentToday: row.present_today,
      lateToday: row.late_today,
      onLeaveToday: row.on_leave_today,
      absentToday: absent_today
    };
  }

  static async getLocations(organizationId: string) {
    const text = `
      SELECT id, name, latitude, longitude, radius_meters, is_active
      FROM attendance_locations
      WHERE organization_id = $1
      ORDER BY name ASC
    `;
    const res = await query(text, [organizationId]);
    return res.rows;
  }
}
