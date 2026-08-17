import { query } from '../db';

export class TimesheetRepository {
  static async findProjects(organizationId: string) {
    const res = await query('SELECT id, name, code, description, status FROM projects WHERE organization_id = $1 ORDER BY name ASC', [organizationId]);
    return res.rows;
  }

  static async create(organizationId: string, employeeId: string, data: { projectId: string; date: string; hours: number; description: string }) {
    const text = `
      INSERT INTO timesheets (organization_id, employee_id, project_id, date, hours, description, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'SUBMITTED')
      RETURNING id, employee_id, project_id, date, hours, description, status, created_at
    `;
    const res = await query(text, [organizationId, employeeId, data.projectId, data.date, data.hours, data.description]);
    return res.rows[0];
  }

  static async findByEmployee(organizationId: string, employeeId: string) {
    const text = `
      SELECT t.id, t.date, t.hours, t.description, t.status, p.name as project_name, p.code as project_code
      FROM timesheets t
      INNER JOIN projects p ON t.project_id = p.id
      WHERE t.organization_id = $1 AND t.employee_id = $2
      ORDER BY t.date DESC
    `;
    const res = await query(text, [organizationId, employeeId]);
    return res.rows;
  }

  static async findAll(organizationId: string, filters: { page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 500;
    const offset = (page - 1) * limit;

    const countRes = await query<{ total: number }>('SELECT COUNT(*)::int as total FROM timesheets WHERE organization_id = $1', [organizationId]);

    const dataSql = `
      SELECT 
        t.id, t.date, t.hours, t.description, t.status,
        p.name as project_name,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name, e.employee_code
      FROM timesheets t
      INNER JOIN projects p ON t.project_id = p.id
      INNER JOIN employees e ON t.employee_id = e.id
      WHERE t.organization_id = $1
      ORDER BY t.date DESC
      LIMIT $2 OFFSET $3
    `;

    const dataRes = await query(dataSql, [organizationId, limit, offset]);

    return {
      timesheets: dataRes.rows,
      pagination: { total: countRes.rows[0].total, page, limit, totalPages: Math.ceil(countRes.rows[0].total / limit) }
    };
  }
}
