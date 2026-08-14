import { query } from '../db';

export class ExpenseRepository {
  static async findCategories(organizationId: string) {
    const res = await query('SELECT id, name, code, description FROM expense_categories WHERE organization_id = $1 ORDER BY name ASC', [organizationId]);
    return res.rows;
  }

  static async create(organizationId: string, employeeId: string, data: { categoryId: string; amount: number; description: string; receiptUrl?: string }) {
    const text = `
      INSERT INTO expenses (organization_id, employee_id, category_id, amount, description, receipt_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
      RETURNING id, employee_id, category_id, amount, description, status, created_at
    `;
    const res = await query(text, [organizationId, employeeId, data.categoryId, data.amount, data.description, data.receiptUrl || null]);
    return res.rows[0];
  }

  static async findByEmployee(organizationId: string, employeeId: string) {
    const text = `
      SELECT e.id, e.amount, e.description, e.receipt_url, e.status, e.created_at, ec.name as category_name
      FROM expenses e
      INNER JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.organization_id = $1 AND e.employee_id = $2
      ORDER BY e.created_at DESC
    `;
    const res = await query(text, [organizationId, employeeId]);
    return res.rows;
  }

  static async findAll(organizationId: string, filters: { status?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = `WHERE ex.organization_id = $1`;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filters.status) {
      whereClause += ` AND ex.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    const countSql = `SELECT COUNT(*)::int as total FROM expenses ex ${whereClause}`;
    const countRes = await query<{ total: number }>(countSql, params);

    const dataSql = `
      SELECT 
        ex.id, ex.amount, ex.description, ex.receipt_url, ex.status, ex.created_at,
        ec.name as category_name,
        CONCAT(emp.first_name, ' ', emp.last_name) as employee_name, emp.employee_code
      FROM expenses ex
      INNER JOIN expense_categories ec ON ex.category_id = ec.id
      INNER JOIN employees emp ON ex.employee_id = emp.id
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

  static async updateStatus(id: string, organizationId: string, status: 'APPROVED' | 'REJECTED', reviewerEmployeeId?: string, rejectionReason?: string) {
    const text = `
      UPDATE expenses
      SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND organization_id = $5
      RETURNING id, status, updated_at
    `;
    const res = await query(text, [status, reviewerEmployeeId || null, rejectionReason || null, id, organizationId]);
    return res.rows[0] || null;
  }
}
