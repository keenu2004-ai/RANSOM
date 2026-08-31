import { query, withTransaction } from '../db';
import { AttendanceRepository } from '../repositories/attendanceRepository';

export class AttendanceReconciliationService {
  /**
   * Reconciles unclosed attendance sessions for completed business days across all organizations.
   * - Marks open sessions where check_out IS NULL and date < todayOrgDateStr as REGULARIZATION_REQUIRED
   * - Leaves check_out AS NULL (NEVER fabricates check_out timestamp)
   * - Calculates working_hours using configured business-day boundary (e.g. 19:00 / 19:00:00)
   * - Is Idempotent: running multiple times does not duplicate or alter processed sessions
   */
  static async reconcileUnclosedSessions(): Promise<{ reconciledCount: number }> {
    return withTransaction(async (client) => {
      // 1. Fetch all active organizations
      const orgsRes = await client.query(`SELECT id FROM organizations`);
      let totalReconciled = 0;

      for (const org of orgsRes.rows) {
        const organizationId = org.id;
        const tz = await AttendanceRepository.getOrganizationTimeZone(organizationId, client);
        const todayOrgDateStr = AttendanceRepository.getOrgDateStr(new Date(), tz);

        // 2. Select open sessions from past days that have not been reconciled yet
        const unclosedRes = await client.query(
          `SELECT a.id, a.date, a.check_in, a.employee_id, a.organization_id, e.employee_code, e.first_name, e.last_name
           FROM attendance a
           LEFT JOIN employees e ON a.employee_id = e.id
           WHERE a.organization_id = $1 
             AND a.check_out IS NULL 
             AND a.date < $2::date
             AND (a.status NOT IN ('REGULARIZATION_REQUIRED', 'ROLLOVER_TERMINATED') OR a.status IS NULL)
           FOR UPDATE OF a`,
          [organizationId, todayOrgDateStr]
        );

        for (const session of unclosedRes.rows) {
          const sessionDateStr = session.date ? (typeof session.date === 'string' ? session.date.split('T')[0] : new Date(session.date).toISOString().split('T')[0]) : '';
          const checkInTime = new Date(session.check_in);
          
          // End-of-day boundary calculation: 19:00 (7 PM) of the session date in Org Timezone
          // If check-in was after 19:00, cap duration at 4 hours max or calculate up to 23:59:59
          const eodBoundary = new Date(`${sessionDateStr}T19:00:00`);
          let calcHours = 8.0; // default standard day allocation
          if (!isNaN(checkInTime.getTime()) && !isNaN(eodBoundary.getTime())) {
            const diffMs = eodBoundary.getTime() - checkInTime.getTime();
            if (diffMs > 0) {
              calcHours = Math.min(12.0, Math.max(0.5, Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100));
            }
          }

          // Update session status to REGULARIZATION_REQUIRED while keeping check_out NULL!
          await client.query(
            `UPDATE attendance
             SET status = 'REGULARIZATION_REQUIRED',
                 session_state = 'REGULARIZATION_REQUIRED',
                 working_hours = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND check_out IS NULL`,
            [session.id, calcHours]
          );

          // Log Audit Event
          const fullName = session.first_name ? `${session.first_name} ${session.last_name}` : 'Employee';
          await client.query(
            `INSERT INTO audit_logs (
              organization_id, user_id, action, module, entity_name, entity_id, new_values, employee_name_snapshot, employee_code_snapshot
            ) VALUES ($1, NULL, 'ATTENDANCE_SESSION_FORGOTTEN_CHECKOUT_RECONCILED', 'attendance', 'AttendanceSession', $2, $3, $4, $5)`,
            [
              organizationId,
              session.id,
              JSON.stringify({
                sessionId: session.id,
                employeeId: session.employee_id,
                attendanceDate: sessionDateStr,
                checkIn: session.check_in,
                checkOut: null,
                calculatedHours: calcHours,
                status: 'REGULARIZATION_REQUIRED'
              }),
              fullName,
              session.employee_code || 'EMP'
            ]
          );

          totalReconciled++;
        }
      }

      return { reconciledCount: totalReconciled };
    });
  }

  /**
   * Initializes background periodic reconciliation job (runs every 15 minutes)
   */
  static startReconciliationCron() {
    // Run initial check 10s after startup
    setTimeout(() => {
      AttendanceReconciliationService.reconcileUnclosedSessions()
        .then(r => {
          if (r.reconciledCount > 0) {
            console.log(`[Attendance Reconciliation Job] Reconciled ${r.reconciledCount} unclosed session(s) to REGULARIZATION_REQUIRED.`);
          }
        })
        .catch(err => console.warn('[Attendance Reconciliation Job Error]:', err));
    }, 10000);

    // Schedule periodic execution every 15 minutes
    setInterval(() => {
      AttendanceReconciliationService.reconcileUnclosedSessions()
        .then(r => {
          if (r.reconciledCount > 0) {
            console.log(`[Attendance Reconciliation Job] Reconciled ${r.reconciledCount} unclosed session(s) to REGULARIZATION_REQUIRED.`);
          }
        })
        .catch(err => console.warn('[Attendance Reconciliation Job Error]:', err));
    }, 15 * 60 * 1000);
  }
}
