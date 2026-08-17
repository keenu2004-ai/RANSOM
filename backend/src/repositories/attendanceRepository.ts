import { query } from '../db';

export class AttendanceRepository {
  static async findTodayByEmployee(employeeId: string, organizationId: string, dateStr: string) {
    const text = `
      SELECT 
        a.id, a.organization_id, a.employee_id, a.date, a.check_in, a.check_out,
        a.status, a.working_hours, a.late_minutes, a.overtime_minutes, a.location_id
      FROM attendance a
      WHERE a.employee_id = $1 AND a.organization_id = $2 AND a.date = $3
      LIMIT 1
    `;
    const res = await query(text, [employeeId, organizationId, dateStr]);
    return res.rows[0] || null;
  }

  static async checkIn(organizationId: string, employeeId: string, dateStr: string, locationId?: string, ipAddress?: string) {
    const text = `
      INSERT INTO attendance (
        organization_id, employee_id, date, check_in, status, location_id, ip_address
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'PRESENT', $4, $5)
      ON CONFLICT (employee_id, date) 
      DO UPDATE SET check_in = COALESCE(attendance.check_in, EXCLUDED.check_in), updated_at = CURRENT_TIMESTAMP
      RETURNING id, employee_id, date, check_in, status
    `;
    const res = await query(text, [organizationId, employeeId, dateStr, locationId || null, ipAddress || null]);
    return res.rows[0];
  }

  static async checkOut(organizationId: string, employeeId: string, dateStr: string) {
    const text = `
      UPDATE attendance
      SET 
        check_out = CURRENT_TIMESTAMP,
        working_hours = ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - check_in)) / 3600.0, 2),
        updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $1 AND organization_id = $2 AND date = $3 AND check_out IS NULL
      RETURNING id, employee_id, date, check_in, check_out, working_hours, status
    `;
    const res = await query(text, [employeeId, organizationId, dateStr]);
    return res.rows[0] || null;
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
        a.date, a.check_in, a.check_out, a.status, a.working_hours, a.late_minutes
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
