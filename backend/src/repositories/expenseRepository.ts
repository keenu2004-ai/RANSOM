import { query } from '../db';

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
      data.attachmentName || null,
      data.receiptUrl || null,
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
}
