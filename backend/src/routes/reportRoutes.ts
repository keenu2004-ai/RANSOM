import { Router, Response, NextFunction } from 'express';
import { query, withTransaction } from '../db';
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
    const uploadRes = await StorageService.uploadBuffer(objectPath, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const uRes = await query('SELECT display_name, email FROM users WHERE id = $1', [req.user!.userId]);
    const userName = uRes.rows[0]?.display_name || req.user!.email;

    const archiveRes = await query(`
      INSERT INTO report_archives (
        organization_id, report_name, report_type, period_year, period_month,
        object_path, file_size, generated_by, generated_by_name,
        storage_provider, storage_file_id, storage_folder_id
      ) VALUES ($1, $2, 'WEEKLY_PLAN', $3, $4, $5, $6, $7, $8, 'GOOGLE_DRIVE', $9, $10)
      RETURNING *
    `, [
      organizationId,
      `Weekly Plan & Field Visit Export (${sDate} to ${eDate})`,
      year,
      month,
      objectPath,
      buffer.length,
      req.user!.userId,
      userName,
      uploadRes.storageFileId || null,
      uploadRes.storageFolderId || null
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
    const uploadRes = await StorageService.uploadBuffer(objectPath, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const uRes = await query('SELECT display_name, email FROM users WHERE id = $1', [req.user!.userId]);
    const userName = uRes.rows[0]?.display_name || req.user!.email;

    const monthName = new Date(currentYear, currentMonth - 1, 1).toLocaleDateString('en-US', { month: 'long' });

    const archiveRes = await query(`
      INSERT INTO report_archives (
        organization_id, report_name, report_type, period_year, period_month,
        object_path, file_size, generated_by, generated_by_name,
        storage_provider, storage_file_id, storage_folder_id
      ) VALUES ($1, $2, 'MONTHLY_REPORT', $3, $4, $5, $6, $7, $8, 'GOOGLE_DRIVE', $9, $10)
      RETURNING *
    `, [
      organizationId,
      `Monthly Enterprise HRMS Report (${monthName} ${currentYear})`,
      currentYear,
      currentMonth,
      objectPath,
      buffer.length,
      req.user!.userId,
      userName,
      uploadRes.storageFileId || null,
      uploadRes.storageFolderId || null
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
      SELECT id, report_name, report_type, period_year, period_month, object_path, file_size, mime_type, generated_by, generated_by_name, storage_provider, storage_file_id, created_at
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

    if (archive.storage_status === 'BROKEN' || !archive.storage_file_id) {
      return res.status(404).json({
        success: false,
        error: 'Archived file is unavailable in storage. Please regenerate this report.',
        code: 'FILE_UNAVAILABLE'
      });
    }

    const exists = await StorageService.verifyObjectExists(archive.storage_file_id, archive.object_path);
    if (!exists) {
      await query("UPDATE report_archives SET storage_status = 'BROKEN' WHERE id = $1", [archive.id]);
      return res.status(404).json({
        success: false,
        error: 'Archived file is unavailable in storage. Please regenerate this report.',
        code: 'FILE_UNAVAILABLE'
      });
    }

    const stream = await StorageService.downloadStream(archive.storage_file_id, archive.object_path);

    const safeReportName = (archive.report_name || 'Report').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filename = `${safeReportName}.xlsx`;

    res.setHeader('Content-Type', archive.mime_type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    if (archive.file_size) {
      res.setHeader('Content-Length', archive.file_size);
    }

    stream.pipe(res);
  } catch (error) {
    return next(error);
  }
});

// 5. Delete Archived Report (SUPER_ADMIN ONLY)
router.delete('/archives/:id', requireRole('SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const { id } = req.params;

    // First verify existence and tenant isolation before entering transaction
    // If record exists under ANOTHER organization, return 403 (do not reveal cross-tenant existence)
    const existsAnyOrg = await query('SELECT id, organization_id FROM report_archives WHERE id = $1', [id]);
    if (existsAnyOrg.rows.length > 0 && existsAnyOrg.rows[0].organization_id !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this archived report.',
        code: 'FORBIDDEN'
      });
    }

    if (existsAnyOrg.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Archived report not found.',
        code: 'NOT_FOUND'
      });
    }

    let storageDeleted = false;
    let storageAlreadyMissing = false;
    let deletedArchive: any = null;

    await withTransaction(async (client) => {
      // Load report_archives row FOR UPDATE with organization_id check
      const archiveRes = await client.query(
        'SELECT * FROM report_archives WHERE id = $1 AND organization_id = $2 FOR UPDATE',
        [id, organizationId]
      );

      if (archiveRes.rows.length === 0) {
        throw { status: 404, message: 'Archived report not found.', code: 'NOT_FOUND' };
      }

      deletedArchive = archiveRes.rows[0];

      // Physical Google Drive cleanup
      const fileId = deletedArchive.storage_file_id;
      const objectPath = deletedArchive.object_path;

      if (fileId || objectPath) {
        const fileExists = await StorageService.verifyObjectExists(fileId, objectPath);
        if (fileExists) {
          const deleteSuccess = await StorageService.deleteObject(fileId, objectPath);
          if (!deleteSuccess) {
            throw { status: 500, message: 'Could not delete the archived file from storage. The archive was not deleted.', code: 'STORAGE_DELETE_FAILED' };
          }
          storageDeleted = true;
        } else {
          storageAlreadyMissing = true;
          storageDeleted = false;
        }
      } else {
        storageAlreadyMissing = true;
        storageDeleted = false;
      }

      // Delete database row
      await client.query('DELETE FROM report_archives WHERE id = $1 AND organization_id = $2', [id, organizationId]);

      // Audit Log: REPORT_ARCHIVE_DELETED
      const uRes = await client.query('SELECT display_name, email, role FROM users WHERE id = $1', [req.user!.userId]);
      const actorUser = uRes.rows[0] || {};
      const actorName = actorUser.display_name || req.user!.email || 'SUPER_ADMIN';

      const oldValues = {
        actor_user_id: req.user!.userId,
        actor_name: actorName,
        actor_role: req.user!.role,
        organization_id: organizationId,
        archive_id: deletedArchive.id,
        report_name: deletedArchive.report_name,
        report_type: deletedArchive.report_type,
        period: `${deletedArchive.period_year}-${String(deletedArchive.period_month || 1).padStart(2, '0')}`,
        storage_provider: deletedArchive.storage_provider,
        storage_file_id: deletedArchive.storage_file_id,
        file_size: deletedArchive.file_size,
        generated_by: deletedArchive.generated_by,
        generated_at: deletedArchive.created_at,
        deletion_timestamp: new Date().toISOString(),
        storage_deleted: storageDeleted,
        storage_already_missing: storageAlreadyMissing
      };

      const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'App';

      await client.query(`
        INSERT INTO audit_logs (
          organization_id, user_id, action, module, entity_name, entity_id, old_values, ip_address, user_agent
        ) VALUES ($1, $2, 'REPORT_ARCHIVE_DELETED', 'REPORTS', 'REPORT_ARCHIVE', $3, $4, $5, $6)
      `, [
        organizationId,
        req.user!.userId,
        id,
        JSON.stringify(oldValues),
        ipAddress,
        userAgent
      ]);
    });

    if (storageAlreadyMissing) {
      return res.status(200).json({
        success: true,
        message: 'Archived report metadata deleted; storage file was already unavailable.',
        archiveId: id,
        storageDeleted: false,
        storageAlreadyMissing: true
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Archived report deleted successfully.',
      archiveId: id,
      storageDeleted: true
    });
  } catch (error: any) {
    if (error && error.status) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        code: error.code || 'DELETE_FAILED'
      });
    }
    return next(error);
  }
});

export default router;
