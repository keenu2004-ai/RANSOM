import { query, withTransaction } from '../db';

export interface HolidayInput {
  title: string;
  date: string;
  holidayType?: string;
  description?: string;
  assignmentScope?: 'ALL' | 'REGION' | 'EMPLOYEES';
  region?: 'NORTH' | 'SOUTH' | null;
  employeeIds?: string[];
  branchId?: string;
}

export class HolidayRepository {
  static async findAll(organizationId: string, year?: number, actor?: { role?: string; employeeId?: string | null }) {
    const targetYear = year || new Date().getFullYear();
    const isManagement = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(actor?.role || '');

    if (!isManagement && actor?.employeeId) {
      // 1. Fetch employee's region and ID
      const empRes = await query(
        `SELECT id, region FROM employees WHERE id = $1 AND organization_id = $2`,
        [actor.employeeId, organizationId]
      );
      const empRegion = empRes.rows[0]?.region || null;

      // Employee sees ONLY applicable holidays (ALL, matching REGION, or assigned in holiday_employee_assignments)
      const text = `
        SELECT DISTINCT
          h.id, h.organization_id, h.branch_id, h.title,
          TO_CHAR(h.date, 'YYYY-MM-DD') AS date,
          h.holiday_type, h.description,
          COALESCE(h.assignment_scope, 'ALL') AS assignment_scope,
          h.region, h.created_at
        FROM holidays h
        LEFT JOIN holiday_employee_assignments hea ON h.id = hea.holiday_id
        WHERE h.organization_id = $1
          AND EXTRACT(YEAR FROM h.date) = $2
          AND (
            COALESCE(h.assignment_scope, 'ALL') = 'ALL'
            OR (h.assignment_scope = 'REGION' AND h.region IS NOT NULL AND h.region = $3)
            OR (h.assignment_scope = 'EMPLOYEES' AND hea.employee_id = $4)
          )
        ORDER BY date ASC
      `;
      const res = await query(text, [organizationId, targetYear, empRegion, actor.employeeId]);
      return res.rows;
    }

    // Administrators / HR Managers see ALL holidays with assigned employee metadata
    const text = `
      SELECT
        h.id, h.organization_id, h.branch_id, h.title,
        TO_CHAR(h.date, 'YYYY-MM-DD') AS date,
        h.holiday_type, h.description,
        COALESCE(h.assignment_scope, 'ALL') AS assignment_scope,
        h.region, h.created_at,
        COALESCE(COUNT(hea.employee_id), 0)::int AS assigned_employee_count,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', emp.id,
              'first_name', emp.first_name,
              'last_name', emp.last_name,
              'employee_code', emp.employee_code,
              'region', emp.region
            )
          ) FILTER (WHERE emp.id IS NOT NULL),
          '[]'::json
        ) AS assigned_employees
      FROM holidays h
      LEFT JOIN holiday_employee_assignments hea ON h.id = hea.holiday_id
      LEFT JOIN employees emp ON hea.employee_id = emp.id
      WHERE h.organization_id = $1 AND EXTRACT(YEAR FROM h.date) = $2
      GROUP BY h.id
      ORDER BY date ASC
    `;
    const res = await query(text, [organizationId, targetYear]);
    return res.rows;
  }

  static async findById(id: string, organizationId: string) {
    const text = `
      SELECT
        h.id, h.organization_id, h.branch_id, h.title,
        TO_CHAR(h.date, 'YYYY-MM-DD') AS date,
        h.holiday_type, h.description,
        COALESCE(h.assignment_scope, 'ALL') AS assignment_scope,
        h.region, h.created_at,
        COALESCE(COUNT(hea.employee_id), 0)::int AS assigned_employee_count,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', emp.id,
              'first_name', emp.first_name,
              'last_name', emp.last_name,
              'employee_code', emp.employee_code,
              'region', emp.region
            )
          ) FILTER (WHERE emp.id IS NOT NULL),
          '[]'::json
        ) AS assigned_employees
      FROM holidays h
      LEFT JOIN holiday_employee_assignments hea ON h.id = hea.holiday_id
      LEFT JOIN employees emp ON hea.employee_id = emp.id
      WHERE h.id = $1 AND h.organization_id = $2
      GROUP BY h.id
    `;
    const res = await query(text, [id, organizationId]);
    return res.rows[0] || null;
  }

