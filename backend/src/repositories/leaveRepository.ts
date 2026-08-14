import { query, withTransaction } from '../db';

export class LeaveRepository {
  static async findTypes(organizationId: string) {
    const text = `
      SELECT id, name, code, annual_quota, is_paid, created_at
      FROM leave_types
      WHERE organization_id = $1
      ORDER BY name ASC
    `;
    const res = await query(text, [organizationId]);
    return res.rows;
  }

  static async findBalancesByEmployee(employeeId: string, organizationId: string, year: number) {
    const text = `
      SELECT 
        lb.id, lb.employee_id, lb.leave_type_id, lt.name as leave_type_name, lt.code as leave_type_code,
        lb.year, lb.quota, lb.used, lb.pending, lb.available
      FROM leave_balances lb
      INNER JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = $1 AND lb.organization_id = $2 AND lb.year = $3
      ORDER BY lt.name ASC
    `;
    const res = await query(text, [employeeId, organizationId, year]);
    return res.rows;
  }

  static async applyLeave(organizationId: string, employeeId: string, data: { leaveTypeId: string; startDate: string; endDate: string; totalDays: number; reason: string }) {
    return withTransaction(async (client) => {
      const year = new Date(data.startDate).getFullYear();

      // Lock balance row for update
      const balRes = await client.query(`
        SELECT id, quota, used, pending, available
        FROM leave_balances
        WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3 AND organization_id = $4
        FOR UPDATE
      `, [employeeId, data.leaveTypeId, year, organizationId]);

      if (balRes.rows.length === 0) {
        throw new Error('Leave balance record not found for the selected type and year.');
      }

      const balance = balRes.rows[0];
      if (balance.available < data.totalDays) {
        throw new Error(`Insufficient leave balance. Available: ${balance.available} days, Requested: ${data.totalDays} days.`);
      }

      // Create leave request
      const reqRes = await client.query(`
        INSERT INTO leave_requests (
          organization_id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
        RETURNING id, employee_id, leave_type_id, start_date, end_date, total_days, status, created_at
      `, [organizationId, employeeId, data.leaveTypeId, data.startDate, data.endDate, data.totalDays, data.reason]);

      // Update pending balance
      await client.query(`
        UPDATE leave_balances
        SET 
          pending = pending + $1,
          available = available - $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [data.totalDays, balance.id]);

      return reqRes.rows[0];
    });
  }

  static async updateStatus(id: string, organizationId: string, status: 'APPROVED' | 'REJECTED' | 'CANCELLED', reviewerEmployeeId?: string, rejectionReason?: string) {
    return withTransaction(async (client) => {
      const reqRes = await client.query(`
        SELECT id, employee_id, leave_type_id, start_date, total_days, status
        FROM leave_requests
        WHERE id = $1 AND organization_id = $2
        FOR UPDATE
      `, [id, organizationId]);

      if (reqRes.rows.length === 0) {
        throw new Error('Leave request not found.');
      }

      const req = reqRes.rows[0];
      if (req.status !== 'PENDING') {
        throw new Error(`Cannot update leave request with current status: ${req.status}`);
      }

      const year = new Date(req.start_date).getFullYear();

      if (status === 'APPROVED') {
        await client.query(`
          UPDATE leave_balances
          SET 
            pending = pending - $1,
            used = used + $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4 AND organization_id = $5
        `, [req.total_days, req.employee_id, req.leave_type_id, year, organizationId]);
      } else if (status === 'REJECTED' || status === 'CANCELLED') {
        await client.query(`
          UPDATE leave_balances
          SET 
            pending = pending - $1,
            available = available + $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4 AND organization_id = $5
        `, [req.total_days, req.employee_id, req.leave_type_id, year, organizationId]);
      }

      const updateRes = await client.query(`
        UPDATE leave_requests
        SET 
          status = $1,
          reviewed_by = $2,
          reviewed_at = CURRENT_TIMESTAMP,
          rejection_reason = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND organization_id = $5
        RETURNING id, employee_id, status, reviewed_at
      `, [status, reviewerEmployeeId || null, rejectionReason || null, id, organizationId]);

      return updateRes.rows[0];
    });
  }

  static async findAll(organizationId: string, filters: { status?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = `WHERE lr.organization_id = $1`;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filters.status) {
      whereClause += ` AND lr.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    const countSql = `SELECT COUNT(*)::int as total FROM leave_requests lr ${whereClause}`;
    const countRes = await query<{ total: number }>(countSql, params);

    const dataSql = `
      SELECT 
        lr.id, lr.organization_id, lr.employee_id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.employee_code,
        d.name as department_name,
        lt.name as leave_type_name,
        lr.start_date, lr.end_date, lr.total_days, lr.reason, lr.status,
        lr.created_at
      FROM leave_requests lr
      INNER JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      INNER JOIN leave_types lt ON lr.leave_type_id = lt.id
      ${whereClause}
      ORDER BY lr.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const dataRes = await query(dataSql, params);

    return {
      leaveRequests: dataRes.rows,
      pagination: {
        total: countRes.rows[0].total,
        page,
        limit,
        totalPages: Math.ceil(countRes.rows[0].total / limit)
      }
    };
  }
}
