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
    const period = (req.query.period as string) || 'This Week';

    // Launch all independent queries concurrently
    const empCountPromise = query(
      `SELECT COUNT(*)::int as count FROM employees WHERE organization_id = $1 AND status = 'ACTIVE'`,
      [organizationId]
    );

    const attCountPromise = query(
      `SELECT COUNT(DISTINCT employee_id)::int as count 
       FROM attendance 
       WHERE organization_id = $1 AND date = $2 AND status IN ('PRESENT', 'LATE')`,
      [organizationId, todayStr]
    );

    const onLeavePromise = query(
      `SELECT COUNT(DISTINCT employee_id)::int as count 
       FROM leave_requests 
       WHERE organization_id = $1 AND status = 'APPROVED' AND $2::date BETWEEN start_date AND end_date`,
      [organizationId, todayStr]
    );

    const leavePendingPromise = query(
      `SELECT COUNT(*)::int as count FROM leave_requests WHERE organization_id = $1 AND status = 'PENDING'`,
      [organizationId]
    );

    const expensePendingPromise = query(
      `SELECT COUNT(*)::int as count FROM expenses WHERE organization_id = $1 AND status = 'PENDING'`,
      [organizationId]
    );

    const tasksPendingPromise = query(
      `SELECT COUNT(*)::int as count FROM timesheets WHERE organization_id = $1 AND status IN ('PLANNED', 'IN_PROGRESS', 'PENDING', 'DRAFT') AND deleted_at IS NULL`,
      [organizationId]
    );

    const deptPromise = query(
      `SELECT COALESCE(NULLIF(TRIM(d.name), ''), 'Unassigned') as name, COUNT(*)::int as count
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.organization_id = $1 AND e.status = 'ACTIVE'
       GROUP BY 1
       ORDER BY count DESC`,
      [organizationId]
    );

    // Date calculations for Weekly Attendance Trend
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (period === 'Last Week') {
      const dayOfWeek = now.getDay() || 7;
      startDate.setDate(now.getDate() - dayOfWeek - 6);
      endDate.setDate(now.getDate() - dayOfWeek);
    } else if (period === 'This Month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
      const dayOfWeek = now.getDay() || 7;
      startDate.setDate(now.getDate() - dayOfWeek + 1);
      endDate.setDate(startDate.getDate() + 6);
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const weeklyAttPromise = query(
      `SELECT date, COUNT(DISTINCT employee_id)::int as present_count 
       FROM attendance 
       WHERE organization_id = $1 AND date BETWEEN $2 AND $3 AND status IN ('PRESENT', 'LATE') 
       GROUP BY date 
       ORDER BY date ASC`,
      [organizationId, startStr, endStr]
    );

    const auditPromise = query(
      `SELECT a.id, a.action, a.module, a.entity_name, a.entity_id, a.created_at, 
              a.employee_name_snapshot, a.user_email_snapshot, u.display_name, u.email 
       FROM audit_logs a 
       LEFT JOIN users u ON a.user_id = u.id 
       WHERE a.organization_id = $1 
       ORDER BY a.created_at DESC 
       LIMIT 6`,
      [organizationId]
    );

    let leaveQuery = `
      SELECT
        lr.id,
        COALESCE(lt.name, 'Leave') AS leave_type,
        lr.start_date,
        lr.end_date,
        lr.total_days AS days_count,
        lr.status,
        lr.created_at,
        COALESCE(
          NULLIF(TRIM(CONCAT(e.first_name, ' ', e.last_name)), ''),
          lr.employee_name_snapshot,
          'Employee'
        ) AS employee_name
      FROM leave_requests lr
      LEFT JOIN employees e ON e.id = lr.employee_id
      LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.organization_id = $1
    `;
    const leaveQueryParams: any[] = [organizationId];

    if (!['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(role) && employeeId) {
      leaveQuery += ` AND lr.employee_id = $2`;
      leaveQueryParams.push(employeeId);
    }
    leaveQuery += ` ORDER BY lr.created_at DESC LIMIT 5`;

    const recentLeavesPromise = query(leaveQuery, leaveQueryParams);

    let todayAttPromise = Promise.resolve<any>({ rows: [] });
    let leaveBalPromise = Promise.resolve<any>({ rows: [] });
    if (employeeId) {
      todayAttPromise = query('SELECT check_in, check_out, status FROM attendance WHERE employee_id = $1 AND date = $2', [employeeId, todayStr]);
      leaveBalPromise = query('SELECT SUM(available)::int as total_available FROM leave_balances WHERE employee_id = $1 AND year = $2', [employeeId, new Date().getFullYear()]);
    }

    const holidaysPromise = query('SELECT title, date, holiday_type FROM holidays WHERE organization_id = $1 AND date >= CURRENT_DATE ORDER BY date ASC LIMIT 3', [organizationId]);

    // Await all concurrently
    const [
      empCountRes, attCountRes, onLeaveRes, leavePendingRes, expensePendingRes, tasksPendingRes,
      deptRes, weeklyAttRes, auditRes, recentLeavesRes, todayAtt, leaveBal, holidays
    ] = await Promise.all([
      empCountPromise, attCountPromise, onLeavePromise, leavePendingPromise, expensePendingPromise, tasksPendingPromise,
      deptPromise, weeklyAttPromise, auditPromise, recentLeavesPromise, todayAttPromise, leaveBalPromise, holidaysPromise
    ]);

    const totalEmployees = empCountRes.rows[0]?.count || 0;
    const presentToday = attCountRes.rows[0]?.count || 0;
    const onLeaveToday = onLeaveRes.rows[0]?.count || 0;
    const pendingLeaves = leavePendingRes.rows[0]?.count || 0;
    const pendingExpenses = expensePendingRes.rows[0]?.count || 0;
    const pendingTasks = tasksPendingRes.rows[0]?.count || 0;

    const summary = {
      totalEmployees,
      presentToday,
      onLeaveToday,
      pendingLeaves,
      pendingExpenses,
      pendingTasks,
      totalPendingItems: pendingLeaves + pendingExpenses + pendingTasks
    };

    const deptColors = ['#06B6D4', '#3B82F6', '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];
    const departments = deptRes.rows.map((d: any, idx: number) => ({
      name: d.name,
      count: d.count,
      percentage: totalEmployees > 0 ? Math.round((d.count / totalEmployees) * 100) : 0,
      color: deptColors[idx % deptColors.length]
    }));

    const attMap = new Map<string, number>();
    weeklyAttRes.rows.forEach((r: any) => {
      const dStr = typeof r.date === 'string' ? r.date.split('T')[0] : r.date.toISOString().split('T')[0];
      attMap.set(dStr, r.present_count);
    });

    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeklyPoints: Array<{ day: string; date: string; presentCount: number; pct: number }> = [];

    const curr = new Date(startDate);
    for (let i = 0; i < 7; i++) {
      const dStr = curr.toISOString().split('T')[0];
      const count = attMap.get(dStr) || 0;
      const pct = totalEmployees > 0 ? Math.min(100, Math.round((count / totalEmployees) * 100)) : 0;
      weeklyPoints.push({
        day: daysOfWeek[i] || curr.toLocaleDateString('en-US', { weekday: 'short' }),
        date: dStr,
        presentCount: count,
        pct
      });
      curr.setDate(curr.getDate() + 1);
    }

    const recentActivities = auditRes.rows.map((row: any) => ({
      id: row.id,
      action: row.action,
      module: row.module,
      entityName: row.entity_name,
      userName: row.employee_name_snapshot || row.display_name || (row.email ? row.email.split('@')[0] : (row.user_email_snapshot ? row.user_email_snapshot.split('@')[0] : 'System')),
      createdAt: row.created_at
    }));

    const recentLeaveRequests = recentLeavesRes.rows.map((r: any) => ({
      id: r.id,
      employeeName: r.employee_name || 'Employee',
      leaveType: r.leave_type,
      startDate: r.start_date,
      endDate: r.end_date,
      daysCount: Number(r.days_count || 0),
      status: r.status,
      createdAt: r.created_at
    }));

    let personal: any = null;
    if (employeeId) {
      personal = {
        todayAttendance: todayAtt.rows[0] || null,
        availableLeaveDays: leaveBal.rows[0]?.total_available || 0
      };
    }

    return res.status(200).json({
      success: true,
      data: {
        welcomeMessage: `Welcome back, ${req.user!.email}`,
        user: req.user,
        todayDate: todayStr,
        summary,
        personal,
        departments,
        weeklyAttendance: {
          period,
          points: weeklyPoints
        },
        recentActivities,
        recentLeaveRequests,
        upcomingHolidays: holidays.rows
      }
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
