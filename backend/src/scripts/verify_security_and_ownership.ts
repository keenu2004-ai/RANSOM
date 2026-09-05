import { query } from '../db';
import { ExpenseRepository } from '../repositories/expenseRepository';
import { TripExpenseRepository } from '../repositories/tripExpenseRepository';
import { LeaveRepository } from '../repositories/leaveRepository';
import { AttendanceRepository } from '../repositories/attendanceRepository';
import { AssetRepository } from '../repositories/assetRepository';

async function initSchema() {
  const statements = [
    `ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS organization_id VARCHAR(255)`,
    `ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS organization_id VARCHAR(255)`,
    `ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS year INT`,
    `ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS quota NUMERIC(5,2) DEFAULT 0`,
    `ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS used NUMERIC(5,2) DEFAULT 0`,
    `ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS pending NUMERIC(5,2) DEFAULT 0`,
    `ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS available NUMERIC(5,2) DEFAULT 0`,
    `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS organization_id VARCHAR(255)`,
    `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255)`,
    `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`,
    `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT`,
    `ALTER TABLE attendance_regularizations ADD COLUMN IF NOT EXISTS organization_id VARCHAR(255)`,
    `ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS organization_id VARCHAR(255)`,
    `ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS category_id VARCHAR(255)`,
    `ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'HARDWARE'`,
    `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS trip_expense_id VARCHAR(255)`
  ];
  for (const stmt of statements) {
    try {
      await query(stmt);
    } catch (e: any) {}
  }

  const typeFixes = [
    `ALTER TABLE leave_balances ALTER COLUMN organization_id TYPE VARCHAR(255) USING organization_id::text`,
    `ALTER TABLE leave_balances ALTER COLUMN employee_id TYPE VARCHAR(255) USING employee_id::text`,
    `ALTER TABLE leave_balances ALTER COLUMN leave_type_id TYPE VARCHAR(255) USING leave_type_id::text`,
    `ALTER TABLE leave_requests ALTER COLUMN organization_id TYPE VARCHAR(255) USING organization_id::text`,
    `ALTER TABLE leave_requests ALTER COLUMN employee_id TYPE VARCHAR(255) USING employee_id::text`,
    `ALTER TABLE leave_requests ALTER COLUMN leave_type_id TYPE VARCHAR(255) USING leave_type_id::text`,
    `ALTER TABLE leave_requests ALTER COLUMN requested_leave_type_id TYPE VARCHAR(255) USING requested_leave_type_id::text`,
    `ALTER TABLE leave_types ALTER COLUMN organization_id TYPE VARCHAR(255) USING organization_id::text`,
    `ALTER TABLE attendance_regularizations ALTER COLUMN organization_id TYPE VARCHAR(255) USING organization_id::text`,
    `ALTER TABLE attendance_regularizations ALTER COLUMN employee_id TYPE VARCHAR(255) USING employee_id::text`,
    `ALTER TABLE asset_requests ALTER COLUMN organization_id TYPE VARCHAR(255) USING organization_id::text`,
    `ALTER TABLE asset_requests ALTER COLUMN employee_id TYPE VARCHAR(255) USING employee_id::text`
  ];
  for (const fix of typeFixes) {
    try {
      await query(fix);
    } catch (e: any) {}
  }
}

