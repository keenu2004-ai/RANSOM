import { query, withTransaction } from '../db';
import { StorageService } from '../services/storageService';
import { processDataUrlToDrive } from '../scripts/migrate_legacy_attachments';

export interface CreateExpenseDTO {
  expenseType: 'BUSINESS' | 'LOCAL_TRAVEL';
  transactionDate?: string;
  category: string;
  merchant?: string;
  currency?: string;
  amount: number;
  bucket: string;
  transportMode?: string;
  startLocation?: string;
  endLocation?: string;
  description: string;
  attachmentName?: string;
  receiptUrl?: string;
  status?: 'DRAFT' | 'SUBMITTED';
}

export class ExpenseRepository {
  static async findCategories(organizationId: string) {
    const res = await query('SELECT id, name, code, description FROM expense_categories WHERE organization_id = $1 ORDER BY name ASC', [organizationId]);
    return res.rows;
  }

  static async create(organizationId: string, employeeId: string, data: CreateExpenseDTO) {
    const status = data.status || 'SUBMITTED';
    const transactionDate = data.transactionDate || new Date().toISOString().split('T')[0];
    const currency = data.currency || 'INR';

    let receiptUrl = data.receiptUrl || null;
    let attachmentName = data.attachmentName || null;

    if (receiptUrl && (receiptUrl.startsWith('blob:') || receiptUrl.includes('/blob:'))) {
      console.warn('[STORAGE] Rejected invalid blob: URL in ExpenseRepository.create:', receiptUrl);
      receiptUrl = null;
    } else if (receiptUrl && receiptUrl.startsWith('data:')) {
      try {
        const driveRes = await processDataUrlToDrive(
          organizationId,
          'EXPENSE',
          null,
          employeeId,
          attachmentName || 'receipt.jpg',
          receiptUrl
        );
        receiptUrl = driveRes.viewUrl;
        attachmentName = attachmentName || 'receipt.jpg';
      } catch (err: any) {
        console.warn('[STORAGE] Auto-convert base64 receipt to Google Drive failed:', err.message);
      }
    }

    const text = `
      INSERT INTO expenses (
        organization_id, employee_id, expense_type, transaction_date, category, merchant,
        currency, amount, bucket, transport_mode, start_location, end_location,
        description, attachment_name, receipt_url, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING 
        id, employee_id, expense_type, transaction_date, category, merchant,
        currency, amount, bucket, transport_mode, start_location, end_location,
        description, attachment_name, receipt_url, status, created_at, updated_at
    `;

    const params = [
      organizationId,
      employeeId,
      data.expenseType,
      transactionDate,
      data.category,
      data.merchant || null,
      currency,
      data.amount,
      data.bucket,
      data.transportMode || null,
      data.startLocation || null,
      data.endLocation || null,
      data.description,
      attachmentName,
      receiptUrl,
      status
    ];

    const res = await query(text, params);
    return res.rows[0];
  }

  static async findById(id: string, organizationId: string) {
    const text = `
      SELECT 
        ex.id, ex.employee_id, ex.expense_type, ex.transaction_date, ex.category, ex.merchant,
        ex.currency, ex.amount, ex.bucket, ex.transport_mode, ex.start_location, ex.end_location,
        ex.description, ex.attachment_name, ex.receipt_url, ex.status, ex.rejection_reason,
        ex.reviewed_at, ex.created_at, ex.updated_at,
        COALESCE(ex.category, ec.name) as category_name,
        CONCAT(emp.first_name, ' ', emp.last_name) as employee_name, emp.employee_code, emp.email as employee_email
      FROM expenses ex
      LEFT JOIN expense_categories ec ON ex.category_id = ec.id
      INNER JOIN employees emp ON ex.employee_id = emp.id
      WHERE ex.id = $1 AND ex.organization_id = $2
    `;
    const res = await query(text, [id, organizationId]);
    return res.rows[0] || null;
  }

  static async findByEmployee(organizationId: string, employeeId: string, filters: { expenseType?: string; status?: string; category?: string } = {}) {
    let whereClause = `WHERE ex.organization_id = $1 AND ex.employee_id = $2`;
    const params: any[] = [organizationId, employeeId];
    let paramIndex = 3;

    if (filters.expenseType) {
      whereClause += ` AND ex.expense_type = $${paramIndex}`;
      params.push(filters.expenseType);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND ex.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.category) {
      whereClause += ` AND (ex.category = $${paramIndex} OR ec.name = $${paramIndex})`;
      params.push(filters.category);
      paramIndex++;
    }

    const text = `
      SELECT 
        ex.id, ex.employee_id, ex.expense_type, ex.transaction_date, ex.category, ex.merchant,
        ex.currency, ex.amount, ex.bucket, ex.transport_mode, ex.start_location, ex.end_location,
        ex.description, ex.attachment_name, ex.receipt_url, ex.status, ex.rejection_reason, ex.created_at,
        COALESCE(ex.category, ec.name) as category_name
      FROM expenses ex
      LEFT JOIN expense_categories ec ON ex.category_id = ec.id
      ${whereClause}
      ORDER BY ex.created_at DESC
    `;
    const res = await query(text, params);
    return res.rows;
  }

