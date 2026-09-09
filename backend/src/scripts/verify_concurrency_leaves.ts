import * as dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = 'postgresql://postgres:Password%40123@localhost:5432/theiakshi_hrms';
import { query, withTransaction } from '../db';
import { AttendanceLeaveDeductionService } from '../services/attendanceLeaveDeductionService';
import assert from 'assert';

async function verifyConcurrencyLeaves() {
  console.log('--- STARTING LEAVE DEDUCTION CONCURRENCY VERIFICATION ---');

  // Setup: Create test org, employee, leave_type, leave_balance, and attendance
  const orgId = '1';
  const empId = '9990002';
  const ltId = '9990003';

  await query('BEGIN');
  try {
    // Teardown previous runs
    await query('DELETE FROM attendance_automatic_leave_deductions WHERE employee_id = $1', [empId]);
    await query('DELETE FROM employee_leave_adjustments WHERE employee_id = $1', [empId]);
    await query('DELETE FROM attendance WHERE employee_id = $1', [empId]);
    await query('DELETE FROM leave_balances WHERE employee_id = $1', [empId]);
    await query('DELETE FROM employees WHERE id = $1', [empId]);

    // Setup Org
    await query(`INSERT INTO organizations (id, name, code) VALUES ($1, 'Test Org', 'TST') ON CONFLICT (id) DO NOTHING`, [orgId]);
    await query(`INSERT INTO attendance_policy_settings (organization_id, short_leave_quota_ratio, half_day_quota_ratio) VALUES ($1, 0.25, 0.50) ON CONFLICT (organization_id) DO NOTHING`, [orgId]);
    
    // Setup Leave Type (PL)
    const ltRes = await query(`SELECT id FROM leave_types WHERE organization_id = $1 AND code = 'PL' LIMIT 1`, [orgId]);
    let actualLtId = ltId;
    if (ltRes.rows.length > 0) {
      actualLtId = ltRes.rows[0].id;
    } else {
      await query(`INSERT INTO leave_types (id, organization_id, code, name, is_active, annual_quota) VALUES ($1, $2, 'PL', 'Privilege Leave', TRUE, 12)`, [actualLtId, orgId]);
    }
    
    // Setup Employee
    await query(`INSERT INTO employees (id, organization_id, employee_code, first_name, last_name, email, phone, password_hash, role, designation, joining_date, salary) VALUES ($1, $2, 'EMP01', 'Test', 'EmpLast', 'test@test.com', '1234567890', 'hash', 'EMPLOYEE', 'Dev', '2026-01-01', 50000) ON CONFLICT (id) DO NOTHING`, [empId, orgId]);
    
    // Setup Leave Balance
    await query(`INSERT INTO leave_balances (organization_id, employee_id, leave_type_id, year, pending, used) VALUES ($1, $2, $3, 2026, 0, 0)`, [orgId, empId, actualLtId]);

    // Setup Attendance (4 Short Leaves = 1 PL deduction)
    const d1 = '2026-04-01'; const d2 = '2026-04-02'; const d3 = '2026-04-03'; const d4 = '2026-04-04';
    await query(`INSERT INTO attendance (organization_id, employee_id, date, check_in, check_out, working_hours, status) VALUES 
      ($1, $2, $3, $3::date + interval '09:40:00', $3::date + interval '17:00:00', 7.3, 'SHORT LEAVE'),
      ($1, $2, $4, $4::date + interval '09:40:00', $4::date + interval '17:00:00', 7.3, 'SHORT LEAVE'),
      ($1, $2, $5, $5::date + interval '09:40:00', $5::date + interval '17:00:00', 7.3, 'SHORT LEAVE'),
      ($1, $2, $6, $6::date + interval '09:40:00', $6::date + interval '17:00:00', 7.3, 'SHORT LEAVE')`, 
      [orgId, empId, d1, d2, d3, d4]);

    await query('COMMIT');
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }

  // Act: Fire 10 concurrent requests
  console.log('Firing 10 concurrent reconciliation requests...');
  
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(
      AttendanceLeaveDeductionService.reconcileEmployeeDeduction(orgId, empId, 2026)
        .catch(err => err) // Catch errors to inspect later
    );
  }

  const results = await Promise.all(promises);
  
  let successCount = 0;
  let noopCount = 0;
  let errorCount = 0;

  for (const r of results) {
    if (r instanceof Error) {
      console.error('Unexpected error:', r.message);
      errorCount++;
    } else {
      if (r.appliedDelta > 0) {
        successCount++;
      } else {
        noopCount++;
      }
    }
  }

  console.log(`Results: ${successCount} applied deduction, ${noopCount} skipped (idempotent), ${errorCount} errors`);

  // Assert
  assert.strictEqual(errorCount, 0, 'There should be no transaction errors (No unique constraint violation)');
  assert.strictEqual(successCount, 1, 'Exactly 1 request should apply the deduction');
  assert.strictEqual(noopCount, 9, 'Exactly 9 requests should be skipped safely');

  // Verify DB state
  const deductionRes = await query('SELECT * FROM attendance_automatic_leave_deductions WHERE employee_id = $1', [empId]);
  assert.strictEqual(deductionRes.rows.length, 1, 'Should have exactly 1 deduction row');
  assert.strictEqual(parseFloat(deductionRes.rows[0].total_pl_deducted), 1.0, 'Total PL deducted should be 1.0');

  const adjRes = await query('SELECT * FROM employee_leave_adjustments WHERE employee_id = $1', [empId]);
  assert.strictEqual(adjRes.rows.length, 1, 'Should have exactly 1 adjustment row');

  console.log('All concurrency assertions passed!');

  // Teardown
  await query('DELETE FROM attendance_automatic_leave_deductions WHERE employee_id = $1', [empId]);
  await query('DELETE FROM employee_leave_adjustments WHERE employee_id = $1', [empId]);
  await query('DELETE FROM attendance WHERE employee_id = $1', [empId]);
  await query('DELETE FROM leave_balances WHERE employee_id = $1', [empId]);
  await query('DELETE FROM employees WHERE id = $1', [empId]);
}

verifyConcurrencyLeaves().then(() => {
  console.log('Done');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
