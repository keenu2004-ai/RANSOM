import { query } from '../db';

export class PayrollRepository {
  static async findSalaryStructures(organizationId: string) {
    const text = `
      SELECT 
        ss.id, ss.employee_id, ss.basic_pay, ss.hra, ss.special_allowance,
        ss.pf_deduction, ss.esi_deduction, ss.professional_tax, ss.tds,
        ss.gross_salary, ss.net_salary,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name, e.employee_code
      FROM salary_structures ss
      INNER JOIN employees e ON ss.employee_id = e.id
      WHERE ss.organization_id = $1
      ORDER BY e.first_name ASC
    `;
    const res = await query(text, [organizationId]);
    return res.rows;
  }

  static async findPayrollRecords(organizationId: string, month?: number, year?: number) {
    let whereClause = `WHERE pr.organization_id = $1`;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (month) {
      whereClause += ` AND pr.pay_period_month = $${paramIndex}`;
      params.push(month);
      paramIndex++;
    }
    if (year) {
      whereClause += ` AND pr.pay_period_year = $${paramIndex}`;
      params.push(year);
      paramIndex++;
    }

    const text = `
      SELECT 
        pr.id, pr.employee_id, pr.pay_period_month, pr.pay_period_year,
        pr.basic_pay, pr.hra, pr.allowances, pr.deductions, pr.gross_salary, pr.net_salary,
        pr.status, pr.payment_date,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name, e.employee_code
      FROM payroll_records pr
      INNER JOIN employees e ON pr.employee_id = e.id
      ${whereClause}
      ORDER BY pr.pay_period_year DESC, pr.pay_period_month DESC
    `;
    const res = await query(text, params);
    return res.rows;
  }

  static async findMyPayslips(organizationId: string, employeeId: string) {
    const text = `
      SELECT id, pay_period_month, pay_period_year, basic_pay, hra, allowances, deductions, gross_salary, net_salary, status, payment_date
      FROM payroll_records
      WHERE organization_id = $1 AND employee_id = $2
      ORDER BY pay_period_year DESC, pay_period_month DESC
    `;
    const res = await query(text, [organizationId, employeeId]);
    return res.rows;
  }
}