  static async findAll(organizationId: string, filters: { expenseType?: string; status?: string; category?: string; date?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    let whereClause = `WHERE ex.organization_id = $1`;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filters.expenseType) {
      whereClause += ` AND ex.expense_type = $${paramIndex}`;
      params.push(filters.expenseType);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND ex.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.category) {
      whereClause += ` AND (ex.category = $${paramIndex} OR ec.name = $${paramIndex})`;
      params.push(filters.category);
      paramIndex++;
    }

    if (filters.date) {
      whereClause += ` AND (ex.transaction_date = $${paramIndex} OR ex.created_at::date = $${paramIndex})`;
      params.push(filters.date);
      paramIndex++;
    }

    const countSql = `
      SELECT COUNT(*)::int as total 
      FROM expenses ex 
      LEFT JOIN expense_categories ec ON ex.category_id = ec.id
      ${whereClause}
    `;
    const countRes = await query<{ total: number }>(countSql, params);

    const dataSql = `
      SELECT 
        ex.id, ex.employee_id, ex.expense_type, ex.transaction_date, ex.category, ex.merchant,
        ex.currency, ex.amount, ex.bucket, ex.transport_mode, ex.start_location, ex.end_location,
        ex.description, ex.attachment_name, ex.receipt_url, ex.status, ex.rejection_reason, ex.created_at,
        COALESCE(ex.category, ec.name) as category_name,
        CONCAT(emp.first_name, ' ', emp.last_name) as employee_name, emp.employee_code
      FROM expenses ex
      LEFT JOIN expense_categories ec ON ex.category_id = ec.id
      LEFT JOIN employees emp ON ex.employee_id = emp.id
      ${whereClause}
      ORDER BY ex.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const dataRes = await query(dataSql, params);

    return {
      expenses: dataRes.rows,
      pagination: { total: countRes.rows[0].total, page, limit, totalPages: Math.ceil(countRes.rows[0].total / limit) }
    };
  }

  static async updateDraft(id: string, organizationId: string, employeeId: string, data: Partial<CreateExpenseDTO>) {
    const text = `
      UPDATE expenses
      SET 
        transaction_date = COALESCE($1, transaction_date),
        category = COALESCE($2, category),
        merchant = COALESCE($3, merchant),
        currency = COALESCE($4, currency),
        amount = COALESCE($5, amount),
        bucket = COALESCE($6, bucket),
        transport_mode = COALESCE($7, transport_mode),
        start_location = COALESCE($8, start_location),
        end_location = COALESCE($9, end_location),
        description = COALESCE($10, description),
        attachment_name = COALESCE($11, attachment_name),
        receipt_url = COALESCE($12, receipt_url),
        status = COALESCE($13, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $14 AND organization_id = $15 AND employee_id = $16 AND status = 'DRAFT'
      RETURNING *
    `;

    const params = [
      data.transactionDate || null,
      data.category || null,
      data.merchant || null,
      data.currency || null,
      data.amount || null,
      data.bucket || null,
      data.transportMode || null,
      data.startLocation || null,
      data.endLocation || null,
      data.description || null,
      data.attachmentName || null,
      data.receiptUrl || null,
      data.status || 'DRAFT',
      id,
      organizationId,
      employeeId
    ];

    const res = await query(text, params);
    return res.rows[0] || null;
  }

  static async submitDraft(id: string, organizationId: string, employeeId: string) {
    const text = `
      UPDATE expenses
      SET status = 'SUBMITTED', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND organization_id = $2 AND employee_id = $3 AND status = 'DRAFT'
      RETURNING *
    `;
    const res = await query(text, [id, organizationId, employeeId]);
    return res.rows[0] || null;
  }

  static async updateStatus(id: string, organizationId: string, status: 'APPROVED' | 'REJECTED', reviewerEmployeeId?: string, rejectionReason?: string) {
    const text = `
      UPDATE expenses
      SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND organization_id = $5 AND status IN ('SUBMITTED', 'PENDING', 'DRAFT')
      RETURNING id, employee_id, expense_type, amount, currency, status, updated_at
    `;
    const res = await query(text, [status, reviewerEmployeeId || null, rejectionReason || null, id, organizationId]);
    const row = res.rows[0];

    if (row) {
      try {
        const action = status === 'APPROVED' ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED';
        await query(`
          INSERT INTO audit_logs (organization_id, user_id, action, module, entity_name, entity_id, new_values)
          VALUES ($1, $2, $3, 'expenses', 'Expense', $4, $5)
        `, [organizationId, reviewerEmployeeId || null, action, id, JSON.stringify({ status, rejectionReason })]);

        const empUserRes = await query('SELECT user_id FROM employees WHERE id = $1', [row.employee_id]);
        if (empUserRes.rows.length > 0 && empUserRes.rows[0].user_id) {
          await query(`
            INSERT INTO notifications (organization_id, user_id, title, message)
            VALUES ($1, $2, $3, $4)
          `, [
            organizationId,
            empUserRes.rows[0].user_id,
            `Expense Claim ${status}`,
            status === 'APPROVED'
              ? `Your ${row.expense_type} claim of ₹${row.amount} has been approved.`
              : `Your ${row.expense_type} claim of ₹${row.amount} was rejected: ${rejectionReason || 'No reason specified'}.`
          ]);
        }
      } catch (auditErr) {
        console.warn('Audit log write failed for expense updateStatus:', auditErr);
      }
    }

    return row || null;
  }

  static async deleteSuperAdmin(id: string, organizationId: string, userId: string) {
    return withTransaction(async (client) => {
      const expRes = await client.query('SELECT * FROM expenses WHERE id = $1 AND organization_id = $2', [id, organizationId]);
      if (expRes.rows.length === 0) return null;
      const expense = expRes.rows[0];

      const attRes = await client.query("SELECT * FROM attachments WHERE organization_id = $1 AND entity_type = 'EXPENSE' AND entity_id = $2", [organizationId, id]);
      for (const att of attRes.rows) {
        await StorageService.deleteObject(att.storage_file_id, att.object_path);
      }

      await client.query("DELETE FROM attachments WHERE organization_id = $1 AND entity_type = 'EXPENSE' AND entity_id = $2", [organizationId, id]);
      await client.query('DELETE FROM expenses WHERE id = $1 AND organization_id = $2', [id, organizationId]);

      await client.query(`
        INSERT INTO audit_logs (organization_id, user_id, action, module, entity_name, entity_id, old_values)
        VALUES ($1, $2, 'EXPENSE_DELETED', 'expenses', 'Expense', $3, $4)
      `, [organizationId, userId, id, JSON.stringify(expense)]);

      return expense;
    });
  }

  // ============================================================
  // MANAGEMENT ANALYTICS METHODS
  // ============================================================

  /**
   * Helper CTE SQL for combining single claims (`expenses`) and trip parent claims (`trip_expenses`).
   * Trip child records are NOT counted separately to avoid double-counting.
   */
  private static getCombinedClaimsCTE() {
    return `
      WITH unified_claims AS (
        SELECT
          id,
          organization_id,
          employee_id,
          expense_type,
          COALESCE(transaction_date, created_at::date) as claim_date,
          COALESCE(category, 'General') as category,
          amount,
          status,
          merchant,
          description,
          created_at,
          reviewed_at,
          reviewed_by,
          rejection_reason,
          'SINGLE' as claim_source
        FROM expenses
        WHERE organization_id = $1

        UNION ALL

        SELECT
          id,
          organization_id,
          employee_id,
          'TRIP' as expense_type,
          COALESCE(start_date, created_at::date) as claim_date,
          'Trip Expense' as category,
          total_amount as amount,
          status,
          CONCAT(start_point, ' to ', end_point) as merchant,
          purpose as description,
          created_at,
          reviewed_at,
          reviewed_by,
          rejection_reason,
          'TRIP' as claim_source
        FROM trip_expenses
        WHERE organization_id = $1
      )
    `;
  }

  static async getManagementSummary(organizationId: string, fyStart: string, fyEnd: string, prevFyStart?: string, prevFyEnd?: string) {
    const cte = this.getCombinedClaimsCTE();

    // 1. Employee stats
    const empCountRes = await query(`
      SELECT COUNT(*)::int as total_employees
      FROM employees
      WHERE organization_id = $1 AND status = 'Active'
    `, [organizationId]);
    const totalEmployees = empCountRes.rows[0]?.total_employees || 0;

    // 2. Current FY totals
    const curSummaryRes = await query(`
      ${cte}
      SELECT
        COUNT(DISTINCT employee_id)::int as employees_with_expenses,
        COALESCE(SUM(amount), 0)::numeric as total_requested_amount,
        COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0)::numeric as approved_amount,
        COALESCE(SUM(CASE WHEN status IN ('SUBMITTED', 'PENDING') THEN amount ELSE 0 END), 0)::numeric as pending_amount,
        COALESCE(SUM(CASE WHEN status = 'REJECTED' THEN amount ELSE 0 END), 0)::numeric as rejected_amount
      FROM unified_claims
      WHERE claim_date >= $2 AND claim_date <= $3
    `, [organizationId, fyStart, fyEnd]);

    const cur = curSummaryRes.rows[0] || {};
    const employeesWithExpenses = parseInt(cur.employees_with_expenses || '0', 10);
    const totalRequestedAmount = parseFloat(cur.total_requested_amount || '0');
    const approvedAmount = parseFloat(cur.approved_amount || '0');
    const pendingAmount = parseFloat(cur.pending_amount || '0');
    const rejectedAmount = parseFloat(cur.rejected_amount || '0');

    const approvedPct = totalRequestedAmount > 0 ? (approvedAmount / totalRequestedAmount) * 100 : 0;
    const pendingPct = totalRequestedAmount > 0 ? (pendingAmount / totalRequestedAmount) * 100 : 0;
    const rejectedPct = totalRequestedAmount > 0 ? (rejectedAmount / totalRequestedAmount) * 100 : 0;
    const activeEmpPct = totalEmployees > 0 ? (employeesWithExpenses / totalEmployees) * 100 : 0;

    // 3. Optional Prior FY totals for YoY percentage calculation
    let prevData: any = null;
    if (prevFyStart && prevFyEnd) {
      const prevSummaryRes = await query(`
        ${cte}
        SELECT
          COUNT(DISTINCT employee_id)::int as employees_with_expenses,
          COALESCE(SUM(amount), 0)::numeric as total_requested_amount,
          COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0)::numeric as approved_amount
        FROM unified_claims
        WHERE claim_date >= $2 AND claim_date <= $3
      `, [organizationId, prevFyStart, prevFyEnd]);
      const p = prevSummaryRes.rows[0];
      if (p && parseFloat(p.total_requested_amount || '0') > 0) {
        prevData = {
          employeesWithExpenses: parseInt(p.employees_with_expenses || '0', 10),
          totalRequestedAmount: parseFloat(p.total_requested_amount || '0'),
          approvedAmount: parseFloat(p.approved_amount || '0')
        };
      }
    }

    let yoyEmployeesPct: number | null = null;
    let yoyTotalAmountPct: number | null = null;
    let yoyApprovedAmountPct: number | null = null;

    if (prevData) {
      if (prevData.employeesWithExpenses > 0) {
        yoyEmployeesPct = ((employeesWithExpenses - prevData.employeesWithExpenses) / prevData.employeesWithExpenses) * 100;
      }
      if (prevData.totalRequestedAmount > 0) {
        yoyTotalAmountPct = ((totalRequestedAmount - prevData.totalRequestedAmount) / prevData.totalRequestedAmount) * 100;
      }
      if (prevData.approvedAmount > 0) {
        yoyApprovedAmountPct = ((approvedAmount - prevData.approvedAmount) / prevData.approvedAmount) * 100;
      }
    }

    return {
      totalEmployees,
      employeesWithExpenses,
      activeEmpPct,
      totalRequestedAmount,
      approvedAmount,
      approvedPct,
      pendingAmount,
      pendingPct,
      rejectedAmount,
      rejectedPct,
      yoyEmployeesPct,
      yoyTotalAmountPct,
      yoyApprovedAmountPct
    };
  }

  static async getEmployeeExpenseOverview(
    organizationId: string,
    fyStart: string,
    fyEnd: string,
    filters: { search?: string; departmentId?: string; status?: string; page?: number; limit?: number; includeZeroExpenses?: boolean }
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    const cte = this.getCombinedClaimsCTE();

    let whereSql = `WHERE emp.organization_id = $1 AND emp.status = 'Active'`;
    const params: any[] = [organizationId, fyStart, fyEnd];
    let paramIdx = 4;

    if (filters.departmentId) {
      whereSql += ` AND emp.department_id = $${paramIdx}`;
      params.push(filters.departmentId);
      paramIdx++;
    }

    if (filters.search) {
      whereSql += ` AND (CONCAT(emp.first_name, ' ', emp.last_name) ILIKE $${paramIdx} OR emp.employee_code ILIKE $${paramIdx})`;
      params.push(`%${filters.search}%`);
      paramIdx++;
    }

    let statusFilterClause = '';
    if (filters.status) {
      statusFilterClause = `HAVING SUM(CASE WHEN uc.status = $${paramIdx} THEN 1 ELSE 0 END) > 0`;
      params.push(filters.status);
      paramIdx++;
    } else if (!filters.includeZeroExpenses) {
      statusFilterClause = `HAVING COUNT(uc.id) > 0`;
    }

    const countSql = `
      ${cte}
      SELECT COUNT(*)::int as total FROM (
        SELECT emp.id
        FROM employees emp
        LEFT JOIN unified_claims uc ON emp.id = uc.employee_id AND uc.claim_date >= $2 AND uc.claim_date <= $3
        ${whereSql}
        GROUP BY emp.id
        ${statusFilterClause}
      ) sub
    `;
    const countRes = await query<{ total: number }>(countSql, params);
    const totalRecords = countRes.rows[0]?.total || 0;

    const dataSql = `
      ${cte}
      SELECT
        emp.id as employee_id,
        CONCAT(emp.first_name, ' ', emp.last_name) as employee_name,
        emp.employee_code,
        emp.status as employee_status,
        COALESCE(dept.name, 'Unassigned') as department,
        COALESCE(SUM(CASE WHEN uc.status = 'APPROVED' THEN uc.amount ELSE 0 END), 0)::numeric as approved_amount,
        COALESCE(SUM(CASE WHEN uc.status IN ('SUBMITTED', 'PENDING') THEN uc.amount ELSE 0 END), 0)::numeric as pending_amount,
        COALESCE(SUM(CASE WHEN uc.status = 'REJECTED' THEN uc.amount ELSE 0 END), 0)::numeric as rejected_amount,
        COALESCE(SUM(uc.amount), 0)::numeric as total_requested,
        COALESCE(SUM(CASE WHEN uc.status IN ('APPROVED', 'SUBMITTED', 'PENDING') THEN uc.amount ELSE 0 END), 0)::numeric as total_expense,
        MODE() WITHIN GROUP (ORDER BY uc.category) as top_category
      FROM employees emp
      LEFT JOIN departments dept ON emp.department_id = dept.id
      LEFT JOIN unified_claims uc ON emp.id = uc.employee_id AND uc.claim_date >= $2 AND uc.claim_date <= $3
      ${whereSql}
      GROUP BY emp.id, emp.first_name, emp.last_name, emp.employee_code, emp.status, dept.name
      ${statusFilterClause}
      ORDER BY total_expense DESC, emp.employee_code ASC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    params.push(limit, offset);
    const dataRes = await query(dataSql, params);