async function runSecuritySuite() {
  await initSchema();
  console.log('====================================================');
  console.log('  RUNNING SECURITY & EMPLOYEE OWNERSHIP TEST SUITE  ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // Setup test environment check dynamically matching DB column types
  let orgA = '';
  let orgB = '';
  let empA1 = '';
  let empA2 = '';
  let empB1 = '';
  let leaveTypeCL = '';
  let leaveTypePL = '';

  try {
    const ts = Date.now();
    const orgResA = await query(`INSERT INTO organizations (name, code) VALUES ('Org A Security Suite', $1) RETURNING id::text`, [`ORGA_SEC_${ts}`]);
    orgA = orgResA.rows[0].id;
    const orgResB = await query(`INSERT INTO organizations (name, code) VALUES ('Org B Security Suite', $1) RETURNING id::text`, [`ORGB_SEC_${ts}`]);
    orgB = orgResB.rows[0].id;

    const e1 = await query(`INSERT INTO employees (organization_id, employee_code, first_name, last_name, email, phone, password_hash, designation, joining_date) VALUES ($1, $2, 'John', 'Doe', $3, '9999999991', 'dummyhash', 'Engineer', '2025-01-01') RETURNING id::text`, [orgA, `EMP_SEC1_${ts}`, `john_sec_${ts}@a.com`]);
    empA1 = e1.rows[0].id;

    const e2 = await query(`INSERT INTO employees (organization_id, employee_code, first_name, last_name, email, phone, password_hash, designation, joining_date) VALUES ($1, $2, 'Jane', 'Smith', $3, '9999999992', 'dummyhash', 'Engineer', '2025-01-01') RETURNING id::text`, [orgA, `EMP_SEC2_${ts}`, `jane_sec_${ts}@a.com`]);
    empA2 = e2.rows[0].id;

    const eb = await query(`INSERT INTO employees (organization_id, employee_code, first_name, last_name, email, phone, password_hash, designation, joining_date) VALUES ($1, $2, 'Bob', 'Wilson', $3, '9999999993', 'dummyhash', 'Engineer', '2025-01-01') RETURNING id::text`, [orgB, `EMP_SECB_${ts}`, `bob_sec_${ts}@b.com`]);
    empB1 = eb.rows[0].id;

    const lt1 = await query(`INSERT INTO leave_types (organization_id, name, code, is_active) VALUES ($1, 'Casual Leave Sec', $2, true) RETURNING id::text`, [orgA, `CL_SEC_${ts}`]);
    leaveTypeCL = lt1.rows[0].id;

    const lt2 = await query(`INSERT INTO leave_types (organization_id, name, code, is_active) VALUES ($1, 'Privilege Leave Sec', $2, true) RETURNING id::text`, [orgA, `PL_SEC_${ts}`]);
    leaveTypePL = lt2.rows[0].id;
  } catch (err: any) {
    console.error('Test environment initialization failed:', err.message);
    process.exit(1);
  }

  console.log(`Using OrgA: ${orgA}, EmpA1: ${empA1}, EmpA2: ${empA2}, OrgB: ${orgB}, EmpB1: ${empB1}\n`);

  // ---------------------------------------------------
  // SECTION 1: EXPENSES (Cases 1 - 11)
  // ---------------------------------------------------
  console.log('--- EXPENSES OWNERSHIP & STATUS TESTS ---');

  async function createTestExpense(empId: string, orgId: string, status: string = 'DRAFT') {
    const res = await query(`
      INSERT INTO expenses (organization_id, employee_id, expense_type, title, category, amount, date, transaction_date, description, status, currency)
      VALUES ($1, $2, 'BUSINESS', 'Test Expense', 'Travel', 1000, '2026-09-01', '2026-09-01', 'Test Expense Description', $3, 'INR')
      RETURNING *
    `, [orgId, empId, status]);
    return res.rows[0];
  }

  // Case 1: Employee edits own DRAFT
  try {
    const exp = await createTestExpense(empA1, orgA, 'DRAFT');
    const updated = await ExpenseRepository.updateDraft(exp.id, orgA, empA1, { amount: 1500, description: 'Updated Draft' });
    assert(updated && updated.amount == 1500, 'Case 1: Employee edits own DRAFT');
    await query('DELETE FROM expenses WHERE id = $1', [exp.id]);
  } catch (e: any) { assert(false, 'Case 1: Employee edits own DRAFT', e.message); }

  // Case 2: Employee edits own SUBMITTED
  try {
    const exp = await createTestExpense(empA1, orgA, 'SUBMITTED');
    const updated = await ExpenseRepository.updateDraft(exp.id, orgA, empA1, { amount: 1600, description: 'Updated Submitted' });
    assert(updated && updated.amount == 1600, 'Case 2: Employee edits own SUBMITTED');
    await query('DELETE FROM expenses WHERE id = $1', [exp.id]);
  } catch (e: any) { assert(false, 'Case 2: Employee edits own SUBMITTED', e.message); }

  // Case 3: Employee edits own PENDING
  try {
    const exp = await createTestExpense(empA1, orgA, 'PENDING');
    const updated = await ExpenseRepository.updateDraft(exp.id, orgA, empA1, { amount: 1700, description: 'Updated Pending' });
    assert(updated && updated.amount == 1700, 'Case 3: Employee edits own PENDING');
    await query('DELETE FROM expenses WHERE id = $1', [exp.id]);
  } catch (e: any) { assert(false, 'Case 3: Employee edits own PENDING', e.message); }

  // Case 4: Employee deletes own DRAFT
  try {
    const exp = await createTestExpense(empA1, orgA, 'DRAFT');
    const deleted = await ExpenseRepository.deleteExpenseByEmployee(exp.id, orgA, empA1);
    assert(deleted && deleted.id === exp.id, 'Case 4: Employee deletes own DRAFT');
  } catch (e: any) { assert(false, 'Case 4: Employee deletes own DRAFT', e.message); }

  // Case 5: Employee deletes own SUBMITTED
  try {
    const exp = await createTestExpense(empA1, orgA, 'SUBMITTED');
    const deleted = await ExpenseRepository.deleteExpenseByEmployee(exp.id, orgA, empA1);
    assert(deleted && deleted.id === exp.id, 'Case 5: Employee deletes own SUBMITTED');
  } catch (e: any) { assert(false, 'Case 5: Employee deletes own SUBMITTED', e.message); }

  // Case 6: Employee deletes own PENDING
  try {
    const exp = await createTestExpense(empA1, orgA, 'PENDING');
    const deleted = await ExpenseRepository.deleteExpenseByEmployee(exp.id, orgA, empA1);
    assert(deleted && deleted.id === exp.id, 'Case 6: Employee deletes own PENDING');
  } catch (e: any) { assert(false, 'Case 6: Employee deletes own PENDING', e.message); }

  // Case 7: Employee edits APPROVED expense -> 403 / Error
  try {
    const exp = await createTestExpense(empA1, orgA, 'APPROVED');
    const updated = await ExpenseRepository.updateDraft(exp.id, orgA, empA1, { amount: 2000 });
    if (!updated) {
      assert(true, 'Case 7: Employee edits APPROVED expense -> 403 Forbidden (Locked)');
    } else {
      assert(false, 'Case 7: Employee edits APPROVED expense');
    }
    await query('DELETE FROM expenses WHERE id = $1', [exp.id]);
  } catch (e: any) {
    assert(e.message.includes('APPROVED') || e.message.includes('locked'), 'Case 7: Employee edits APPROVED expense -> 403 Forbidden');
  }

  // Case 8: Employee deletes APPROVED expense -> 403 / Error
  try {
    const exp = await createTestExpense(empA1, orgA, 'APPROVED');
    await ExpenseRepository.deleteExpenseByEmployee(exp.id, orgA, empA1);
    assert(false, 'Case 8: Employee deletes APPROVED expense');
    await query('DELETE FROM expenses WHERE id = $1', [exp.id]);
  } catch (e: any) {
    assert(e.message.includes('APPROVED'), 'Case 8: Employee deletes APPROVED expense -> 403 Forbidden');
  }

  // Case 9: Employee edits another employee's expense -> 403
  try {
    const exp = await createTestExpense(empA2, orgA, 'DRAFT');
    const updated = await ExpenseRepository.updateDraft(exp.id, orgA, empA1, { amount: 3000 });
    assert(!updated, 'Case 9: Employee edits another employee expense -> 403 Forbidden (No row updated)');
    await query('DELETE FROM expenses WHERE id = $1', [exp.id]);
  } catch (e: any) {
    assert(e.message.includes('not found') || e.message.includes('unauthorized'), 'Case 9: Employee edits another employee expense -> 403 Forbidden');
  }

  // Case 10: Employee deletes another employee's expense -> 403
  try {
    const exp = await createTestExpense(empA2, orgA, 'SUBMITTED');
    const deleted = await ExpenseRepository.deleteExpenseByEmployee(exp.id, orgA, empA1);
    assert(!deleted, 'Case 10: Employee deletes another employee expense -> 403 Forbidden (Null returned)');
    await query('DELETE FROM expenses WHERE id = $1', [exp.id]);
  } catch (e: any) {
    assert(e.message.includes('not found') || e.message.includes('unauthorized'), 'Case 10: Employee deletes another employee expense -> 403 Forbidden');
  }

  // Case 11: SUPER_ADMIN permanent delete still works
  try {
    const exp = await createTestExpense(empA1, orgA, 'APPROVED');
    const deleted = await ExpenseRepository.deleteSuperAdmin(exp.id, orgA, 'admin-user');
    assert(deleted && deleted.id === exp.id, 'Case 11: SUPER_ADMIN permanent delete still works');
  } catch (e: any) { assert(false, 'Case 11: SUPER_ADMIN permanent delete', e.message); }


  // ---------------------------------------------------
  // SECTION 2: TRIP EXPENSES (Cases 12 - 16)
  // ---------------------------------------------------
  console.log('\n--- TRIP EXPENSES TESTS ---');

  async function createTestTrip(empId: string, orgId: string, status: string = 'DRAFT') {
    const res = await query(`
      INSERT INTO trip_expenses (organization_id, employee_id, purpose, start_point, end_point, start_date, end_date, total_amount, status)
      VALUES ($1, $2, 'Client Meeting Mumbai', 'Mumbai', 'Delhi', '2026-09-10', '2026-09-12', 5000, $3)
      RETURNING *
    `, [orgId, empId, status]);
    return res.rows[0];
  }

  // Case 12: Employee edits own pre-approval trip -> success
  try {
    const trip = await createTestTrip(empA1, orgA, 'SUBMITTED');
    const updated = await TripExpenseRepository.updateTripDraft(trip.id, orgA, empA1, { purpose: 'Updated Trip Purpose' });
    assert(updated && updated.purpose === 'Updated Trip Purpose', 'Case 12: Employee edits own pre-approval trip');
    await query('DELETE FROM trip_expenses WHERE id = $1', [trip.id]);
  } catch (e: any) { assert(false, 'Case 12: Employee edits own pre-approval trip', e.message); }

  // Case 13: Employee deletes own pre-approval trip -> success
  try {
    const trip = await createTestTrip(empA1, orgA, 'PENDING');
    const deleted = await TripExpenseRepository.deleteTripDraft(trip.id, orgA, empA1);
    assert(deleted === true, 'Case 13: Employee deletes own pre-approval trip');
  } catch (e: any) { assert(false, 'Case 13: Employee deletes own pre-approval trip', e.message); }

  // Case 14: Employee edits/deletes another employee's trip -> 403
  try {
    const trip = await createTestTrip(empA2, orgA, 'DRAFT');
    const deleted = await TripExpenseRepository.deleteTripDraft(trip.id, orgA, empA1);
    assert(!deleted, 'Case 14: Employee deletes another employee trip -> 403 Forbidden (false returned)');
    await query('DELETE FROM trip_expenses WHERE id = $1', [trip.id]);
  } catch (e: any) {
    assert(e.message.includes('not found') || e.message.includes('unauthorized'), 'Case 14: Employee deletes another employee trip -> 403 Forbidden');
  }

  // Case 15: Employee edits/deletes approved trip -> 403
  try {
    const trip = await createTestTrip(empA1, orgA, 'APPROVED');
    const deleted = await TripExpenseRepository.deleteTripDraft(trip.id, orgA, empA1);
    assert(!deleted, 'Case 15: Employee deletes approved trip -> 403 Forbidden (false returned)');
    await query('DELETE FROM trip_expenses WHERE id = $1', [trip.id]);
  } catch (e: any) {
    assert(e.message.includes('APPROVED'), 'Case 15: Employee deletes approved trip -> 403 Forbidden');
  }

  // Case 16: Parent/child trip records & attachments consistency
  try {
    const trip = await createTestTrip(empA1, orgA, 'SUBMITTED');
    let childId = '';
    try {
      const childRes = await query(`
        INSERT INTO trip_travel_expenses (trip_expense_id, organization_id, employee_id, start_date, end_date, transport_mode, purpose, start_location, end_location, amount)
        VALUES ($1, $2, $3, '2026-09-10', '2026-09-10', 'Flight', 'Flight to client', 'Mumbai', 'Delhi', 2000)
        RETURNING id
      `, [trip.id, orgA, empA1]);
      childId = childRes.rows[0].id;
    } catch (e) {
      const childRes = await query(`
        INSERT INTO expenses (organization_id, employee_id, trip_expense_id, expense_type, title, category, amount, date, transaction_date, description, status, currency)
        VALUES ($1, $2, $3, 'BUSINESS', 'Child Hotel', 'Hotel', 2000, '2026-09-10', '2026-09-10', 'Child hotel', 'SUBMITTED', 'INR')
        RETURNING id
      `, [orgA, empA1, trip.id]);
      childId = childRes.rows[0].id;
    }

    await TripExpenseRepository.deleteTripDraft(trip.id, orgA, empA1);
    let childCheck = await query('SELECT id FROM trip_travel_expenses WHERE id = $1', [childId]);
    if (childCheck.rows.length === 0) {
      childCheck = await query('SELECT id FROM expenses WHERE id = $1', [childId]);
    }
    assert(childCheck.rows.length === 0, 'Case 16: Verify parent/child trip records, attachments, and child expenses remain consistent after employee deletion');
  } catch (e: any) { assert(false, 'Case 16: Parent/child trip consistency', e.message); }


  // ---------------------------------------------------
  // SECTION 3: LEAVE (Cases 17 - 25)
  // ---------------------------------------------------
  console.log('\n--- LEAVE REQUESTS & RESERVATIONS TESTS ---');

  async function resetBalances(empId: string, orgId: string) {
    await query('DELETE FROM leave_requests WHERE employee_id = $1', [empId]);
    await query('DELETE FROM leave_balances WHERE employee_id = $1', [empId]);
    await query(`
      INSERT INTO leave_balances (organization_id, employee_id, leave_type_id, year, quota, used, pending, available)
      VALUES 
        ($1, $2, $3, 2026, 20, 0, 0, 20),
        ($1, $2, $4, 2026, 20, 0, 0, 20)
    `, [orgId, empId, leaveTypeCL, leaveTypePL]);
  }

  await resetBalances(empA1, orgA);

  // Case 17 & 18 & 19: Employee edits own PENDING leave + days / type reservation recalculation
  try {
    const leave = await LeaveRepository.applyLeave(orgA, empA1, {
      leaveTypeId: leaveTypeCL,
      startDate: '2026-09-15',
      endDate: '2026-09-15',
      totalDays: 1,
      reason: 'Original pending leave'
    });

    const bBefore = await query('SELECT pending, available FROM leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND year = 2026', [empA1, leaveTypeCL]);
    assert(parseFloat(bBefore.rows[0].pending) === 1, 'Case 17: Employee edits own PENDING leave (Initial 1 day pending reserved)');

    const updatedLeave = await LeaveRepository.updateLeaveRequest(orgA, empA1, leave.id, {
      leaveTypeId: leaveTypePL,
      startDate: '2026-09-16',
      endDate: '2026-09-17',
      totalDays: 2,
      reason: 'Updated leave'
    });

    const bOldCL = await query('SELECT pending, available FROM leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND year = 2026', [empA1, leaveTypeCL]);
    const bNewPL = await query('SELECT pending, available FROM leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND year = 2026', [empA1, leaveTypePL]);

    assert(parseFloat(bOldCL.rows[0].pending) === 0, 'Case 18: Change pending leave days -> reservation recalculated (Old CL pending released to 0)');
    assert(parseFloat(bNewPL.rows[0].pending) === 2, 'Case 19: Change pending leave type -> reservation recalculated (New PL reserved 2 days pending)');

    await LeaveRepository.updateStatus(updatedLeave.id, orgA, 'CANCELLED', empA1);
  } catch (e: any) { assert(false, 'Case 17/18/19: Leave edit and reservation recalculation', e.message); }

  // Case 20 & 21: Withdraw/delete pending leave & reservation released exactly once
  try {
    await resetBalances(empA1, orgA);
    const leave = await LeaveRepository.applyLeave(orgA, empA1, {
      leaveTypeId: leaveTypeCL,
      startDate: '2026-09-20',
      endDate: '2026-09-20',
      totalDays: 1,
      reason: 'To be withdrawn'
    });

    await LeaveRepository.updateStatus(leave.id, orgA, 'CANCELLED', empA1);
    const bAfter = await query('SELECT pending, available FROM leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND year = 2026', [empA1, leaveTypeCL]);
    assert(parseFloat(bAfter.rows[0].pending) === 0 && parseFloat(bAfter.rows[0].available) === 20, 'Case 20: Withdraw/delete own PENDING leave');
    assert(parseFloat(bAfter.rows[0].pending) === 0, 'Case 21: Reservation released exactly once');

    try {
      await LeaveRepository.updateStatus(leave.id, orgA, 'CANCELLED', empA1);
      assert(false, 'Case 21b: Double cancel allowed');
    } catch (e: any) {
      assert(e.message.includes('CANCELLED') || e.message.includes('PENDING'), 'Case 21b: Double release prevented safely');
    }
  } catch (e: any) { assert(false, 'Case 20 & 21: Withdraw pending leave', e.message); }

  // Case 22: Prevent negative balances
  try {
    await query('UPDATE leave_balances SET available = 0.5, pending = 0 WHERE employee_id = $1 AND leave_type_id = $2 AND year = 2026', [empA1, leaveTypeCL]);
    await LeaveRepository.applyLeave(orgA, empA1, {
      leaveTypeId: leaveTypeCL,
      startDate: '2026-09-22',
      endDate: '2026-09-23',
      totalDays: 2,
      reason: 'Overdraft test'
    });
    assert(false, 'Case 22: Prevent negative balances');
  } catch (e: any) {
    assert(e.message.includes('Insufficient leave balance') || e.message.includes('Insufficient Casual Leave balance'), 'Case 22: Prevent negative balances (Overdraft rejected)');
  }

  // Case 23: Employee edits approved leave -> 403
  try {
    const leaveRes = await query(`
      INSERT INTO leave_requests (organization_id, employee_id, leave_type_id, requested_leave_type_id, start_date, end_date, total_days, reason, status)
      VALUES ($1, $2, $3, $3, '2026-09-01', '2026-09-01', 1, 'Approved Leave', 'APPROVED')
      RETURNING id
    `, [orgA, empA1, leaveTypeCL]);
    const approvedId = leaveRes.rows[0].id;

    try {
      await LeaveRepository.updateLeaveRequest(orgA, empA1, approvedId, { totalDays: 2 } as any);
      assert(false, 'Case 23: Employee edits approved leave -> 403 Forbidden');
    } catch (e: any) {
      assert(e.message.includes('PENDING') || e.message.includes('pending'), 'Case 23: Employee edits approved leave -> 403 Forbidden');
    }
    await query('DELETE FROM leave_requests WHERE id = $1', [approvedId]);
  } catch (e: any) { assert(false, 'Case 23: Employee edits approved leave -> 403 Forbidden', e.message); }

  // Case 24: Employee deletes approved leave -> 403
  try {
    const leaveRes = await query(`
      INSERT INTO leave_requests (organization_id, employee_id, leave_type_id, requested_leave_type_id, start_date, end_date, total_days, reason, status)
      VALUES ($1, $2, $3, $3, '2026-09-01', '2026-09-01', 1, 'Approved Leave 2', 'APPROVED')
      RETURNING id
    `, [orgA, empA1, leaveTypeCL]);
    const approvedId = leaveRes.rows[0].id;

    try {
      await LeaveRepository.updateStatus(approvedId, orgA, 'CANCELLED', empA1);
      assert(false, 'Case 24: Employee deletes approved leave -> 403 Forbidden');
    } catch (e: any) {
      assert(e.message.includes('APPROVED') || e.message.includes('PENDING') || e.message.includes('already'), 'Case 24: Employee deletes approved leave -> 403 Forbidden');
    }
    await query('DELETE FROM leave_requests WHERE id = $1', [approvedId]);
  } catch (e: any) { assert(false, 'Case 24: Employee deletes approved leave -> 403 Forbidden', e.message); }

  // Case 25: Employee modifies another employee's leave -> 403
  try {
    const leaveRes = await query(`
      INSERT INTO leave_requests (organization_id, employee_id, leave_type_id, requested_leave_type_id, start_date, end_date, total_days, reason, status)
      VALUES ($1, $2, $3, $3, '2026-09-25', '2026-09-25', 1, 'Emp2 Leave', 'PENDING')
      RETURNING id
    `, [orgA, empA2, leaveTypeCL]);
    const emp2LeaveId = leaveRes.rows[0].id;

    try {
      await LeaveRepository.updateLeaveRequest(orgA, empA1, emp2LeaveId, {
        leaveTypeId: leaveTypeCL,
        startDate: '2026-09-25',
        endDate: '2026-09-25',
        totalDays: 1,
        reason: 'Cross employee edit attempt'
      });
      assert(false, 'Case 25: Cross-employee leave modification -> 403 Forbidden');
    } catch (e: any) {
      assert(e.message.includes('authorized') || e.message.includes('not found') || e.message.includes('unauthorized'), 'Case 25: Cross-employee leave modification -> 403 Forbidden');
    }
    await query('DELETE FROM leave_requests WHERE id = $1', [emp2LeaveId]);
  } catch (e: any) { assert(false, 'Case 25: Cross-employee leave modification -> 403 Forbidden', e.message); }


  // ---------------------------------------------------
  // SECTION 4: REGULARIZATION (Cases 26 - 30)
  // ---------------------------------------------------
  console.log('\n--- ATTENDANCE REGULARIZATION TESTS ---');

  async function createTestReg(empId: string, orgId: string, status: string = 'PENDING') {
    const res = await query(`
      INSERT INTO attendance_regularizations (organization_id, employee_id, attendance_date, request_type, reason, status)
      VALUES ($1, $2, '2026-09-01', 'MISSED_PUNCH', 'Forgot punch', $3)
      RETURNING *
    `, [orgId, empId, status]);
    return res.rows[0];
  }

  // Case 26: Employee edits own PENDING regularization
  try {
    const reg = await createTestReg(empA1, orgA, 'PENDING');
    const updated = await AttendanceRepository.updateRegularization(orgA, empA1, reg.id, { reason: 'Updated reason for missed punch' });
    assert(updated && updated.reason.includes('Updated'), 'Case 26: Employee edits own PENDING regularization');
    await query('DELETE FROM attendance_regularizations WHERE id = $1', [reg.id]);
  } catch (e: any) { assert(false, 'Case 26: Employee edits own PENDING regularization', e.message); }

  // Case 27: Employee withdraws own PENDING regularization
  try {
    const reg = await createTestReg(empA1, orgA, 'PENDING');
    const deleted = await AttendanceRepository.deleteRegularization(orgA, empA1, reg.id);
    assert(deleted && deleted.id === reg.id, 'Case 27: Employee withdraws own PENDING regularization');
  } catch (e: any) { assert(false, 'Case 27: Employee withdraws own PENDING regularization', e.message); }

  // Case 28: Employee modifies approved regularization -> 403
  try {
    const reg = await createTestReg(empA1, orgA, 'APPROVED');
    await AttendanceRepository.deleteRegularization(orgA, empA1, reg.id);
    assert(false, 'Case 28: Employee modifies approved regularization');
    await query('DELETE FROM attendance_regularizations WHERE id = $1', [reg.id]);
  } catch (e: any) {
    assert(e.message.includes('APPROVED') || e.message.includes('PENDING') || e.message.includes('pending'), 'Case 28: Employee modifies approved regularization -> 403 Forbidden');
  }

  // Case 29: Employee modifies another employee's regularization -> 403
  try {
    const reg = await createTestReg(empA2, orgA, 'PENDING');
    await AttendanceRepository.deleteRegularization(orgA, empA1, reg.id);
    assert(false, 'Case 29: Employee modifies another employee regularization');
    await query('DELETE FROM attendance_regularizations WHERE id = $1', [reg.id]);
  } catch (e: any) {
    assert(e.message.includes('not found') || e.message.includes('authorized') || e.message.includes('unauthorized'), 'Case 29: Employee modifies another employee regularization -> 403 Forbidden');
  }

  // Case 30: Raw attendance punches cannot be edited/deleted by employee
  assert(typeof (AttendanceRepository as any).updatePunch === 'undefined' && typeof (AttendanceRepository as any).deletePunch === 'undefined', 'Case 30: Raw attendance punches master records cannot be modified by employee');


  // ---------------------------------------------------
  // SECTION 5: ASSET REQUESTS (Cases 31 - 34)
  // ---------------------------------------------------
  console.log('\n--- ASSET REQUESTS TESTS ---');

  async function createTestAssetReq(empId: string, orgId: string, status: string = 'SUBMITTED') {
    const reqNum = `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const res = await query(`
      INSERT INTO asset_requests (organization_id, employee_id, request_number, category, request_type, reason, status)
      VALUES ($1, $2, $3, 'HARDWARE', 'HARDWARE', 'Need new laptop', $4)
      RETURNING *
    `, [orgId, empId, reqNum, status]);
    return res.rows[0];
  }

  // Case 31: Employee edits own SUBMITTED request -> success
  try {
    const req = await createTestAssetReq(empA1, orgA, 'SUBMITTED');
    const updated = await AssetRepository.updateRequestByEmployee(orgA, empA1, req.id, { reason: 'Updated laptop request' }, 'user-id');
    assert(updated && updated.reason.includes('Updated'), 'Case 31: Employee edits own SUBMITTED asset request');
    await query('DELETE FROM asset_requests WHERE id = $1', [req.id]);
  } catch (e: any) { assert(false, 'Case 31: Employee edits own SUBMITTED asset request', e.message); }

  // Case 32: Employee deletes own SUBMITTED request -> success
  try {
    const req = await createTestAssetReq(empA1, orgA, 'SUBMITTED');
    const deleted = await AssetRepository.deleteRequestByEmployee(orgA, empA1, req.id, 'user-id');
    assert(deleted && deleted.id === req.id, 'Case 32: Employee deletes own SUBMITTED asset request');
  } catch (e: any) { assert(false, 'Case 32: Employee deletes own SUBMITTED asset request', e.message); }

  // Case 33: Employee modifies approved/fulfilled request -> 403
  try {
    const req = await createTestAssetReq(empA1, orgA, 'FULFILLED');
    await AssetRepository.deleteRequestByEmployee(orgA, empA1, req.id, 'user-id');
    assert(false, 'Case 33: Employee modifies fulfilled request');
    await query('DELETE FROM asset_requests WHERE id = $1', [req.id]);
  } catch (e: any) {
    assert(e.message.includes('SUBMITTED') || e.message.includes('Approved') || e.message.includes('finalized'), 'Case 33: Employee modifies approved/fulfilled request -> 403 Forbidden');
  }

  // Case 34: Cross-employee modification -> 403
  try {
    const req = await createTestAssetReq(empA2, orgA, 'SUBMITTED');
    await AssetRepository.deleteRequestByEmployee(orgA, empA1, req.id, 'user-id');
    assert(false, 'Case 34: Cross-employee asset request deletion');
    await query('DELETE FROM asset_requests WHERE id = $1', [req.id]);
  } catch (e: any) {
    assert(e.message.includes('not found') || e.message.includes('authorized') || e.message.includes('unauthorized'), 'Case 34: Cross-employee asset request modification -> 403 Forbidden');
  }


  // ---------------------------------------------------
  // SECTION 6: ORGANIZATION ISOLATION (Case 35)
  // ---------------------------------------------------
  console.log('\n--- ORGANIZATION ISOLATION TEST ---');

  try {
    const expB = await createTestExpense(empB1, orgB, 'SUBMITTED');
    const updated = await ExpenseRepository.updateDraft(expB.id, orgA, empA1, { amount: 9999 });
    assert(!updated, 'Case 35: Employee/organization A cannot access organization B records -> 403 Forbidden (Null returned)');
    await query('DELETE FROM expenses WHERE id = $1', [expB.id]);
  } catch (e: any) {
    assert(e.message.includes('not found') || e.message.includes('unauthorized'), 'Case 35: Employee/organization A cannot access organization B records -> 403 Forbidden');
  }

  console.log('\n====================================================');
  console.log(`  FINAL SECURITY SUITE RESULTS: ${passed} PASSED, ${failed} FAILED, 0 SKIPPED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

initSchema().then(() => runSecuritySuite()).catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
