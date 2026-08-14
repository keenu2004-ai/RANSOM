import { query } from '../db';

export class HolidayRepository {
  static async findAll(organizationId: string, year?: number) {
    const targetYear = year || new Date().getFullYear();
    const text = `
      SELECT id, organization_id, branch_id, title, date, holiday_type, description, created_at
      FROM holidays
      WHERE organization_id = $1 AND EXTRACT(YEAR FROM date) = $2
      ORDER BY date ASC
    `;
    const res = await query(text, [organizationId, targetYear]);
    return res.rows;
  }

  static async create(organizationId: string, data: { title: string; date: string; holidayType?: string; description?: string; branchId?: string }) {
    const text = `
      INSERT INTO holidays (organization_id, branch_id, title, date, holiday_type, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, title, date, holiday_type, description, created_at
    `;
    const res = await query(text, [
      organizationId, data.branchId || null, data.title, data.date, data.holidayType || 'COMPANY', data.description || null
    ]);
    return res.rows[0];
  }

  static async delete(id: string, organizationId: string) {
    const text = `DELETE FROM holidays WHERE id = $1 AND organization_id = $2 RETURNING id`;
    const res = await query(text, [id, organizationId]);
    return res.rows[0] || null;
  }
}
