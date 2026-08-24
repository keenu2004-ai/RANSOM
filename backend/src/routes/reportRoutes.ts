import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../types';
import { StorageService } from '../services/storageService';
import { TimesheetRepository } from '../repositories/timesheetRepository';
import { generateWeeklyPlanXlsx } from '../services/excelService';

const router = Router();
router.use(authenticate);

// Workforce Summary Report
router.get('/workforce', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

// CSV Workforce Export
router.get('/export-csv', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

// 1. Archive Weekly Plan XLSX
router.post('/archives/weekly-plan', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const { startDate, endDate } = req.body;

    const todayStr = new Date().toISOString().split('T')[0];
    const sDate = startDate || todayStr;
    const eDate = endDate || todayStr;

    const tasks = await TimesheetRepository.findTasks(organizationId, req.user!.userId, req.user!.role, req.user!.employeeId || null, { startDate: sDate, endDate: eDate });
    const pendingTasks = await TimesheetRepository.findPendingCarryForward(organizationId, req.user!.userId, req.user!.role, req.user!.employeeId || null, sDate);

    const userContext = {
      email: req.user!.email,
      role: req.user!.role,
      organizationId
    };

    const buffer = await generateWeeklyPlanXlsx(tasks, pendingTasks, userContext, sDate, eDate);

    const dateObj = new Date(sDate);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;

    const orgRes = await query('SELECT code FROM organizations WHERE id = $1', [organizationId]);
    const orgCode = orgRes.rows[0]?.code || 'default';
    const timestamp = Date.now();

    const objectPath = `organizations/${orgCode}/weekly-plans/${year}/${month}/weekly_plan_${year}_${month}_${timestamp}.xlsx`;
    await StorageService.uploadBuffer(objectPath, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const uRes = await query('SELECT display_name, email FROM users WHERE id = $1', [req.user!.userId]);
    const userName = uRes.rows[0]?.display_name || req.user!.email;

    const archiveRes = await query(`
      INSERT INTO report_archives (
        organization_id, report_name, report_type, period_year, period_month,
        object_path, file_size, generated_by, generated_by_name
      ) VALUES ($1, $2, 'WEEKLY_PLAN', $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      organizationId,
      `Weekly Plan & Field Visit Export (${sDate} to ${eDate})`,
      year,
      month,
      objectPath,
      buffer.length,
      req.user!.userId,
      userName
    ]);

    return res.status(201).json({
      success: true,
      data: { archive: archiveRes.rows[0], message: 'Weekly plan archived successfully.' }
    });
  } catch (error) {
    return next(error);
  }
});

// 2. Archive Monthly Report XLSX
router.post('/archives/monthly-report', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const { year, month } = req.body;

    const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const currentMonth = month ? parseInt(month, 10) : new Date().getMonth() + 1;

    const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const tasks = await TimesheetRepository.findTasks(organizationId, req.user!.userId, req.user!.role, req.user!.employeeId || null, { startDate, endDate });
    const pendingTasks = await TimesheetRepository.findPendingCarryForward(organizationId, req.user!.userId, req.user!.role, req.user!.employeeId || null, startDate);

    const userContext = {
      email: req.user!.email,
      role: req.user!.role,
      organizationId
    };

    const buffer = await generateWeeklyPlanXlsx(tasks, pendingTasks, userContext, startDate, endDate);

    const orgRes = await query('SELECT code FROM organizations WHERE id = $1', [organizationId]);
    const orgCode = orgRes.rows[0]?.code || 'default';
    const timestamp = Date.now();

    const objectPath = `organizations/${orgCode}/reports/${currentYear}/${currentMonth}/monthly_report_${currentYear}_${currentMonth}_${timestamp}.xlsx`;
    await StorageService.uploadBuffer(objectPath, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const uRes = await query('SELECT display_name, email FROM users WHERE id = $1', [req.user!.userId]);
    const userName = uRes.rows[0]?.display_name || req.user!.email;

    const monthName = new Date(currentYear, currentMonth - 1, 1).toLocaleDateString('en-US', { month: 'long' });

    const archiveRes = await query(`
      INSERT INTO report_archives (
        organization_id, report_name, report_type, period_year, period_month,
        object_path, file_size, generated_by, generated_by_name
      ) VALUES ($1, $2, 'MONTHLY_REPORT', $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      organizationId,
      `Monthly Enterprise HRMS Report (${monthName} ${currentYear})`,
      currentYear,
      currentMonth,
      objectPath,
      buffer.length,
      req.user!.userId,
      userName
    ]);

    return res.status(201).json({
      success: true,
      data: { archive: archiveRes.rows[0], message: 'Monthly report archived successfully.' }
    });
  } catch (error) {
    return next(error);
  }
});

// 3. List Archived Reports
router.get('/archives', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const { reportType } = req.query;

    let sql = `
      SELECT id, report_name, report_type, period_year, period_month, object_path, file_size, mime_type, generated_by, generated_by_name, created_at
      FROM report_archives
      WHERE organization_id = $1
    `;
    const params: any[] = [organizationId];

    if (reportType) {
      params.push(reportType);
      sql += ` AND report_type = $2`;
    }

    sql += ` ORDER BY created_at DESC LIMIT 100`;

    const resArchives = await query(sql, params);
    return res.status(200).json({ success: true, data: { archives: resArchives.rows } });
  } catch (error) {
    return next(error);
  }
});

// 4. Download Archived Report
router.get('/archives/:id/download', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const { id } = req.params;

    const archiveRes = await query('SELECT * FROM report_archives WHERE id = $1 AND organization_id = $2', [id, organizationId]);
    if (archiveRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Archived report not found.', code: 'NOT_FOUND' });
    }

    const archive = archiveRes.rows[0];
    const downloadUrl = await StorageService.getSignedDownloadUrl(archive.object_path, `${archive.report_type.toLowerCase()}_${archive.period_year}_${archive.period_month}.xlsx`);

    return res.status(200).json({
      success: true,
      data: { downloadUrl, archive }
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
