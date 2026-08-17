import { query, withTransaction } from '../db';

export interface EmployeeFilter {
  search?: string;
  departmentId?: string;
  designationId?: string;
  branchId?: string;
  teamId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class EmployeeRepository {
  static async findAll(organizationId: string, filters: EmployeeFilter) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = `WHERE e.organization_id = $1`;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filters.search) {
      whereClause += ` AND (
        LOWER(e.first_name) LIKE LOWER($${paramIndex}) OR 
        LOWER(e.last_name) LIKE LOWER($${paramIndex}) OR 
        LOWER(e.employee_code) LIKE LOWER($${paramIndex}) OR 
        LOWER(e.email) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.departmentId) {
      whereClause += ` AND e.department_id = $${paramIndex}`;
      params.push(filters.departmentId);
      paramIndex++;
    }

    if (filters.designationId) {
      whereClause += ` AND e.designation_id = $${paramIndex}`;
      params.push(filters.designationId);
      paramIndex++;
    }

    if (filters.branchId) {
      whereClause += ` AND e.branch_id = $${paramIndex}`;
      params.push(filters.branchId);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND e.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    // Count total records
    const countSql = `SELECT COUNT(*)::int as total FROM employees e ${whereClause}`;
    const countRes = await query<{ total: number }>(countSql, params);
    const total = countRes.rows[0].total;

    // Fetch paginated rows with explicit SELECT
    const dataSql = `
      SELECT 
        e.id,
        e.organization_id,
        e.user_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        e.phone,
        e.joining_date,
        e.employment_type,
        e.status,
        e.branch_id,
        b.name as branch_name,
        e.department_id,
        d.name as department_name,
        e.designation_id,
        des.name as designation_name,
        e.team_id,
        t.name as team_name,
        e.manager_id,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name,
        e.created_at,
        e.updated_at
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN teams t ON e.team_id = t.id
      LEFT JOIN employees m ON e.manager_id = m.id
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const dataRes = await query(dataSql, params);

    return {
      employees: dataRes.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async findById(id: string, organizationId: string) {
    const text = `
      SELECT 
        e.id,
        e.organization_id,
        e.user_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        e.phone,
        e.date_of_birth,
        e.gender,
        e.joining_date,
        e.employment_type,
        e.status,
        e.branch_id,
        b.name as branch_name,
        e.department_id,
        d.name as department_name,
        e.designation_id,
        des.name as designation_name,
        e.team_id,
        t.name as team_name,
        e.manager_id,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name,
        e.shift_id,
        s.name as shift_name,
        e.pan_number,
        e.aadhaar_number,
        e.bank_account_number,
        e.bank_ifsc,
        e.created_at,
        e.updated_at
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN teams t ON e.team_id = t.id
      LEFT JOIN employees m ON e.manager_id = m.id
      LEFT JOIN shifts s ON e.shift_id = s.id
      WHERE e.id = $1 AND e.organization_id = $2
    `;
    const res = await query(text, [id, organizationId]);
    return res.rows[0] || null;
  }

  static async create(data: any) {
    return withTransaction(async (client) => {
      // 1. Create or link user account with initial password
      const bcrypt = require('bcryptjs');
      const rawPassword = data.password || 'ChangeMe@123';
      const passwordHash = bcrypt.hashSync(rawPassword, 10);

      const userRes = await client.query(`
        INSERT INTO users (organization_id, email, password_hash, status)
        VALUES ($1, $2, $3, 'ACTIVE')
        ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [data.organization_id, data.email, passwordHash]);
      const userId = userRes.rows[0].id;

      // Assign EMPLOYEE role to newly created user
      const roleRes = await client.query('SELECT id FROM roles WHERE organization_id = $1 AND name = $2', [data.organization_id, 'EMPLOYEE']);
      if (roleRes.rows.length > 0) {
        await client.query(`
          INSERT INTO user_roles (user_id, role_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id, role_id) DO NOTHING
        `, [userId, roleRes.rows[0].id]);
      }

      // 2. Generate employee code if not provided
      let empCode = data.employee_code;
      if (!empCode) {
        const countRes = await client.query('SELECT COUNT(*)::int as count FROM employees WHERE organization_id = $1', [data.organization_id]);
        const num = (countRes.rows[0].count + 1).toString().padStart(3, '0');
        empCode = `EMP-${num}`;
      }

      const text = `
        INSERT INTO employees (
          organization_id, user_id, employee_code, first_name, last_name, email,
          phone, date_of_birth, gender, joining_date, employment_type, status,
          branch_id, department_id, designation_id, team_id, manager_id, shift_id,
          pan_number, aadhaar_number, bank_account_number, bank_ifsc
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
        ) RETURNING id, employee_code, first_name, last_name, email, status, created_at
      `;

      const params = [
        data.organization_id, userId, empCode, data.first_name, data.last_name, data.email,
        data.phone || null, data.date_of_birth || null, data.gender || null, data.joining_date || new Date(),
        data.employment_type || 'FULL_TIME', data.status || 'ACTIVE',
        data.branch_id || null, data.department_id || null, data.designation_id || null,
        data.team_id || null, data.manager_id || null, data.shift_id || null,
        data.pan_number || null, data.aadhaar_number || null, data.bank_account_number || null, data.bank_ifsc || null
      ];

      const res = await client.query(text, params);
      const employee = res.rows[0];

      // Auto initialize default leave balances for active employees
      const leaveTypesRes = await client.query('SELECT id, annual_quota FROM leave_types WHERE organization_id = $1', [data.organization_id]);
      const currentYear = new Date().getFullYear();

      for (const lt of leaveTypesRes.rows) {
        await client.query(`
          INSERT INTO leave_balances (organization_id, employee_id, leave_type_id, year, quota, available)
          VALUES ($1, $2, $3, $4, $5, $5)
          ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING
        `, [data.organization_id, employee.id, lt.id, currentYear, lt.annual_quota]);
      }

      return employee;
    });
  }

  static async update(id: string, organizationId: string, data: any) {
    const text = `
      UPDATE employees SET
        first_name = COALESCE($3, first_name),
        last_name = COALESCE($4, last_name),
        phone = COALESCE($5, phone),
        employment_type = COALESCE($6, employment_type),
        status = COALESCE($7, status),
        branch_id = COALESCE($8, branch_id),
        department_id = COALESCE($9, department_id),
        designation_id = COALESCE($10, designation_id),
        team_id = COALESCE($11, team_id),
        manager_id = COALESCE($12, manager_id),
        shift_id = COALESCE($13, shift_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND organization_id = $2
      RETURNING id, employee_code, first_name, last_name, status, updated_at
    `;

    const params = [
      id, organizationId, data.first_name, data.last_name, data.phone,
      data.employment_type, data.status, data.branch_id, data.department_id,
      data.designation_id, data.team_id, data.manager_id, data.shift_id
    ];

    const res = await query(text, params);
    return res.rows[0] || null;
  }

  static async setStatus(id: string, organizationId: string, status: string) {
    const text = `
      UPDATE employees
      SET status = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND organization_id = $2
      RETURNING id, employee_code, status, updated_at
    `;
    const res = await query(text, [id, organizationId, status]);
    return res.rows[0] || null;
  }

  static async getOrgChart(organizationId: string) {
    const text = `
      SELECT 
        e.id,
        e.employee_code,
        e.first_name,
        e.last_name,
        des.name as designation_name,
        d.name as department_name,
        e.manager_id
      FROM employees e
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.organization_id = $1 AND e.status = 'ACTIVE'
      ORDER BY e.manager_id NULLS FIRST, e.first_name ASC
    `;
    const res = await query(text, [organizationId]);
    return res.rows;
  }
}
