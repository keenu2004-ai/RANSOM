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

    // 1. Summary KPIs
    // Total Active Employees
    const empCountRes = await query(
      `SELECT COUNT(*)::int as count FROM employees WHERE organization_id = $1 AND status = 'ACTIVE'`,
      [organizationId]
    );
    const totalEmployees = empCountRes.rows[0]?.count || 0;

    // Present Today (Unique active employees checked in today)
    const attCountRes = await query(
      `SELECT COUNT(DISTINCT employee_id)::int as count 
       FROM attendance 
       WHERE organization_id = $1 AND date = $2 AND status IN ('PRESENT', 'LATE')`,
      [organizationId, todayStr]
    );
    const presentToday = attCountRes.rows[0]?.count || 0;

    // On Leave Today (Employees with APPROVED leave covering today)
    const onLeaveRes = await query(
      `SELECT COUNT(DISTINCT employee_id)::int as count 
       FROM leave_requests 
       WHERE organization_id = $1 AND status = 'APPROVED' AND $2::date BETWEEN start_date AND end_date`,
      [organizationId, todayStr]
    );
    const onLeaveToday = onLeaveRes.rows[0]?.count || 0;

    // Pending Leaves Count
    const leavePendingRes = await query(
      `SELECT COUNT(*)::int as count FROM leave_requests WHERE organization_id = $1 AND status = 'PENDING'`,
      [organizationId]
    );
    const pendingLeaves = leavePendingRes.rows[0]?.count || 0;

    // Pending Expenses Count
    const expensePendingRes = await query(
      `SELECT COUNT(*)::int as count FROM expenses WHERE organization_id = $1 AND status = 'PENDING'`,
      [organizationId]
    );
    const pendingExpenses = expensePendingRes.rows[0]?.count || 0;

    // Pending Tasks Count (Timesheets with status PENDING or DRAFT)
    const tasksPendingRes = await query(
      `SELECT COUNT(*)::int as count FROM timesheets WHERE organization_id = $1 AND status IN ('PENDING', 'DRAFT')`,
      [organizationId]
    );
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

    // 2. Department Distribution
    const deptRes = await query(
      `SELECT COALESCE(NULLIF(TRIM(department), ''), 'Unassigned') as name, COUNT(*)::int as count 
       FROM employees 
       WHERE organization_id = $1 AND status = 'ACTIVE' 
       GROUP BY 1 
       ORDER BY count DESC`,
      [organizationId]
    );
    const deptColors = ['#06B6D4', '#3B82F6', '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];
    const departments = deptRes.rows.map((d: any, idx: number) => ({
      name: d.name,
      count: d.count,
      percentage: totalEmployees > 0 ? Math.round((d.count / totalEmployees) * 100) : 0,
      color: deptColors[idx % deptColors.length]
    }));

    // 3. Weekly Attendance Trend Data
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
      // Default: This Week (Mon-Sun)
      const dayOfWeek = now.getDay() || 7;
      startDate.setDate(now.getDate() - dayOfWeek + 1);
      endDate.setDate(startDate.getDate() + 6);
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const weeklyAttRes = await query(
      `SELECT date, COUNT(DISTINCT employee_id)::int as present_count 
       FROM attendance 
       WHERE organization_id = $1 AND date BETWEEN $2 AND $3 AND status IN ('PRESENT', 'LATE') 
       GROUP BY date 
       ORDER BY date ASC`,
      [organizationId, startStr, endStr]
    );

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

    // 4. Recent Activities (from audit_logs)
    const auditRes = await query(
      `SELECT a.id, a.action, a.entity_type, a.details, a.created_at, 
              a.employee_name_snapshot, a.user_email_snapshot, u.display_name, u.email 
       FROM audit_logs a 
       LEFT JOIN users u ON a.user_id = u.id 
       WHERE a.organization_id = $1 
       ORDER BY a.created_at DESC 
       LIMIT 6`,
      [organizationId]
    );
    const recentActivities = auditRes.rows.map((row: any) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      userName: row.employee_name_snapshot || row.display_name || (row.email ? row.email.split('@')[0] : (row.user_email_snapshot ? row.user_email_snapshot.split('@')[0] : 'System')),
      details: row.details,
      createdAt: row.created_at
    }));

    // 5. Recent Leave Requests
    let leaveQuery = `
      SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.days_count, lr.status, lr.created_at,
             e.first_name, e.last_name, u.display_name
      FROM leave_requests lr
      LEFT JOIN employees e ON e.id = lr.employee_id
      LEFT JOIN users u ON u.id = lr.user_id
      WHERE lr.organization_id = $1
    `;
    const leaveQueryParams: any[] = [organizationId];

    if (!['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(role) && employeeId) {
      leaveQuery += ` AND lr.employee_id = $2`;
      leaveQueryParams.push(employeeId);
    }
    leaveQuery += ` ORDER BY lr.created_at DESC LIMIT 5`;

    const recentLeavesRes = await query(leaveQuery, leaveQueryParams);
    const recentLeaveRequests = recentLeavesRes.rows.map((r: any) => ({
      id: r.id,
      employeeName: (r.first_name && r.last_name) ? `${r.first_name} ${r.last_name}` : (r.display_name || 'Employee'),
      leaveType: r.leave_type,
      startDate: r.start_date,
      endDate: r.end_date,
      daysCount: r.days_count,
      status: r.status,
      createdAt: r.created_at
    }));

    // Personal employee details if employeeId exists
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