    return {
      employees: dataRes.rows.map(r => ({
        employeeId: r.employee_id,
        employeeName: r.employee_name,
        employeeCode: r.employee_code,
        employeeStatus: r.employee_status,
        department: r.department,
        approvedAmount: parseFloat(r.approved_amount || '0'),
        pendingAmount: parseFloat(r.pending_amount || '0'),
        rejectedAmount: parseFloat(r.rejected_amount || '0'),
        totalRequested: parseFloat(r.total_requested || '0'),
        totalExpense: parseFloat(r.total_expense || '0'),
        topCategory: r.top_category || 'General'
      })),
      pagination: {
        total: totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit)
      }
    };
  }

  static async getEmployeeExpenseRecords(
    organizationId: string,
    employeeId: string,
    fyStart: string,
    fyEnd: string,
    filters: { search?: string; type?: string; category?: string; status?: string; page?: number; limit?: number }
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    const cte = this.getCombinedClaimsCTE();

    let whereSql = `WHERE uc.employee_id = $2 AND uc.claim_date >= $3 AND uc.claim_date <= $4`;
    const params: any[] = [organizationId, employeeId, fyStart, fyEnd];
    let pIdx = 5;

    if (filters.search) {
      whereSql += ` AND (uc.description ILIKE $${pIdx} OR uc.merchant ILIKE $${pIdx} OR uc.category ILIKE $${pIdx})`;
      params.push(`%${filters.search}%`);
      pIdx++;
    }

    if (filters.type) {
      if (filters.type === 'TRIP') {
        whereSql += ` AND uc.claim_source = 'TRIP'`;
      } else {
        whereSql += ` AND uc.expense_type = $${pIdx}`;
        params.push(filters.type);
        pIdx++;
      }
    }

    if (filters.category) {
      whereSql += ` AND uc.category = $${pIdx}`;
      params.push(filters.category);
      pIdx++;
    }

    if (filters.status) {
      whereSql += ` AND uc.status = $${pIdx}`;
      params.push(filters.status);
      pIdx++;
    }

    const countSql = `
      ${cte}
      SELECT COUNT(*)::int as total
      FROM unified_claims uc
      ${whereSql}
    `;
    const countRes = await query<{ total: number }>(countSql, params);
    const totalRecords = countRes.rows[0]?.total || 0;

    const summarySql = `
      ${cte}
      SELECT
        COALESCE(SUM(CASE WHEN uc.status = 'APPROVED' THEN uc.amount ELSE 0 END), 0)::numeric as approved_amount,
        COALESCE(SUM(CASE WHEN uc.status IN ('SUBMITTED', 'PENDING') THEN uc.amount ELSE 0 END), 0)::numeric as pending_amount,
        COALESCE(SUM(CASE WHEN uc.status = 'REJECTED' THEN uc.amount ELSE 0 END), 0)::numeric as rejected_amount,
        COALESCE(SUM(uc.amount), 0)::numeric as total_requested
      FROM unified_claims uc
      ${whereSql}
    `;
    const summaryRes = await query(summarySql, params);
    const sumRow = summaryRes.rows[0] || {};

    const dataSql = `
      ${cte}
      SELECT
        uc.id,
        uc.expense_type,
        uc.claim_date,
        uc.category,
        uc.amount,
        uc.status,
        uc.merchant,
        uc.description,
        uc.claim_source,
        uc.created_at as submitted_date,
        uc.reviewed_at,
        CONCAT(rev.first_name, ' ', rev.last_name) as reviewer_name,
        uc.rejection_reason
      FROM unified_claims uc
      LEFT JOIN employees rev ON uc.reviewed_by = rev.id
      ${whereSql}
      ORDER BY uc.claim_date DESC, uc.created_at DESC
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;

    params.push(limit, offset);
    const dataRes = await query(dataSql, params);

    return {
      summary: {
        totalRecords,
        approvedAmount: parseFloat(sumRow.approved_amount || '0'),
        pendingAmount: parseFloat(sumRow.pending_amount || '0'),
        rejectedAmount: parseFloat(sumRow.rejected_amount || '0'),
        totalRequested: parseFloat(sumRow.total_requested || '0')
      },
      records: dataRes.rows.map(r => ({
        id: r.id,
        expenseType: r.expense_type,
        date: r.claim_date,
        category: r.category,
        amount: parseFloat(r.amount || '0'),
        status: r.status,
        merchant: r.merchant || '',
        description: r.description || '',
        claimSource: r.claim_source,
        submittedDate: r.submitted_date,
        reviewedDate: r.reviewed_at || '',
        approver: r.reviewer_name || '',
        rejectionReason: r.rejection_reason || ''
      })),
      pagination: {
        total: totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit)
      }
    };
  }

  static async getEmployeeExpenseDetails(organizationId: string, employeeId: string, fyStart: string, fyEnd: string) {
    const cte = this.getCombinedClaimsCTE();

    // 1. Employee header info
    const empRes = await query(`
      SELECT emp.id, emp.first_name, emp.last_name, emp.employee_code, emp.status, COALESCE(dept.name, 'Unassigned') as department
      FROM employees emp
      LEFT JOIN departments dept ON emp.department_id = dept.id
      WHERE emp.id = $1 AND emp.organization_id = $2
    `, [employeeId, organizationId]);

    if (empRes.rows.length === 0) return null;
    const emp = empRes.rows[0];

    // 2. Summary stats
    const summaryRes = await query(`
      ${cte}
      SELECT
        COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0)::numeric as approved_amount,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END)::int as approved_claims,
        COALESCE(SUM(CASE WHEN status IN ('SUBMITTED', 'PENDING') THEN amount ELSE 0 END), 0)::numeric as pending_amount,
        COUNT(CASE WHEN status IN ('SUBMITTED', 'PENDING') THEN 1 END)::int as pending_claims,
        COALESCE(SUM(CASE WHEN status = 'REJECTED' THEN amount ELSE 0 END), 0)::numeric as rejected_amount,
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END)::int as rejected_claims,
        COALESCE(SUM(amount), 0)::numeric as total_requested_amount,
        COUNT(*)::int as total_requested_claims
      FROM unified_claims
      WHERE employee_id = $2 AND claim_date >= $3 AND claim_date <= $4
    `, [organizationId, employeeId, fyStart, fyEnd]);

    const s = summaryRes.rows[0] || {};
    const totalRequestedAmount = parseFloat(s.total_requested_amount || '0');

    // 3. Category breakdown
    const catRes = await query(`
      ${cte}
      SELECT
        category,
        COALESCE(SUM(amount), 0)::numeric as category_amount,
        COUNT(*)::int as claim_count
      FROM unified_claims
      WHERE employee_id = $2 AND claim_date >= $3 AND claim_date <= $4
      GROUP BY category
      ORDER BY category_amount DESC
    `, [organizationId, employeeId, fyStart, fyEnd]);

    const categories = catRes.rows.map(r => {
      const amount = parseFloat(r.category_amount || '0');
      const percentage = totalRequestedAmount > 0 ? (amount / totalRequestedAmount) * 100 : 0;
      return {
        category: r.category,
        amount,
        percentage,
        claimCount: r.claim_count
      };
    });

    // 4. Claims list
    const claimsRes = await query(`
      ${cte}
      SELECT id, expense_type, claim_date, category, amount, status, description, merchant, claim_source
      FROM unified_claims
      WHERE employee_id = $2 AND claim_date >= $3 AND claim_date <= $4
      ORDER BY claim_date DESC, created_at DESC
    `, [organizationId, employeeId, fyStart, fyEnd]);

    return {
      employee: {
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        employeeCode: emp.employee_code,
        department: emp.department,
        status: emp.status
      },
      summary: {
        approvedAmount: parseFloat(s.approved_amount || '0'),
        approvedClaims: s.approved_claims || 0,
        pendingAmount: parseFloat(s.pending_amount || '0'),
        pendingClaims: s.pending_claims || 0,
        rejectedAmount: parseFloat(s.rejected_amount || '0'),
        rejectedClaims: s.rejected_claims || 0,
        totalRequestedAmount,
        totalRequestedClaims: s.total_requested_claims || 0
      },
      categories,
      claims: claimsRes.rows.map(c => ({
        id: c.id,
        expenseType: c.expense_type,
        date: c.claim_date,
        category: c.category,
        amount: parseFloat(c.amount || '0'),
        status: c.status,
        description: c.description,
        merchant: c.merchant,
        claimSource: c.claim_source
      }))
    };
  }

  static async getExpenseAnalytics(organizationId: string, fyStart: string, fyEnd: string, startYear: number) {
    const cte = this.getCombinedClaimsCTE();

    // 1. Category donut breakdown
    const catRes = await query(`
      ${cte}
      SELECT
        category,
        COALESCE(SUM(amount), 0)::numeric as total_amount
      FROM unified_claims
      WHERE claim_date >= $2 AND claim_date <= $3
      GROUP BY category
      ORDER BY total_amount DESC
    `, [organizationId, fyStart, fyEnd]);

    const overallTotal = catRes.rows.reduce((sum, r) => sum + parseFloat(r.total_amount || '0'), 0);
    const categoryBreakdown = catRes.rows.map(r => {
      const amount = parseFloat(r.total_amount || '0');
      return {
        category: r.category,
        amount,
        percentage: overallTotal > 0 ? (amount / overallTotal) * 100 : 0
      };
    });

    // 2. Monthly Expense Trend (Apr -> Mar)
    const monthConfigs = [
      { key: 'Apr', monthIndex: 4, year: startYear },
      { key: 'May', monthIndex: 5, year: startYear },
      { key: 'Jun', monthIndex: 6, year: startYear },
      { key: 'Jul', monthIndex: 7, year: startYear },
      { key: 'Aug', monthIndex: 8, year: startYear },
      { key: 'Sep', monthIndex: 9, year: startYear },
      { key: 'Oct', monthIndex: 10, year: startYear },
      { key: 'Nov', monthIndex: 11, year: startYear },
      { key: 'Dec', monthIndex: 12, year: startYear },
      { key: 'Jan', monthIndex: 1, year: startYear + 1 },
      { key: 'Feb', monthIndex: 2, year: startYear + 1 },
      { key: 'Mar', monthIndex: 3, year: startYear + 1 }
    ];

    const monthlyRes = await query(`
      ${cte}
      SELECT
        EXTRACT(YEAR FROM claim_date)::int as yr,
        EXTRACT(MONTH FROM claim_date)::int as mo,
        COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0)::numeric as approved_amount,
        COALESCE(SUM(CASE WHEN status IN ('SUBMITTED', 'PENDING') THEN amount ELSE 0 END), 0)::numeric as pending_amount,
        COALESCE(SUM(CASE WHEN status = 'REJECTED' THEN amount ELSE 0 END), 0)::numeric as rejected_amount
      FROM unified_claims
      WHERE claim_date >= $2 AND claim_date <= $3
      GROUP BY yr, mo
    `, [organizationId, fyStart, fyEnd]);

    const monthlyMap = new Map<string, { approved: number; pending: number; rejected: number }>();
    monthlyRes.rows.forEach(r => {
      const key = `${r.yr}-${r.mo}`;
      monthlyMap.set(key, {
        approved: parseFloat(r.approved_amount || '0'),
        pending: parseFloat(r.pending_amount || '0'),
        rejected: parseFloat(r.rejected_amount || '0')
      });
    });

    const monthlyTrend = monthConfigs.map(m => {
      const key = `${m.year}-${m.monthIndex}`;
      const stats = monthlyMap.get(key) || { approved: 0, pending: 0, rejected: 0 };
      return {
        month: m.key,
        year: m.year,
        approved: stats.approved,
        pending: stats.pending,
        rejected: stats.rejected,
        total: stats.approved + stats.pending + stats.rejected
      };
    });

    // 3. Top Cost Categories
    const topCategories = categoryBreakdown.slice(0, 5);

    // 4. Cost Optimization Insight
    let costOptimizationInsight = "No expense data available for cost optimization analysis.";
    if (categoryBreakdown.length > 0 && overallTotal > 0) {
      const topCat = categoryBreakdown[0];
      const pctRounded = Math.round(topCat.percentage);
      costOptimizationInsight = `${topCat.category} is ${pctRounded}% of total expense (₹${topCat.amount.toLocaleString('en-IN')}). Consider reviewing recurring routes, merchant vendors, or reimbursement policies to optimize costs.`;
    }

    // 5. Department Analysis
    const deptRes = await query(`
      ${cte}
      SELECT
        COALESCE(dept.name, 'Unassigned') as department,
        COALESCE(SUM(CASE WHEN uc.status = 'APPROVED' THEN uc.amount ELSE 0 END), 0)::numeric as approved_amount,
        COALESCE(SUM(CASE WHEN uc.status IN ('SUBMITTED', 'PENDING') THEN uc.amount ELSE 0 END), 0)::numeric as pending_amount,
        COALESCE(SUM(CASE WHEN uc.status = 'REJECTED' THEN uc.amount ELSE 0 END), 0)::numeric as rejected_amount,
        COALESCE(SUM(uc.amount), 0)::numeric as total_requested,
        COALESCE(SUM(CASE WHEN uc.status IN ('APPROVED', 'SUBMITTED', 'PENDING') THEN uc.amount ELSE 0 END), 0)::numeric as total_expense,
        COUNT(DISTINCT uc.employee_id)::int as employees_with_expenses
      FROM unified_claims uc
      INNER JOIN employees emp ON uc.employee_id = emp.id
      LEFT JOIN departments dept ON emp.department_id = dept.id
      WHERE uc.claim_date >= $2 AND uc.claim_date <= $3
      GROUP BY dept.name
      ORDER BY total_expense DESC
    `, [organizationId, fyStart, fyEnd]);

    const departmentAnalysis = deptRes.rows.map(r => {
      const empCount = parseInt(r.employees_with_expenses || '0', 10);
      const totalExpense = parseFloat(r.total_expense || '0');
      const avgPerEmp = empCount > 0 ? totalExpense / empCount : 0;
      return {
        department: r.department,
        approvedAmount: parseFloat(r.approved_amount || '0'),
        pendingAmount: parseFloat(r.pending_amount || '0'),
        rejectedAmount: parseFloat(r.rejected_amount || '0'),
        totalRequested: parseFloat(r.total_requested || '0'),
        totalExpense,
        employeesWithExpenses: empCount,
        averageExpensePerEmployee: avgPerEmp
      };
    });

    return {
      overallTotal,
      categoryBreakdown,
      monthlyTrend,
      topCategories,
      costOptimizationInsight,
      departmentAnalysis
    };
  }

  static async getRecentRequests(organizationId: string, fyStart: string, fyEnd: string, limit = 5) {
    const cte = this.getCombinedClaimsCTE();
    const res = await query(`
      ${cte}
      SELECT
        uc.id,
        uc.expense_type,
        uc.claim_date,
        uc.category,
        uc.amount,
        uc.status,
        uc.merchant,
        uc.description,
        uc.claim_source,
        CONCAT(emp.first_name, ' ', emp.last_name) as employee_name,
        emp.employee_code
      FROM unified_claims uc
      INNER JOIN employees emp ON uc.employee_id = emp.id
      WHERE uc.claim_date >= $2 AND uc.claim_date <= $3
      ORDER BY uc.claim_date DESC, uc.created_at DESC
      LIMIT $4
    `, [organizationId, fyStart, fyEnd, limit]);

    return res.rows.map(r => ({
      id: r.id,
      employeeName: r.employee_name,
      employeeCode: r.employee_code,
      expenseType: r.expense_type,
      date: r.claim_date,
      category: r.category,
      amount: parseFloat(r.amount || '0'),
      status: r.status,
      merchant: r.merchant,
      description: r.description,
      claimSource: r.claim_source
    }));
  }

  static async generateExpenseReportData(organizationId: string, fyStart: string, fyEnd: string, filters: { departmentId?: string; status?: string; category?: string } = {}) {
    const cte = this.getCombinedClaimsCTE();

    let whereSql = `WHERE uc.claim_date >= $2 AND uc.claim_date <= $3`;
    const params: any[] = [organizationId, fyStart, fyEnd];
    let pIdx = 4;

    if (filters.departmentId) {
      whereSql += ` AND emp.department_id = $${pIdx}`;
      params.push(filters.departmentId);
      pIdx++;
    }
    if (filters.status) {
      whereSql += ` AND uc.status = $${pIdx}`;
      params.push(filters.status);
      pIdx++;
    }
    if (filters.category) {
      whereSql += ` AND uc.category = $${pIdx}`;
      params.push(filters.category);
      pIdx++;
    }

    // Detailed Claims
    const detailedRes = await query(`
      ${cte}
      SELECT
        CONCAT(emp.first_name, ' ', emp.last_name) as employee_name,
        emp.employee_code,
        COALESCE(dept.name, 'Unassigned') as department,
        uc.id as claim_id,
        uc.expense_type,
        uc.category,
        uc.claim_date,
        uc.amount,
        uc.status,
        uc.merchant,
        uc.description,
        uc.created_at as submitted_date,
        uc.reviewed_at,
        CONCAT(rev.first_name, ' ', rev.last_name) as reviewer_name,
        uc.rejection_reason as remarks
      FROM unified_claims uc
      INNER JOIN employees emp ON uc.employee_id = emp.id
      LEFT JOIN departments dept ON emp.department_id = dept.id
      LEFT JOIN employees rev ON uc.reviewed_by = rev.id
      ${whereSql}
      ORDER BY uc.claim_date DESC
    `, params);

    return detailedRes.rows.map(r => ({
      employeeName: r.employee_name,
      employeeCode: r.employee_code,
      department: r.department,
      claimId: r.claim_id,
      expenseType: r.expense_type,
      category: r.category,
      date: r.claim_date,
      amount: parseFloat(r.amount || '0'),
      status: r.status,
      merchant: r.merchant || '',
      description: r.description || '',
      submittedDate: r.submitted_date,
      reviewedDate: r.reviewed_at || '',
      approver: r.reviewer_name || '',
      remarks: r.remarks || ''
    }));
  }
}
