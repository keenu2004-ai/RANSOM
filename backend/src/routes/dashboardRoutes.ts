import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { authenticate } from '../middleware/authMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId;
    const role = req.user!.role;
    const todayStr = new Date().toISOString().split('T')[0];

    let summary: any = {};

    if (['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(role)) {
      const empCount = await query('SELECT COUNT(*)::int as count FROM employees WHERE organization_id = $1 AND status = \'ACTIVE\'', [organizationId]);
      const attCount = await query('SELECT COUNT(*)::int as count FROM attendance WHERE organization_id = $1 AND date = $2 AND status IN (\'PRESENT\', \'LATE\')', [organizationId, todayStr]);
      const leavePending = await query('SELECT COUNT(*)::int as count FROM leave_requests WHERE organization_id = $1 AND status = \'PENDING\'', [organizationId]);
      const expensePending = await query('SELECT COUNT(*)::int as count FROM expenses WHERE organization_id = $1 AND status = \'PENDING\'', [organizationId]);

      summary = {
        totalEmployees: empCount.rows[0].count,
        presentToday: attCount.rows[0].count,
        pendingLeaves: leavePending.rows[0].count,
        pendingExpenses: expensePending.rows[0].count
      };
    }

    let personal: any = null;
    if (employeeId) {
      const todayAtt = await query('SELECT check_in, check_out, status FROM attendance WHERE employee_id = $1 AND date = $2', [employeeId, todayStr]);
      const leaveBal = await query('SELECT SUM(available)::int as total_available FROM leave_balances WHERE employee_id = $1 AND year = $2', [employeeId, new Date().getFullYear()]);

      personal = {
        todayAttendance: todayAtt.rows[0] || null,
        availableLeaveDays: leaveBal.rows[0]?.total_available || 0
      };
    }

    // Upcoming Holidays
    const holidays = await query('SELECT title, date, holiday_type FROM holidays WHERE organization_id = $1 AND date >= CURRENT_DATE ORDER BY date ASC LIMIT 3', [organizationId]);

    // Recent Work Items
    const recentWork = await query(`
      SELECT t.id, t.description as title, p.name as category, t.date
      FROM timesheets t
      INNER JOIN projects p ON t.project_id = p.id
      WHERE t.organization_id = $1
      ORDER BY t.created_at DESC LIMIT 3
    `, [organizationId]);

    return res.status(200).json({
      success: true,
      data: {
        welcomeMessage: `Welcome back, ${req.user!.email}`,
        user: req.user,
        todayDate: todayStr,
        summary,
        personal,
        upcomingHolidays: holidays.rows,
        latestWork: recentWork.rows
      }
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
