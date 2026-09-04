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
        lt.annual_quota as organization_entitlement,
        lb.year, lb.used, lb.pending,
        ela.adjustment_type, ela.adjustment_value
      FROM leave_balances lb
      INNER JOIN leave_types lt ON lb.leave_type_id = lt.id
      LEFT JOIN LATERAL (
        SELECT adjustment_type, adjustment_value
        FROM employee_leave_adjustments
        WHERE organization_id = $2 AND employee_id = $1 AND leave_type_id = lb.leave_type_id AND period_year = $3
        ORDER BY created_at DESC LIMIT 1
      ) ela ON TRUE
      WHERE lb.employee_id = $1 AND lb.organization_id = $2 AND lb.year = $3 AND lt.is_active = TRUE
      ORDER BY lt.name ASC
    `;
    const res = await query(text, [employeeId, organizationId, year]);

    return res.rows.map(row => {
      const orgQuota = parseFloat(row.organization_entitlement || '0');
      let effectiveAdjustment = 0;
      let finalEntitlement = orgQuota;

      if (row.adjustment_type === 'INCREMENT') {
        effectiveAdjustment = parseFloat(row.adjustment_value || '0');
        finalEntitlement = orgQuota + effectiveAdjustment;
      } else if (row.adjustment_type === 'DECREMENT') {
        const adjVal = parseFloat(row.adjustment_value || '0');
        effectiveAdjustment = -adjVal;
        finalEntitlement = Math.max(0, orgQuota - adjVal);
      } else if (row.adjustment_type === 'OVERRIDE') {
        finalEntitlement = parseFloat(row.adjustment_value || '0');
        effectiveAdjustment = finalEntitlement - orgQuota;
      }

      const used = parseFloat(row.used || '0');
      const pending = parseFloat(row.pending || '0');
      const available = Math.max(0, finalEntitlement - used - pending);

      return {
        id: row.id,
        employee_id: row.employee_id,
        leave_type_id: row.leave_type_id,
        leave_type_name: row.leave_type_name,
        leave_type_code: row.leave_type_code,
        organizationEntitlement: orgQuota,
        employeeAdjustment: effectiveAdjustment,
        finalEntitlement: finalEntitlement,
        year: row.year,
        quota: finalEntitlement,
        used: used,
        pending: pending,
        available: available
      };
    });
  }

  static async getMonthlyCLUsage(employeeId: string, organizationId: string, year: number, month: number, client?: any) {
    // Month is 1-indexed (1 = Jan, 12 = Dec)
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const queryFn = client ? (text: string, params: any[]) => client.query(text, params) : query;

    // Fetch approved requests that overlap with the target month and actually deducted Casual Leave
    const text = `
      SELECT lr.start_date, lr.end_date, lr.total_days, lr.actual_deduction_type, lt.code as leave_type_code, lt.name as leave_type_name
      FROM leave_requests lr
      INNER JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.employee_id = $1 AND lr.organization_id = $2 
        AND lr.status = 'APPROVED'
        AND (lt.code = 'CL' OR lr.actual_deduction_type ILIKE '%Casual%')
        AND lr.start_date <= $4 AND lr.end_date >= $3
    `;
    const res = await queryFn(text, [employeeId, organizationId, startDateStr, endDateStr]);

    let monthCLDays = 0;
    const targetMonthStart = new Date(`${startDateStr}T00:00:00`);
    const targetMonthEnd = new Date(`${endDateStr}T23:59:59`);

    for (const req of res.rows) {
      const reqStart = new Date(req.start_date);
      const reqEnd = new Date(req.end_date);
      const cur = new Date(reqStart);

      while (cur <= reqEnd) {
        if (cur >= targetMonthStart && cur <= targetMonthEnd) {
          monthCLDays += 1;
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    return monthCLDays;
  }

  static async updatePolicy(organizationId: string, quotas: { clQuota: number; elQuota: number; slQuota: number; olQuota?: number }, actorUserId?: string) {
    return withTransaction(async (client) => {
      const currentYear = new Date().getFullYear();

      // 1. Get old quotas for audit snapshot
      const oldTypesRes = await client.query('SELECT code, annual_quota FROM leave_types WHERE organization_id = $1::uuid', [organizationId]);
      const oldValues: Record<string, number> = {};
      oldTypesRes.rows.forEach(r => { oldValues[r.code] = parseFloat(r.annual_quota || '0'); });

      // 2. Update leave_types - handle CL, EL/PL, SL, and set OL quota = 0
      await client.query('UPDATE leave_types SET annual_quota = $1::numeric WHERE organization_id = $2::uuid AND code = $3::text', [quotas.clQuota, organizationId, 'CL']);
      await client.query("UPDATE leave_types SET annual_quota = $1::numeric WHERE organization_id = $2::uuid AND code IN ('EL', 'PL')", [quotas.elQuota, organizationId]);
      await client.query('UPDATE leave_types SET annual_quota = $1::numeric WHERE organization_id = $2::uuid AND code = $3::text', [quotas.slQuota, organizationId, 'SL']);
      await client.query("UPDATE leave_types SET annual_quota = 0, is_active = FALSE WHERE organization_id = $1::uuid AND code = 'OL'", [organizationId]);

      // 3. Insert immutable audit log entry
      const newValues = { CL: quotas.clQuota, PL: quotas.elQuota, SL: quotas.slQuota, OL: 0 };
      if (actorUserId) {
        await client.query(`
          INSERT INTO audit_logs (organization_id, user_id, action, module, entity_name, entity_id, old_values, new_values)
          VALUES ($1::uuid, $2::uuid, 'LEAVE_POLICY_UPDATED', 'leaves', 'LeavePolicy', $3::text, $4::jsonb, $5::jsonb)
        `, [organizationId, actorUserId, organizationId, JSON.stringify(oldValues), JSON.stringify(newValues)]);
      }

      // 4. Synchronize all leave_balances for active year according to current policy + active employee adjustments
      const balancesRes = await client.query(`
        SELECT lb.id, lb.employee_id, lb.leave_type_id, lt.annual_quota as org_quota,
               ela.adjustment_type, ela.adjustment_value
        FROM leave_balances lb
        INNER JOIN leave_types lt ON lb.leave_type_id = lt.id
        LEFT JOIN LATERAL (
          SELECT adjustment_type, adjustment_value
          FROM employee_leave_adjustments
          WHERE organization_id = $1::uuid AND employee_id = lb.employee_id AND leave_type_id = lb.leave_type_id AND period_year = $2::integer
          ORDER BY created_at DESC LIMIT 1
        ) ela ON TRUE
        WHERE lb.organization_id = $1::uuid AND lb.year = $2::integer
      `, [organizationId, currentYear]);

      for (const row of balancesRes.rows) {
        const orgQuota = parseFloat(row.org_quota || '0');
        let finalEntitlement = orgQuota;

        if (row.adjustment_type === 'INCREMENT') {
          finalEntitlement = orgQuota + parseFloat(row.adjustment_value || '0');
        } else if (row.adjustment_type === 'DECREMENT') {
          finalEntitlement = Math.max(0, orgQuota - parseFloat(row.adjustment_value || '0'));
        } else if (row.adjustment_type === 'OVERRIDE') {
          finalEntitlement = parseFloat(row.adjustment_value || '0');
        }

        await client.query(`
          UPDATE leave_balances
          SET quota = $1::numeric, available = GREATEST(0, $1::numeric - used - pending), updated_at = CURRENT_TIMESTAMP
          WHERE id = $2::uuid
        `, [finalEntitlement, row.id]);
      }

      return {
        CL: quotas.clQuota,
        PL: quotas.elQuota,
        EL: quotas.elQuota,
        SL: quotas.slQuota,
        OL: 0,
        message: 'Leave policy updated and synchronized successfully.'
      };
    });
  }

  static async applyLeave(organizationId: string, employeeId: string, data: { leaveTypeId: string; startDate: string; endDate: string; totalDays: number; reason: string }) {
    return withTransaction(async (client) => {
      const year = new Date(data.startDate).getFullYear();

      // Acquire exclusive lock on employee balances for concurrency protection
      await client.query(`
        SELECT id FROM leave_balances
        WHERE employee_id = $1 AND year = $2 AND organization_id = $3
        FOR UPDATE
      `, [employeeId, year, organizationId]);

      // Fetch requested leave type
      const typeRes = await client.query('SELECT id, name, code, is_active FROM leave_types WHERE id = $1 AND organization_id = $2', [data.leaveTypeId, organizationId]);
      if (typeRes.rows.length === 0 || !typeRes.rows[0].is_active) {
        throw new Error('The selected leave type is no longer active or valid.');
      }
      const requestedTypeRow = typeRes.rows[0];
      const requestedCode = requestedTypeRow.code;

      let targetLeaveTypeId = data.leaveTypeId;
      let actualDeductionType = requestedTypeRow.name;
      let conversionReason: string | null = null;

      // Handle Exact CL Policy Rules:
      // A. Max 2 consecutive CL days per request.
      // B. Max 2 CL days per calendar month per employee.
      // Rule is ALL-OR-NOTHING. Never split one request between CL and Privilege/EL.
      if (requestedCode === 'CL') {
        if (data.totalDays > 2) {
          // Rule A: Consecutive CL Limit exceeded -> Entire request converts to Privilege
          const plTypeRes = await client.query("SELECT id, name FROM leave_types WHERE organization_id = $1 AND code IN ('EL', 'PL')", [organizationId]);
          if (plTypeRes.rows.length === 0) throw new Error('Privilege / Earned Leave type not configured.');
          targetLeaveTypeId = plTypeRes.rows[0].id;
          actualDeductionType = plTypeRes.rows[0].name;
          conversionReason = 'Casual Leave request exceeds maximum consecutive CL limit.';
        } else {
          // Evaluate monthly CL usage across each distinct calendar month in the request range
          const start = new Date(data.startDate);
          const end = new Date(data.endDate);
          const monthDaysCount: Record<string, { year: number; month: number; days: number }> = {};

          const cur = new Date(start);
          while (cur <= end) {
            const y = cur.getFullYear();
            const m = cur.getMonth() + 1;
            const key = `${y}-${m}`;
            if (!monthDaysCount[key]) {
              monthDaysCount[key] = { year: y, month: m, days: 0 };
            }
            monthDaysCount[key].days += 1;
            cur.setDate(cur.getDate() + 1);
          }

          // Check monthly quota for each month spanned by the request
          for (const key of Object.keys(monthDaysCount)) {
            const { year: mYear, month: mMonth, days: reqDaysInMonth } = monthDaysCount[key];
            const monthCLUsed = await LeaveRepository.getMonthlyCLUsage(employeeId, organizationId, mYear, mMonth, client);

            if (monthCLUsed + reqDaysInMonth > 2) {
              const plTypeRes = await client.query("SELECT id, name FROM leave_types WHERE organization_id = $1 AND code IN ('EL', 'PL')", [organizationId]);
              if (plTypeRes.rows.length === 0) throw new Error('Privilege / Earned Leave type not configured.');
              targetLeaveTypeId = plTypeRes.rows[0].id;
              actualDeductionType = plTypeRes.rows[0].name;
              conversionReason = 'Monthly Casual Leave quota exhausted.';
              break;
            }
          }
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
      const availableNum = parseFloat(balance.available || '0');

      if (availableNum < data.totalDays) {
        if (conversionReason) {
          throw new Error(`Insufficient Privilege Leave balance. Available: ${availableNum} days, Requested: ${data.totalDays} days.`);
        }
        throw new Error(`Insufficient leave balance. Available: ${availableNum} days, Requested: ${data.totalDays} days.`);
      }

      const reqRes = await client.query(`
        INSERT INTO leave_requests (
          organization_id, employee_id, leave_type_id, requested_leave_type_id,
          actual_deduction_type, conversion_reason, start_date, end_date, total_days, reason, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING')
        RETURNING id, employee_id, leave_type_id, requested_leave_type_id, actual_deduction_type, conversion_reason, start_date, end_date, total_days, status, created_at
      `, [
        organizationId, employeeId, targetLeaveTypeId, data.leaveTypeId,
        actualDeductionType, conversionReason, data.startDate, data.endDate, data.totalDays, data.reason
      ]);

      // Update pending balance on actual deduction target
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
        SELECT id, employee_id, leave_type_id, start_date, total_days, status, actual_deduction_type
        FROM leave_requests
        WHERE id = $1 AND organization_id = $2
        FOR UPDATE
      `, [id, organizationId]);

      if (reqRes.rows.length === 0) {
        throw new Error('Leave request not found.');
      }

      const req = reqRes.rows[0];
      if (req.status !== 'PENDING') {
        throw new Error(`Cannot update status for a request that is already ${req.status}.`);
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
      } else if (status === 'REJECTED') {
        await client.query(`
          UPDATE leave_balances
          SET 
            pending = pending - $1,
            available = available + $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4 AND organization_id = $5
        `, [req.total_days, req.employee_id, req.leave_type_id, year, organizationId]);
      }

      const updatedRes = await client.query(`
        UPDATE leave_requests
        SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND organization_id = $5
        RETURNING *
      `, [status, reviewerEmployeeId || null, rejectionReason || null, id, organizationId]);

      return updatedRes.rows[0];
    });
  }

  static async findAll(organizationId: string, options: { status?: string; employeeId?: string; page?: number; limit?: number } = {}) {
    const { status, employeeId, page = 1, limit = 500 } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE lr.organization_id = $1';
    const params: any[] = [organizationId];

    if (status && status !== 'ALL') {
      params.push(status);
      whereClause += ` AND lr.status = $${params.length}`;
    }

    if (employeeId) {
      params.push(employeeId);
      whereClause += ` AND lr.employee_id = $${params.length}`;
    }

    const countText = `SELECT COUNT(*) FROM leave_requests lr ${whereClause}`;
    const countRes = await query(countText, params);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    params.push(limit, offset);
    const dataText = `
      SELECT 
        lr.id, lr.employee_id, lr.leave_type_id, lr.requested_leave_type_id,
        lt_actual.name as leave_type_name, lt_actual.code as leave_type_code,
        COALESCE(lt_req.name, lt_actual.name) as requested_leave_type_name,
        COALESCE(lr.actual_deduction_type, lt_actual.name) as actual_deduction_type,
        lr.conversion_reason,
        lr.start_date, lr.end_date, lr.total_days, lr.reason, lr.status, lr.rejection_reason, lr.created_at,
        COALESCE(e.first_name, SPLIT_PART(lr.employee_name_snapshot, ' ', 1), 'Deleted') as first_name,
        COALESCE(e.last_name, SUBSTRING(lr.employee_name_snapshot FROM POSITION(' ' IN lr.employee_name_snapshot) + 1), 'Employee') as last_name,
        COALESCE(e.employee_code, lr.employee_code_snapshot, 'EMP') as employee_code,
        d.name as department_name,
        rev.first_name as reviewer_first_name, rev.last_name as reviewer_last_name
      FROM leave_requests lr
      INNER JOIN leave_types lt_actual ON lr.leave_type_id = lt_actual.id
      LEFT JOIN leave_types lt_req ON lr.requested_leave_type_id = lt_req.id
      LEFT JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN employees rev ON lr.reviewed_by = rev.id
      ${whereClause}
      ORDER BY lr.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const dataRes = await query(dataText, params);

    return {
      leaveRequests: dataRes.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async cancelLeaveRequest(
    organizationId: string,
    actorUserId: string,
    actorEmployeeId: string | null,
    actorRole: string,
    requestId: string,
    cancellationReason: string
  ) {
    return withTransaction(async (client) => {
      const reqRes = await client.query(`
        SELECT lr.id, lr.employee_id, lr.leave_type_id, lr.start_date, lr.total_days, lr.status,
               lt.name as leave_type_name, e.first_name, e.last_name
        FROM leave_requests lr
        INNER JOIN leave_types lt ON lr.leave_type_id = lt.id
        INNER JOIN employees e ON lr.employee_id = e.id
        WHERE lr.id = $1 AND lr.organization_id = $2
        FOR UPDATE
      `, [requestId, organizationId]);

      if (reqRes.rows.length === 0) {
        throw new Error('Leave request not found.');
      }

      const leave = reqRes.rows[0];
      const isSelf = actorEmployeeId && actorEmployeeId === leave.employee_id;
      const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(actorRole);

      if (!isSelf && !isPrivileged) {
        throw new Error('You are not authorized to cancel this leave request.');
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const startDateStr = new Date(leave.start_date).toISOString().split('T')[0];

      if (isSelf && !isPrivileged && startDateStr <= todayStr) {
        throw new Error('Self-service cancellation is not allowed for past or ongoing leave requests. Please contact HR Management. [PAST_LEAVE_REVOCATION_BLOCKED]');
      }

      if (leave.status === 'CANCELLED') {
        throw new Error('This leave request is already cancelled.');
      }

      const year = new Date(leave.start_date).getFullYear();

      if (leave.status === 'PENDING') {
        await client.query(`
          UPDATE leave_balances
          SET 
            pending = pending - $1,
            available = available + $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4 AND organization_id = $5
        `, [leave.total_days, leave.employee_id, leave.leave_type_id, year, organizationId]);
      } else if (leave.status === 'APPROVED') {
        await client.query(`
          UPDATE leave_balances
          SET 
            used = GREATEST(0, used - $1),
            available = available + $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4 AND organization_id = $5
        `, [leave.total_days, leave.employee_id, leave.leave_type_id, year, organizationId]);
      }

      await client.query(`
        UPDATE leave_requests
        SET status = 'CANCELLED', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND organization_id = $3
      `, [`Cancelled: ${cancellationReason}`, requestId, organizationId]);

      const empName = `${leave.first_name} ${leave.last_name}`;
      await client.query(`
        INSERT INTO audit_logs (organization_id, user_id, action, module, entity_name, entity_id, new_values)
        VALUES ($1, $2, 'LEAVE_CANCELLED', 'leaves', 'LeaveRequest', $3, $4)
      `, [organizationId, actorUserId, requestId, JSON.stringify({
        employeeId: leave.employee_id,
        leaveTypeName: leave.leave_type_name,
        totalDays: leave.total_days,
        previousStatus: leave.status,
        cancellationReason
      })]);

      return { ...leave, status: 'CANCELLED' };
    });
  }

  static async findAllBalances(organizationId: string, options: { search?: string; department?: string; status?: string; page?: number; limit?: number } = {}) {
    const year = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const startDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    const endDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { search, department, status, page = 1, limit = 500 } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE e.organization_id = $1';
    const params: any[] = [organizationId];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (e.first_name || ' ' || e.last_name ILIKE $${params.length} OR e.employee_code ILIKE $${params.length})`;
    }

    if (department && department !== 'ALL') {
      params.push(department);
      whereClause += ` AND (d.id::text = $${params.length} OR d.name ILIKE $${params.length})`;
    }

    if (status && status !== 'ALL') {
      params.push(status.toUpperCase());
      whereClause += ` AND UPPER(e.status) = $${params.length}`;
    }

    const countRes = await query(`
      SELECT COUNT(*) 
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      ${whereClause}
    `, params);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    params.push(limit, offset);
    const dataRes = await query(`
      SELECT 
        e.id as employee_id,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.status as employee_status,
        d.name as department_name,
        COALESCE(
          json_agg(
            json_build_object(
              'leave_type_id', lb.leave_type_id,
              'leave_type_name', lt.name,
              'leave_type_code', lt.code,
              'quota', lb.quota,
              'used', lb.used,
              'pending', lb.pending,
              'available', lb.available
            )
          ) FILTER (WHERE lb.id IS NOT NULL), '[]'
        ) as balances,
        COALESCE(
          (
            SELECT SUM(lr.total_days)
            FROM leave_requests lr
            INNER JOIN leave_types lt_cl ON lr.leave_type_id = lt_cl.id
            WHERE lr.employee_id = e.id AND lr.organization_id = $1
              AND (lt_cl.code = 'CL' OR lr.actual_deduction_type ILIKE '%Casual%')
              AND lr.status = 'APPROVED'
              AND lr.start_date <= '${endDateStr}' AND lr.end_date >= '${startDateStr}'
          ), 0
        )::numeric as monthly_cl_used
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN leave_balances lb ON e.id = lb.employee_id AND lb.year = ${year}
      LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id AND lt.is_active = TRUE
      ${whereClause}
      GROUP BY e.id, e.first_name, e.last_name, e.employee_code, e.status, d.name
      ORDER BY e.first_name ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const summariesRes = await query(`
      SELECT 
        (SELECT COUNT(*) FROM employees WHERE organization_id = $1) as total_employees,
        (SELECT COUNT(*) FROM employees WHERE organization_id = $1 AND UPPER(status) = 'ACTIVE') as active_employees,
        (SELECT COUNT(*) FROM employees WHERE organization_id = $1 AND UPPER(status) = 'INACTIVE') as inactive_employees,
        (SELECT COUNT(*) FROM leave_requests WHERE organization_id = $1 AND status = 'PENDING') as pending_requests,
        (SELECT COUNT(*) FROM leave_requests WHERE organization_id = $1 AND status = 'APPROVED' AND EXTRACT(YEAR FROM start_date) = ${year}) as approved_this_year,
        (
          SELECT COALESCE(ROUND(SUM(total_days) / NULLIF((SELECT COUNT(*) FROM employees WHERE organization_id = $1 AND UPPER(status) = 'ACTIVE'), 0), 1), 0)
          FROM leave_requests
          WHERE organization_id = $1 AND status = 'APPROVED' AND EXTRACT(YEAR FROM start_date) = ${year}
        ) as avg_leave_usage
    `, [organizationId]);

    return {
      employees: dataRes.rows.map(row => {
        let cl = { quota: 0, used: 0, pending: 0, available: 0 };
        let pl = { quota: 0, used: 0, pending: 0, available: 0 };
        let sl = { quota: 0, used: 0, pending: 0, available: 0 };

        (row.balances || []).forEach((b: any) => {
          const quota = parseFloat(b.quota || '0');
          const used = parseFloat(b.used || '0');
          const pending = parseFloat(b.pending || '0');
          const available = parseFloat(b.available || '0');

          if (b.leave_type_code === 'CL' || (b.leave_type_name && b.leave_type_name.toLowerCase().includes('casual'))) {
            cl = { quota, used, pending, available };
          } else if (['EL', 'PL'].includes(b.leave_type_code) || (b.leave_type_name && (b.leave_type_name.toLowerCase().includes('privilege') || b.leave_type_name.toLowerCase().includes('earned')))) {
            pl = { quota, used, pending, available };
          } else if (b.leave_type_code === 'SL' || (b.leave_type_name && b.leave_type_name.toLowerCase().includes('sick'))) {
            sl = { quota, used, pending, available };
          }
        });

        const totalAvailable = cl.available + pl.available + sl.available;

        return {
          employee_id: row.employee_id,
          employee_name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
          employee_code: row.employee_code,
          department: row.department_name || 'General',
          status: row.employee_status,
          casual_leave: cl,
          privilege_leave: pl,
          sick_leave: sl,
          total_available: totalAvailable,
          monthly_cl_used: parseFloat(row.monthly_cl_used || '0'),
          all_balances: row.balances
        };
      }),
      summary: {
        totalEmployees: parseInt(summariesRes.rows[0]?.total_employees || '0', 10),
        activeEmployees: parseInt(summariesRes.rows[0]?.active_employees || '0', 10),
        inactiveEmployees: parseInt(summariesRes.rows[0]?.inactive_employees || '0', 10),
        pendingRequests: parseInt(summariesRes.rows[0]?.pending_requests || '0', 10),
        approvedThisYear: parseInt(summariesRes.rows[0]?.approved_this_year || '0', 10),
        avgLeaveUsage: parseFloat(summariesRes.rows[0]?.avg_leave_usage || '0')
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async createLeaveAdjustment(
    organizationId: string,
    actorUserId: string,
    data: {
      employeeId: string;
      leaveTypeId: string;
      periodYear: number;
      adjustmentType: 'INCREMENT' | 'DECREMENT' | 'OVERRIDE';
      adjustmentValue: number;
      reason: string;
    }
  ) {
    return withTransaction(async (client) => {
      const currentYear = data.periodYear || new Date().getFullYear();

      const typeRes = await client.query('SELECT id, code, annual_quota FROM leave_types WHERE id = $1 AND organization_id = $2', [data.leaveTypeId, organizationId]);
      if (typeRes.rows.length === 0) {
        throw new Error('Leave type not found.');
      }
      const orgQuota = parseFloat(typeRes.rows[0].annual_quota || '0');
      let finalEntitlement = orgQuota;
      if (data.adjustmentType === 'INCREMENT') {
        finalEntitlement = orgQuota + data.adjustmentValue;
      } else if (data.adjustmentType === 'DECREMENT') {
        finalEntitlement = Math.max(0, orgQuota - data.adjustmentValue);
      } else if (data.adjustmentType === 'OVERRIDE') {
        finalEntitlement = data.adjustmentValue;
      }

      const adjRes = await client.query(`
        INSERT INTO employee_leave_adjustments (
          organization_id, employee_id, leave_type_id, period_year, adjustment_type,
          adjustment_value, final_entitlement, reason, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        organizationId, data.employeeId, data.leaveTypeId, currentYear,
        data.adjustmentType, data.adjustmentValue, finalEntitlement, data.reason, actorUserId
      ]);

      await client.query(`
        INSERT INTO leave_balances (organization_id, employee_id, leave_type_id, year, quota, used, pending, available)
        VALUES ($1, $2, $3, $4, $5, 0, 0, $5)
        ON CONFLICT (employee_id, leave_type_id, year)
        DO UPDATE SET quota = $5, available = GREATEST(0, $5 - leave_balances.used - leave_balances.pending), updated_at = CURRENT_TIMESTAMP
      `, [organizationId, data.employeeId, data.leaveTypeId, currentYear, finalEntitlement]);

      let effectiveAdjustment = 0;
      if (data.adjustmentType === 'INCREMENT') effectiveAdjustment = data.adjustmentValue;
      else if (data.adjustmentType === 'DECREMENT') effectiveAdjustment = -data.adjustmentValue;
      else if (data.adjustmentType === 'OVERRIDE') effectiveAdjustment = data.adjustmentValue - orgQuota;

      await client.query(`
        INSERT INTO audit_logs (organization_id, user_id, action, module, entity_name, entity_id, new_values)
        VALUES ($1, $2, 'LEAVE_ENTITLEMENT_ADJUSTED', 'leaves', 'EmployeeLeaveAdjustment', $3, $4)
      `, [organizationId, actorUserId, adjRes.rows[0].id, JSON.stringify({
        employeeId: data.employeeId,
        organizationEntitlement: orgQuota,
        adjustmentType: data.adjustmentType,
        adjustmentValue: data.adjustmentValue,
        finalEntitlement,
        reason: data.reason
      })]);

      return {
        ...adjRes.rows[0],
        organizationEntitlement: orgQuota,
        employeeAdjustment: effectiveAdjustment,
        finalEntitlement
      };
    });
  }

  static async findLeaveAdjustments(organizationId: string, employeeId: string, year?: number) {
    const periodYear = year || new Date().getFullYear();
    const text = `
      SELECT 
        ela.id, ela.employee_id, ela.leave_type_id, lt.name as leave_type_name, lt.code as leave_type_code,
        lt.annual_quota as organization_entitlement,
        ela.period_year, ela.adjustment_type, ela.adjustment_value, ela.final_entitlement,
        ela.reason, ela.created_at, u.email as created_by_email
      FROM employee_leave_adjustments ela
      INNER JOIN leave_types lt ON ela.leave_type_id = lt.id
      LEFT JOIN users u ON ela.created_by = u.id
      WHERE ela.organization_id = $1 AND ela.employee_id = $2 AND ela.period_year = $3
      ORDER BY ela.created_at DESC
    `;
    const res = await query(text, [organizationId, employeeId, periodYear]);
    return res.rows.map(row => {
      const orgQuota = parseFloat(row.organization_entitlement || '0');
      let effectiveAdjustment = 0;
      let finalEntitlement = orgQuota;

      if (row.adjustment_type === 'INCREMENT') {
        effectiveAdjustment = parseFloat(row.adjustment_value || '0');
        finalEntitlement = orgQuota + effectiveAdjustment;
      } else if (row.adjustment_type === 'DECREMENT') {
        const adjVal = parseFloat(row.adjustment_value || '0');
        effectiveAdjustment = -adjVal;
        finalEntitlement = Math.max(0, orgQuota - adjVal);
      } else if (row.adjustment_type === 'OVERRIDE') {
        finalEntitlement = parseFloat(row.adjustment_value || '0');
        effectiveAdjustment = finalEntitlement - orgQuota;
      }

      return {
        ...row,
        organizationEntitlement: orgQuota,
        employeeAdjustment: effectiveAdjustment,
        finalEntitlement: finalEntitlement
      };
    });
  }
}
