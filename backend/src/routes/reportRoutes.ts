import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'));

router.get('/workforce', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT 
        d.name as department,
        COUNT(e.id)::int as total_employees,
        COUNT(CASE WHEN e.employment_type = 'FULL_TIME' THEN 1 END)::int as full_time,
        COUNT(CASE WHEN e.employment_type = 'CONTRACT' THEN 1 END)::int as contract
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.organization_id = $1 AND e.status = 'ACTIVE'
      GROUP BY d.name
    `, [req.user!.organizationId]);
    return res.status(200).json({ success: true, data: { report: result.rows } });
  } catch (error) {
    return next(error);
  }
});

router.get('/export-csv', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT e.employee_code, e.first_name, e.last_name, e.email, d.name as department, des.name as designation, e.status
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE e.organization_id = $1
      ORDER BY e.employee_code ASC
    `, [req.user!.organizationId]);

    let csv = 'Employee Code,First Name,Last Name,Email,Department,Designation,Status\n';
    result.rows.forEach(r => {
      csv += `"${r.employee_code}","${r.first_name}","${r.last_name}","${r.email}","${r.department || ''}","${r.designation || ''}","${r.status}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=employees_report.csv');
    return res.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
});

export default router;