  static async create(organizationId: string, data: HolidayInput) {
    const scope = data.assignmentScope || 'ALL';
    let regionVal: string | null = null;
    let targetEmpIds: string[] = [];

    if (scope === 'ALL') {
      regionVal = null;
      targetEmpIds = [];
    } else if (scope === 'REGION') {
      if (!data.region || !['NORTH', 'SOUTH'].includes(data.region)) {
        throw new Error('Region is required and must be either NORTH or SOUTH when assignment scope is Entire Region.');
      }
      regionVal = data.region;
      targetEmpIds = [];
    } else if (scope === 'EMPLOYEES') {
      regionVal = null;
      targetEmpIds = Array.isArray(data.employeeIds) ? Array.from(new Set(data.employeeIds.filter(id => !!id))) : [];
      if (targetEmpIds.length === 0) {
        throw new Error('At least one employee must be selected when assignment scope is Specific Employees.');
      }
    }

    return withTransaction(async (client) => {
      // 1. Insert Holiday record
      const text = `
        INSERT INTO holidays (organization_id, branch_id, title, date, holiday_type, description, assignment_scope, region)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, title, date, holiday_type, description, assignment_scope, region, created_at
      `;
      const res = await client.query(text, [
        organizationId,
        data.branchId || null,
        data.title.trim(),
        data.date,
        data.holidayType || 'COMPANY',
        data.description ? data.description.trim() : null,
        scope,
        regionVal
      ]);
      const holiday = res.rows[0];

      // 2. Insert Employee Assignments if EMPLOYEES scope
      if (scope === 'EMPLOYEES' && targetEmpIds.length > 0) {
        // Validate all employee IDs belong to same organization
        const empCheck = await client.query(
          `SELECT id FROM employees WHERE organization_id = $1 AND id = ANY($2::uuid[])`,
          [organizationId, targetEmpIds]
        );
        if (empCheck.rows.length !== targetEmpIds.length) {
          throw new Error('One or more selected employee IDs are invalid or belong to another organization.');
        }

        for (const empId of targetEmpIds) {
          await client.query(
            `INSERT INTO holiday_employee_assignments (organization_id, holiday_id, employee_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [organizationId, holiday.id, empId]
          );
        }
      }

      return this.findById(holiday.id, organizationId);
    });
  }

  static async update(id: string, organizationId: string, data: Partial<HolidayInput>) {
    return withTransaction(async (client) => {
      const existing = await client.query(
        `SELECT * FROM holidays WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [id, organizationId]
      );
      if (existing.rows.length === 0) {
        throw new Error('Holiday not found.');
      }
      const prev = existing.rows[0];

      const scope = data.assignmentScope || prev.assignment_scope || 'ALL';
      let regionVal: string | null = null;
      let targetEmpIds: string[] = [];

      if (scope === 'ALL') {
        regionVal = null;
        targetEmpIds = [];
      } else if (scope === 'REGION') {
        const reg = data.region !== undefined ? data.region : prev.region;
        if (!reg || !['NORTH', 'SOUTH'].includes(reg)) {
          throw new Error('Region is required and must be either NORTH or SOUTH when assignment scope is Entire Region.');
        }
        regionVal = reg;
        targetEmpIds = [];
      } else if (scope === 'EMPLOYEES') {
        regionVal = null;
        targetEmpIds = Array.isArray(data.employeeIds) ? Array.from(new Set(data.employeeIds.filter(eId => !!eId))) : [];
        if (targetEmpIds.length === 0) {
          throw new Error('At least one employee must be selected when assignment scope is Specific Employees.');
        }
      }

      // Update Holiday Metadata
      await client.query(`
        UPDATE holidays SET
          title = COALESCE($1, title),
          date = COALESCE($2, date),
          holiday_type = COALESCE($3, holiday_type),
          description = COALESCE($4, description),
          assignment_scope = $5,
          region = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7 AND organization_id = $8
      `, [
        data.title ? data.title.trim() : null,
        data.date || null,
        data.holidayType || null,
        data.description !== undefined ? (data.description ? data.description.trim() : null) : null,
        scope,
        regionVal,
        id,
        organizationId
      ]);

      // Synchronize employee assignments
      await client.query(`DELETE FROM holiday_employee_assignments WHERE holiday_id = $1`, [id]);

      if (scope === 'EMPLOYEES' && targetEmpIds.length > 0) {
        const empCheck = await client.query(
          `SELECT id FROM employees WHERE organization_id = $1 AND id = ANY($2::uuid[])`,
          [organizationId, targetEmpIds]
        );
        if (empCheck.rows.length !== targetEmpIds.length) {
          throw new Error('One or more selected employee IDs are invalid or belong to another organization.');
        }

        for (const empId of targetEmpIds) {
          await client.query(
            `INSERT INTO holiday_employee_assignments (organization_id, holiday_id, employee_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [organizationId, id, empId]
          );
        }
      }

      return this.findById(id, organizationId);
    });
  }

  static async delete(id: string, organizationId: string) {
    const text = `DELETE FROM holidays WHERE id = $1 AND organization_id = $2 RETURNING id`;
    const res = await query(text, [id, organizationId]);
    return res.rows[0] || null;
  }
}
