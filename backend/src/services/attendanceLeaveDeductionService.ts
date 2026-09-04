import { query, withTransaction } from '../db';
import { AttendanceStatusService } from './attendanceStatusService';

export class AttendanceLeaveDeductionService {
  /**
   * Calculates entitled Privilege Leave (PL) deduction for Short Leaves:
   * 2 SL = 0.5 PL
   * 4 SL = 1.0 PL
   * 6 SL = 1.5 PL
   * 8 SL = 2.0 PL
   * Entitlement = floor(slCount / 4) * 1.0 + (if (slCount % 4) >= 2 then 0.5 else 0.0)
   */
  static calculateShortLeaveDeduction(shortLeaveCount: number): number {
    if (shortLeaveCount <= 0) return 0;
    const fullDays = Math.floor(shortLeaveCount / 4) * 1.0;
    const remainder = shortLeaveCount % 4;
    const halfDay = remainder >= 2 ? 0.5 : 0.0;
    return fullDays + halfDay;
  }

  /**
   * Calculates entitled Privilege Leave (PL) deduction for Half Days:
   * 1 HD = 0.5 PL
   * 2 HD = 1.0 PL
   * 3 HD = 1.5 PL
   * 4 HD = 2.0 PL
   * Entitlement = hdCount * 0.5
   */
  static calculateHalfDayDeduction(halfDayCount: number): number {
    if (halfDayCount <= 0) return 0;
    return halfDayCount * 0.5;
  }

