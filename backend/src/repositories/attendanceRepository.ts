import { query } from '../db';

export class AttendanceRepository {
  static async findTodayByEmployee(employeeId: string, organizationId: string, dateStr: string) {
    const text = `
      SELECT 
        a.id, a.organization_id, a.employee_id, a.date, a.check_in, a.check_out,
        a.punch_in_lat, a.punch_in_lng, a.punch_out_lat, a.punch_out_lng,
        a.break_duration_mins, a.shift_name, a.is_late, a.is_overtime,
        a.status, a.working_hours, a.late_minutes, a.overtime_minutes, a.location_id
      FROM attendance a
      WHERE a.employee_id = $1 AND a.organization_id = $2 AND a.date = $3
      LIMIT 1
    `;
    const res = await query(text, [employeeId, organizationId, dateStr]);
    return res.rows[0] || null;
  }

  static async checkIn(
    organizationId: string,
    employeeId: string,
    dateStr: string,
    latitude?: number,
    longitude?: number,
    shiftName: string = 'General Shift',
    locationId?: string,
    ipAddress?: string
  ) {
    // 1. Check duplicate punch-in
    const existing = await this.findTodayByEmployee(employeeId, organizationId, dateStr);
    if (existing && existing.check_in) {
      throw new Error('Employee is already punched in today.');
    }

    const text = `
      INSERT INTO attendance (
        organization_id, employee_id, date, check_in, status,
        punch_in_lat, punch_in_lng, shift_name, location_id, ip_address
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'PRESENT', $4, $5, $6, $7, $8)
      ON CONFLICT (employee_id, date) 
      DO UPDATE SET 
        check_in = COALESCE(attendance.check_in, EXCLUDED.check_in),
        punch_in_lat = COALESCE(attendance.punch_in_lat, EXCLUDED.punch_in_lat),
        punch_in_lng = COALESCE(attendance.punch_in_lng, EXCLUDED.punch_in_lng),
        shift_name = COALESCE(attendance.shift_name, EXCLUDED.shift_name),
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, employee_id, date, check_in, status, punch_in_lat, punch_in_lng, shift_name
    `;
    const res = await query(text, [
      organizationId, employeeId, dateStr,
      latitude || null, longitude || null, shiftName, locationId || null, ipAddress || null
    ]);
    return res.rows[0];
  }

  static async checkOut(
    organizationId: string,
    employeeId: string,
    dateStr: string,
    latitude?: number,
    longitude?: number
  ) {
    // 1. Check state transitions & duplicate punch-out
    const existing = await this.findTodayByEmployee(employeeId, organizationId, dateStr);
    if (!existing || !existing.check_in) {
      throw new Error('No active check-in record found for today.');
    }
    if (existing.check_out) {
      throw new Error('Employee has already punched out today.');
    }

    const text = `
      UPDATE attendance
      SET 
        check_out = CURRENT_TIMESTAMP,
        punch_out_lat = $1,
        punch_out_lng = $2,
        working_hours = ROUND(GREATEST(0, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - check_in)) / 3600.0 - (COALESCE(break_duration_mins, 0) / 60.0))::numeric, 2),
        updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $3 AND organization_id = $4 AND date = $5 AND check_out IS NULL
      RETURNING id, employee_id, date, check_in, check_out, punch_out_lat, punch_out_lng, working_hours, break_duration_mins, status
    `;
    const res = await query(text, [latitude || null, longitude || null, employeeId, organizationId, dateStr]);
    return res.rows[0] || null;
  }

  static async updateBreak(organizationId: string, employeeId: string, dateStr: string, breakMinutes: number) {
    const existing = await this.findTodayByEmployee(employeeId, organizationId, dateStr);
    if (!existing || !existing.check_in) {
      throw new Error('Must be checked in to record a break.');
    }
    if (existing.check_out) {
      throw new Error('Cannot add break after check-out.');
    }

    const text = `
      UPDATE attendance
      SET 
        break_duration_mins = COALESCE(break_duration_mins, 0) + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $2 AND organization_id = $3 AND date = $4
      RETURNING id, employee_id, date, break_duration_mins
    `;
    const res = await query(text, [breakMinutes, employeeId, organizationId, dateStr]);
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

    // 2. Upsert/Update attendance record
    const dateStr = new Date(reg.attendance_date).toISOString().split('T')[0];
    const checkInTime = reg.requested_punch_in ? new Date(reg.requested_punch_in) : null;
    const checkOutTime = reg.requested_punch_out ? new Date(reg.requested_punch_out) : null;

    let workingHours = 0;
    if (checkInTime && checkOutTime) {
      workingHours = Math.max(0, Number(((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)).toFixed(2)));
    }

    const upsertSql = `
      INSERT INTO attendance (
        organization_id, employee_id, date, check_in, check_out, working_hours, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PRESENT')
      ON CONFLICT (employee_id, date)
      DO UPDATE SET
        check_in = COALESCE(EXCLUDED.check_in, attendance.check_in),
        check_out = COALESCE(EXCLUDED.check_out, attendance.check_out),
        working_hours = CASE WHEN EXCLUDED.check_out IS NOT NULL THEN EXCLUDED.working_hours ELSE attendance.working_hours END,
        status = 'PRESENT',
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const attRes = await query(upsertSql, [organizationId, reg.employee_id, dateStr, checkInTime, checkOutTime, workingHours]);

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
        a.date, a.check_in, a.check_out, a.punch_in_lat, a.punch_in_lng, a.punch_out_lat, a.punch_out_lng,
        a.break_duration_mins, a.shift_name, a.is_late, a.is_overtime,
        a.status, a.working_hours, a.late_minutes
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
        (SELECT COUNT(*)::int FROM attendance WHERE organization_id = $1 AND date = $2 AND status = 'PRESENT') as present_today,
        (SELECT COUNT(*)::int FROM attendance WHERE organization_id = $1 AND date = $2 AND status = 'LATE') as late_today,
        (SELECT COUNT(*)::int FROM leave_requests WHERE organization_id = $1 AND $2 BETWEEN start_date AND end_date AND status = 'APPROVED') as on_leave_today
    `;
    const res = await query(text, [organizationId, dateStr]);
    const row = res.rows[0] || { total_employees: 0, present_today: 0, late_today: 0, on_leave_today: 0 };
    const absent_today = Math.max(0, row.total_employees - (row.present_today + row.on_leave_today));

    return {
      totalEmployees: row.total_employees,
      presentToday: row.present_today + row.late_today,
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
