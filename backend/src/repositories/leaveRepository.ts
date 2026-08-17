import { query, withTransaction } from '../db';

export class LeaveRepository {
  static async findTypes(organizationId: string) {
    const text = `
      SELECT id, name, code, annual_quota, is_paid, is_active, created_at
      FROM leave_types
      WHERE organization_id = $1 AND is_active = TRUE
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
      WHERE lb.employee_id = $1 AND lb.organization_id = $2 AND lb.year = $3 AND lt.is_active = TRUE
      ORDER BY lt.name ASC
    `;
    const res = await query(text, [employeeId, organizationId, year]);
    return res.rows;
  }

  static async getMonthlyCLUsage(employeeId: string, organizationId: string, year: number, month: number) {
    // Month is 1-indexed (1 = Jan, 12 = Dec)
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const text = `
      SELECT COALESCE(SUM(lr.total_days), 0)::numeric as cl_used
      FROM leave_requests lr
      INNER JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.employee_id = $1 AND lr.organization_id = $2 
        AND lt.code = 'CL' AND lr.status = 'APPROVED'
        AND lr.start_date <= $4 AND lr.end_date >= $3
    `;
    const res = await query<{ cl_used: string }>(text, [employeeId, organizationId, startDateStr, endDateStr]);
    return parseFloat(res.rows[0]?.cl_used || '0');
  }

  static async updatePolicy(organizationId: string, quotas: { clQuota: number; elQuota: number; slQuota: number }) {
    return withTransaction(async (client) => {
      const currentYear = new Date().getFullYear();

      // Update leave_types
      await client.query('UPDATE leave_types SET annual_quota = $1 WHERE organization_id = $2 AND code = $3', [quotas.clQuota, organizationId, 'CL']);
      await client.query('UPDATE leave_types SET annual_quota = $1 WHERE organization_id = $2 AND code = $3', [quotas.elQuota, organizationId, 'EL']);
      await client.query('UPDATE leave_types SET annual_quota = $1 WHERE organization_id = $2 AND code = $3', [quotas.slQuota, organizationId, 'SL']);

      // Synchronize leave_balances for active year
      const updates = [
        { code: 'CL', quota: quotas.clQuota },
        { code: 'EL', quota: quotas.elQuota },
        { code: 'SL', quota: quotas.slQuota }
      ];

      for (const item of updates) {
        const typeRes = await client.query('SELECT id FROM leave_types WHERE organization_id = $1 AND code = $2', [organizationId, item.code]);
        if (typeRes.rows.length > 0) {
          const typeId = typeRes.rows[0].id;
          await client.query(`
            UPDATE leave_balances
            SET quota = $1, available = GREATEST(0, $1 - used - pending), updated_at = CURRENT_TIMESTAMP
            WHERE organization_id = $2 AND leave_type_id = $3 AND year = $4
          `, [item.quota, organizationId, typeId, currentYear]);
        }
      }

      return { message: 'Leave policy updated successfully.' };
    });
  }

  static async applyLeave(organizationId: string, employeeId: string, data: { leaveTypeId: string; startDate: string; endDate: string; totalDays: number; reason: string }) {
    return withTransaction(async (client) => {
      const year = new Date(data.startDate).getFullYear();

      // Fetch requested leave type
      const typeRes = await client.query('SELECT id, code, is_active FROM leave_types WHERE id = $1 AND organization_id = $2', [data.leaveTypeId, organizationId]);
      if (typeRes.rows.length === 0 || !typeRes.rows[0].is_active) {
        throw new Error('The selected leave type is no longer active or valid.');
      }
      const requestedCode = typeRes.rows[0].code;

      let targetLeaveTypeId = data.leaveTypeId;
      let clDays = 0;
      let elDays = 0;

      // Handle CL Monthly Limit & EL Fallback Engine
      if (requestedCode === 'CL') {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        const current = new Date(start);

        // Evaluate day-by-day month boundary logic
        while (current <= end) {
          const cYear = current.getFullYear();
          const cMonth = current.getMonth() + 1; // 1-indexed

          // Query approved CL days for that specific month
          const startM = `${cYear}-${String(cMonth).padStart(2, '0')}-01`;
          const lastD = new Date(cYear, cMonth, 0).getDate();
          const endM = `${cYear}-${String(cMonth).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;

          const usageRes = await client.query(`
            SELECT COALESCE(SUM(lr.total_days), 0)::numeric as count
            FROM leave_requests lr
            INNER JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE lr.employee_id = $1 AND lr.organization_id = $2
              AND lt.code = 'CL' AND lr.status = 'APPROVED'
              AND lr.start_date <= $4 AND lr.end_date >= $3
          `, [employeeId, organizationId, startM, endM]);

          const monthUsedCL = parseFloat(usageRes.rows[0]?.count || '0');

          if (monthUsedCL + clDays < 2) {
            clDays += 1;
          } else {
            elDays += 1;
          }

          current.setDate(current.getDate() + 1);
        }

        // If all days fit within CL limit
        if (elDays === 0) {
          targetLeaveTypeId = data.leaveTypeId;
        } else if (clDays === 0) {
          // All requested days overflowed to EL -> switch target to EL
          const elTypeRes = await client.query("SELECT id FROM leave_types WHERE organization_id = $1 AND code = 'EL'", [organizationId]);
          if (elTypeRes.rows.length === 0) throw new Error('Earned Leave type not configured.');
          targetLeaveTypeId = elTypeRes.rows[0].id;
        }
      }

      // Check balance for target leave type
      const balRes = await client.query(`
        SELECT id, quota, used, pending, available
        FROM leave_balances
        WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3 AND organization_id = $4
        FOR UPDATE
      `, [employeeId, targetLeaveTypeId, year, organizationId]);

      if (balRes.rows.length === 0) {
        throw new Error('Leave balance record not found for the selected type and year.');
      }

      const balance = balRes.rows[0];
      if (balance.available < data.totalDays) {
        if (elDays > 0) {
          throw new Error('You have exceeded the monthly Casual Leave limit and do not have enough Earned Leave to cover the additional days.');
        }
        throw new Error(`Insufficient leave balance. Available: ${balance.available} days, Requested: ${data.totalDays} days.`);
      }

      // Create leave request with conversion note if applicable
      const note = elDays > 0 ? ` (Note: ${clDays} day(s) CL, ${elDays} day(s) converted to EL due to 2-day monthly limit)` : '';
      const fullReason = `${data.reason}${note}`;

      const reqRes = await client.query(`
        INSERT INTO leave_requests (
          organization_id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
        RETURNING id, employee_id, leave_type_id, start_date, end_date, total_days, status, created_at
      `, [organizationId, employeeId, targetLeaveTypeId, data.startDate, data.endDate, data.totalDays, fullReason]);

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
        lt.code as leave_type_code,
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