  /**
   * Reconciles automatic attendance-derived leave deductions for an employee in a given accounting year.
   * - Counts SHORT LEAVE and HALF DAY days from authoritative attendance logs in period_year.
   * - Calculates desired total PL deduction.
   * - Compares with existing automatic deduction recorded in attendance_automatic_leave_deductions & employee_leave_adjustments.
   * - Idempotently applies only the delta or restores quota if regularization occurred.
   * - Never allows leave balance to drop below zero.
   */
  static async reconcileEmployeeDeduction(organizationId: string, employeeId: string, yearInput?: number, client?: any) {
    const { getCurrentFinancialYearStartYear, getFinancialYearPeriod } = require('../utils/financialYear');
    const startYear = yearInput || getCurrentFinancialYearStartYear();
    const fyPeriod = getFinancialYearPeriod(startYear);

    const queryFn = client ? (text: string, params: any[]) => client.query(text, params) : query;

    const runReconciliation = async (dbClient: any) => {
      // 1. Fetch all attendance sessions for employee in target Indian Financial Year
      const attRes = await dbClient.query(`
        SELECT DISTINCT a.date::text as date, a.check_in, a.check_out, a.working_hours, a.status
        FROM attendance a
        WHERE a.organization_id = $1 AND a.employee_id = $2 AND a.date BETWEEN $3 AND $4
        ORDER BY date ASC
      `, [organizationId, employeeId, fyPeriod.startDate, fyPeriod.endDate]);

      // Count Short Leave & Half Day occurrences (excluding approved leaves & holidays)
      let slCount = 0;
      let hdCount = 0;

      // Group sessions by date
      const daysMap = new Map<string, any[]>();
      attRes.rows.forEach((r: any) => {
        const dStr = r.date.split('T')[0];
        if (!daysMap.has(dStr)) daysMap.set(dStr, []);
        daysMap.get(dStr)!.push(r);
      });

      for (const [dStr, sessions] of daysMap.entries()) {
        const resolved = AttendanceStatusService.resolveDayStatus({
          dateStr: dStr,
          todayStr: new Date().toISOString().split('T')[0],
          sessions: sessions
        });

        if (resolved.status.includes('SHORT LEAVE')) {
          slCount++;
        } else if (resolved.status === 'HALF DAY') {
          hdCount++;
        }
      }

      const slDeduction = this.calculateShortLeaveDeduction(slCount);
      const hdDeduction = this.calculateHalfDayDeduction(hdCount);
      const desiredTotalPLDeduction = slDeduction + hdDeduction;

      // 2. Fetch Privilege Leave (PL or EL) leave_type_id for organization
      const ltRes = await dbClient.query(`
        SELECT id, code, name FROM leave_types
        WHERE organization_id = $1 AND code IN ('PL', 'EL') AND is_active = TRUE
        ORDER BY code ASC LIMIT 1
      `, [organizationId]);

      if (ltRes.rows.length === 0) {
        // No PL/EL configured for organization
        return { slCount, hdCount, desiredTotalPLDeduction, appliedDelta: 0, reason: 'NO_PL_LEAVE_TYPE' };
      }

      const plLeaveTypeId = ltRes.rows[0].id;

      // 3. Lock or fetch existing automatic deduction tracking record
      const trackRes = await dbClient.query(`
        SELECT * FROM attendance_automatic_leave_deductions
        WHERE organization_id = $1 AND employee_id = $2 AND leave_type_id = $3 AND period_year = $4
        FOR UPDATE
      `, [organizationId, employeeId, plLeaveTypeId, startYear]);

      const currentTrack = trackRes.rows[0] || null;
      const currentPLDeducted = currentTrack ? parseFloat(currentTrack.total_pl_deducted || '0') : 0.0;

      const delta = desiredTotalPLDeduction - currentPLDeducted;

      if (Math.abs(delta) < 0.01) {
        // Entitlement is up to date. No adjustment required.
        return { slCount, hdCount, desiredTotalPLDeduction, currentPLDeducted, appliedDelta: 0 };
      }

      // 4. Lock employee leave_balances record for PL
      const balRes = await dbClient.query(`
        SELECT lb.id, lb.used, lb.pending, lt.annual_quota as org_quota
        FROM leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lb.organization_id = $1 AND lb.employee_id = $2 AND lb.leave_type_id = $3 AND lb.year = $4
        FOR UPDATE
      `, [organizationId, employeeId, plLeaveTypeId, startYear]);

      if (balRes.rows.length === 0) {
        return { slCount, hdCount, desiredTotalPLDeduction, appliedDelta: 0, reason: 'NO_LEAVE_BALANCE_RECORD' };
      }

      const plBal = balRes.rows[0];
      const orgQuota = parseFloat(plBal.org_quota || '0');
      const used = parseFloat(plBal.used || '0');
      const pending = parseFloat(plBal.pending || '0');

      // Fetch existing employee leave adjustments sum to compute current available balance
      const adjRes = await dbClient.query(`
        SELECT adjustment_type, adjustment_value
        FROM employee_leave_adjustments
        WHERE organization_id = $1 AND employee_id = $2 AND leave_type_id = $3 AND period_year = $4
        ORDER BY created_at DESC LIMIT 1
      `, [organizationId, employeeId, plLeaveTypeId, startYear]);

      let effectiveAdjustment = 0;
      if (adjRes.rows.length > 0) {
        const lastAdj = adjRes.rows[0];
        if (lastAdj.adjustment_type === 'INCREMENT') effectiveAdjustment = parseFloat(lastAdj.adjustment_value || '0');
        else if (lastAdj.adjustment_type === 'DECREMENT') effectiveAdjustment = -parseFloat(lastAdj.adjustment_value || '0');
      }

      const currentEntitlement = orgQuota + effectiveAdjustment;
      const availablePL = Math.max(0, currentEntitlement - used - pending);

      let actualDeltaToApply = delta;
      if (delta > 0 && availablePL < delta) {
        // Non-negative guard: Cap deduction to available PL balance if insufficient
        actualDeltaToApply = Math.max(0, availablePL);
      }

      const newTotalPLDeducted = currentPLDeducted + actualDeltaToApply;
      const newAdjustmentValue = Math.abs(effectiveAdjustment - actualDeltaToApply);
      const newEntitlement = currentEntitlement - actualDeltaToApply;

      // 5. Insert automatic attendance adjustment or reversal in employee_leave_adjustments
      const systemUserRes = await dbClient.query(`
        SELECT id FROM users WHERE organization_id = $1 ORDER BY created_at ASC LIMIT 1
      `, [organizationId]);
      const systemUserId = systemUserRes.rows[0]?.id;

      const isReversal = delta < 0;
      const adjustmentType = isReversal ? 'INCREMENT' : 'DECREMENT';
      const reasonStr = isReversal
        ? `Attendance Adjustment Reversal — Regularization Applied (${Math.abs(delta)} PL Restored. Total: ${slCount} Short Leaves, ${hdCount} Half Days)`
        : `Attendance Adjustment — ${slCount} Short Leaves (${slDeduction} PL) & ${hdCount} Half Days (${hdDeduction} PL)`;

      await dbClient.query(`
        INSERT INTO employee_leave_adjustments (
          organization_id, employee_id, leave_type_id, period_year,
          adjustment_type, adjustment_value, final_entitlement, reason, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        organizationId,
        employeeId,
        plLeaveTypeId,
        startYear,
        adjustmentType,
        Math.abs(actualDeltaToApply),
        newEntitlement,
        reasonStr,
        systemUserId
      ]);

      // 6. Update tracking table
      if (currentTrack) {
        await dbClient.query(`
          UPDATE attendance_automatic_leave_deductions
          SET short_leave_count = $1,
              half_day_count = $2,
              total_short_leave_deduction = $3,
              total_half_day_deduction = $4,
              total_pl_deducted = $5,
              last_calculated_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
        `, [slCount, hdCount, slDeduction, hdDeduction, newTotalPLDeducted, currentTrack.id]);
      } else {
        await dbClient.query(`
          INSERT INTO attendance_automatic_leave_deductions (
            organization_id, employee_id, leave_type_id, period_year,
            short_leave_count, half_day_count, total_short_leave_deduction, total_half_day_deduction, total_pl_deducted
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [organizationId, employeeId, plLeaveTypeId, startYear, slCount, hdCount, slDeduction, hdDeduction, newTotalPLDeducted]);
      }

      return {
        slCount,
        hdCount,
        desiredTotalPLDeduction,
        currentPLDeducted,
        newTotalPLDeducted,
        appliedDelta: actualDeltaToApply
      };
    };

    if (client) {
      return runReconciliation(client);
    } else {
      return withTransaction(async (dbClient) => runReconciliation(dbClient));
    }
  }
}
