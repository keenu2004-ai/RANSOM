import { query, withTransaction } from '../db';
import { StorageService } from '../services/storageService';

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

  static async findById(id: string, organizationId: string, client?: any) {
    const db = client || { query };
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
      WHERE e.id = $1 AND e.organization_id = $2
    `;
    const res = await db.query(text, [id, organizationId]);
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

      // Assign requested system role (default: EMPLOYEE)
      const requestedRole = (data.system_role && data.system_role.trim().toUpperCase()) || 'EMPLOYEE';
      let roleRes = await client.query('SELECT id FROM roles WHERE (organization_id = $1 OR is_system_role = TRUE) AND name = $2 ORDER BY is_system_role DESC LIMIT 1', [data.organization_id, requestedRole]);
      if (roleRes.rows.length === 0) {
        roleRes = await client.query(`
          INSERT INTO roles (organization_id, name, description, is_system_role)
          VALUES ($1, $2, $3, TRUE)
          ON CONFLICT (name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `, [data.organization_id, requestedRole, `System role ${requestedRole}`]);
      }

      await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
      await client.query(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, role_id) DO NOTHING
      `, [userId, roleRes.rows[0].id]);

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
          branch_id, department_id, designation_id, team_id, manager_id,
          pan_number, aadhaar_number, bank_account_number, bank_ifsc
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        ) RETURNING id, employee_code, first_name, last_name, email, status, created_at
      `;

      const params = [
        data.organization_id, userId, empCode, data.first_name, data.last_name, data.email,
        data.phone || null, data.date_of_birth || null, data.gender || null, data.joining_date || new Date(),
        data.employment_type || 'FULL_TIME', data.status || 'ACTIVE',
        data.branch_id || null, data.department_id || null, data.designation_id || null,
        data.team_id || null, data.manager_id || null,
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
    return withTransaction(async (client) => {
      // 1. Check existing employee
      const empRes = await client.query(
        `SELECT id, user_id, email, first_name, last_name FROM employees WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [id, organizationId]
      );
      if (empRes.rows.length === 0) return null;
      const emp = empRes.rows[0];

      // 2. Email duplicate check if email is changed
      const newEmail = data.email ? data.email.trim().toLowerCase() : null;
      if (newEmail && newEmail !== emp.email.toLowerCase()) {
        const dupCheck = await client.query(
          `SELECT id FROM employees WHERE organization_id = $1 AND LOWER(email) = $2 AND id != $3`,
          [organizationId, newEmail, id]
        );
        if (dupCheck.rows.length > 0) {
          const err: any = new Error(`Work email "${newEmail}" is already in use by another employee.`);
          err.statusCode = 400;
          err.code = 'DUPLICATE_EMAIL';
          throw err;
        }

        // Also check users table
        const userDupCheck = await client.query(
          `SELECT id FROM users WHERE LOWER(email) = $2 AND id != $3`,
          [organizationId, newEmail, emp.user_id || '00000000-0000-0000-0000-000000000000']
        );
        if (userDupCheck.rows.length > 0) {
          const err: any = new Error(`Email "${newEmail}" is already in use by another user account.`);
          err.statusCode = 400;
          err.code = 'DUPLICATE_EMAIL';
          throw err;
        }

        // Update linked user email if present
        if (emp.user_id) {
          await client.query(
            `UPDATE users SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [newEmail, emp.user_id]
          );
        }
      }

      // 3. Update employee fields
      await client.query(
        `UPDATE employees SET
          first_name = COALESCE($3, first_name),
          last_name = COALESCE($4, last_name),
          email = COALESCE($5, email),
          phone = COALESCE($6, phone),
          employment_type = COALESCE($7, employment_type),
          status = COALESCE($8, status),
          branch_id = $9,
          department_id = $10,
          designation_id = $11,
          team_id = $12,
          manager_id = $13,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND organization_id = $2`,
        [
          id,
          organizationId,
          data.first_name || null,
          data.last_name || null,
          newEmail || null,
          data.phone || null,
          data.employment_type || null,
          data.status || null,
          data.branch_id || null,
          data.department_id || null,
          data.designation_id || null,
          data.team_id || null,
          data.manager_id || null
        ]
      );

      return await this.findById(id, organizationId, client);
    });
  }

  static async setStatus(id: string, organizationId: string, status: string, actorUserId?: string) {
    return withTransaction(async (client) => {
      if (status === 'INACTIVE') {
        // Asset safety guard: Block deactivation if employee has active assigned assets
        const assetCheck = await client.query(`
          SELECT COUNT(*)::int as count FROM assets 
          WHERE assigned_employee_id = $1 AND organization_id = $2 AND status = 'ASSIGNED'
        `, [id, organizationId]);
        const activeAssetsCount = assetCheck.rows[0]?.count || 0;
        if (activeAssetsCount > 0) {
          const err: any = new Error(`Employee has ${activeAssetsCount} assigned asset(s). Return/reassign assets before deactivation.`);
          err.statusCode = 400;
          err.code = 'ACTIVE_ASSETS_ASSIGNED';
          throw err;
        }
      }

      // Lock employee row
      const empLockRes = await client.query(`
        SELECT id, user_id, employee_code, first_name, last_name, status
        FROM employees
        WHERE id = $1 AND organization_id = $2
        FOR UPDATE
      `, [id, organizationId]);

      if (empLockRes.rows.length === 0) return null;
      const emp = empLockRes.rows[0];

      // Update employee status
      const updateEmpRes = await client.query(`
        UPDATE employees
        SET status = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND organization_id = $2
        RETURNING id, user_id, employee_code, first_name, last_name, status, updated_at
      `, [id, organizationId, status]);

      const updatedEmp = updateEmpRes.rows[0];

      // Synchronize linked user account status in the SAME transaction
      if (emp.user_id) {
        await client.query(`
          UPDATE users
          SET status = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND organization_id = $3
        `, [emp.user_id, status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE', organizationId]);
      }

      // Write audit log in the SAME transaction
      const auditAction = status === 'INACTIVE' ? 'EMPLOYEE_DEACTIVATED' : 'EMPLOYEE_RESTORED';
      await client.query(`
        INSERT INTO audit_logs (organization_id, user_id, action, module, entity_name, entity_id, new_values)
        VALUES ($1, $2, $3, 'employees', 'Employee', $4, $5)
      `, [organizationId, actorUserId || '00000000-0000-0000-0000-000000000000', auditAction, id, JSON.stringify({ status, employeeCode: emp.employee_code })]);

      return updatedEmp;
    });
  }

  static async delete(id: string, organizationId: string, actorUserId?: string): Promise<boolean> {
    // 1. Asset safety guard: Block physical deletion if employee has active assigned assets
    const assetCheck = await query(`
      SELECT COUNT(*)::int as count FROM assets 
      WHERE assigned_employee_id = $1 AND organization_id = $2 AND status = 'ASSIGNED'
    `, [id, organizationId]);
    const activeAssetsCount = assetCheck.rows[0]?.count || 0;
    if (activeAssetsCount > 0) {
      const err: any = new Error(`Employee has ${activeAssetsCount} assigned asset(s). Return/reassign assets before deletion.`);
      err.statusCode = 400;
      err.code = 'ACTIVE_ASSETS_ASSIGNED';
      throw err;
    }

    // 2. Fetch employee details to record snapshots and find linked user account
    const empRes = await query(`SELECT user_id, employee_code, first_name, last_name FROM employees WHERE id = $1 AND organization_id = $2`, [id, organizationId]);
    if (empRes.rows.length === 0) return false;

    const emp = empRes.rows[0];
    const fullName = `${emp.first_name} ${emp.last_name}`;

    // 3. Purge GCS files and attachment metadata for employee
    try {
      const orgRes = await query('SELECT code FROM organizations WHERE id = $1', [organizationId]);
      const orgCode = orgRes.rows[0]?.code || 'default';

      const attRes = await query('SELECT * FROM attachments WHERE organization_id = $1 AND employee_id = $2', [organizationId, id]);
      for (const att of attRes.rows) {
        await StorageService.deleteObject(att.storage_file_id, att.object_path);
      }
      await query('DELETE FROM attachments WHERE organization_id = $1 AND employee_id = $2', [organizationId, id]);

      // Purge GCS employee prefix
      const empPrefix = `organizations/${orgCode}/employees/${emp.employee_code}/`;
      await StorageService.purgePrefix(empPrefix);
    } catch (gcsErr) {
      console.warn('GCS employee file purge warning:', gcsErr);
    }

    // 4. Execute atomic database deletion in transaction
    return withTransaction(async (client) => {
      // Populate snapshots on historical tables before removing employee row
      await client.query(`UPDATE attendance SET employee_name_snapshot = $1, employee_code_snapshot = $2 WHERE employee_id = $3 AND employee_name_snapshot IS NULL`, [fullName, emp.employee_code, id]);
      await client.query(`UPDATE leave_requests SET employee_name_snapshot = $1, employee_code_snapshot = $2 WHERE employee_id = $3 AND employee_name_snapshot IS NULL`, [fullName, emp.employee_code, id]);
      await client.query(`UPDATE expenses SET employee_name_snapshot = $1, employee_code_snapshot = $2 WHERE employee_id = $3 AND employee_name_snapshot IS NULL`, [fullName, emp.employee_code, id]);
      await client.query(`UPDATE timesheets SET employee_name_snapshot = $1, employee_code_snapshot = $2 WHERE employee_id = $3 AND employee_name_snapshot IS NULL`, [fullName, emp.employee_code, id]);
      await client.query(`UPDATE trip_expenses SET employee_name_snapshot = $1, employee_code_snapshot = $2 WHERE employee_id = $3 AND employee_name_snapshot IS NULL`, [fullName, emp.employee_code, id]);
      await client.query(`UPDATE employee_leave_adjustments SET employee_name_snapshot = $1, employee_code_snapshot = $2 WHERE employee_id = $3 AND employee_name_snapshot IS NULL`, [fullName, emp.employee_code, id]);

      if (emp.user_id) {
        const userRes = await client.query(`SELECT email FROM users WHERE id = $1`, [emp.user_id]);
        if (userRes.rows.length > 0) {
          await client.query(`UPDATE audit_logs SET user_email_snapshot = $1, employee_name_snapshot = $2, employee_code_snapshot = $3 WHERE user_id = $4 AND user_email_snapshot IS NULL`, [userRes.rows[0].email, fullName, emp.employee_code, emp.user_id]);
        }
      }

      // Record audit log EMPLOYEE_PERMANENT_DELETION BEFORE physically removing user/employee
      await client.query(`
        INSERT INTO audit_logs (organization_id, user_id, action, module, entity_name, entity_id, new_values, user_email_snapshot, employee_name_snapshot, employee_code_snapshot)
        VALUES ($1, $2, 'EMPLOYEE_PERMANENT_DELETION', 'employees', 'Employee', $3, $4, NULL, $5, $6)
      `, [organizationId, actorUserId || null, id, JSON.stringify({ employeeCode: emp.employee_code, fullName }), fullName, emp.employee_code]);

      // Unlink user_id on employee before deletion, and delete linked user account if exists
      await client.query(`UPDATE employees SET user_id = NULL WHERE id = $1`, [id]);
      if (emp.user_id) {
        await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [emp.user_id]);
        await client.query(`DELETE FROM users WHERE id = $1 AND organization_id = $2`, [emp.user_id, organizationId]);
      }

      // Physically delete employee row (Historical attendance, leave, expenses, timesheets survive via ON DELETE SET NULL!)
      await client.query(`DELETE FROM employees WHERE id = $1 AND organization_id = $2`, [id, organizationId]);

      return true;
    });
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
