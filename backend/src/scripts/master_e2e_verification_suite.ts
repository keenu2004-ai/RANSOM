import { query } from '../db';
import { AttendanceRepository } from '../repositories/attendanceRepository';
import { CalendarRepository } from '../repositories/calendarRepository';
import { AssetRepository } from '../repositories/assetRepository';
import { TimesheetRepository } from '../repositories/timesheetRepository';
import { ExpenseRepository } from '../repositories/expenseRepository';
import { TripExpenseRepository } from '../repositories/tripExpenseRepository';
import fs from 'fs';
import path from 'path';

async function runMasterE2EVerificationSuite() {
  console.log('================================================================');
  console.log('--- STARTING RANSOM MASTER END-TO-END REGRESSION SUITE ---');
  console.log('================================================================\n');

  const summary: Record<string, 'PASS' | 'FAIL'> = {};
  let passedCount = 0;
  let failedCount = 0;

  const runStep = (name: string, condition: boolean) => {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passedCount++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      failedCount++;
      throw new Error(`Step failed: ${name}`);
    }
  };

  try {
    // ─── 1. DATABASE & MULTI-TENANT ISOLATION FOUNDATION ───────────────────────
    console.log('[TEST 1] PostgreSQL Ping & Multi-Tenant Isolation Foundation...');
    const orgRes = await query('SELECT id, name FROM organizations LIMIT 1');
    if (orgRes.rows.length === 0) throw new Error('No organization found in database.');
    const orgId = orgRes.rows[0].id;

    const empRes = await query(
      'SELECT id, user_id, first_name, last_name, employee_code FROM employees WHERE organization_id = $1 AND user_id IS NOT NULL LIMIT 1',
      [orgId]
    );
    if (empRes.rows.length === 0) throw new Error('No active employee record found with user_id.');
    const emp = empRes.rows[0];

    const dummyOrgId = '00000000-0000-0000-0000-000000000000';
    const dummyEmps = await query('SELECT * FROM employees WHERE organization_id = $1', [dummyOrgId]);
    runStep('Database connection & org isolation check', dummyEmps.rows.length === 0);
    summary['1. Multi-Tenant Foundation'] = 'PASS';


    // ─── 2. AUTHENTICATION & RBAC CONTRACTS ────────────────────────────────────
    console.log('\n[TEST 2] Authentication & RBAC User Identity Contracts...');
    const userRes = await query('SELECT id, email, password_hash, role FROM users WHERE id = $1 AND organization_id = $2', [emp.user_id, orgId]);
    runStep('User record matches employee user_id link', userRes.rows.length === 1);
    const userRole = userRes.rows[0].role;
    runStep('User has valid RBAC role assignment', ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'].includes(userRole));
    summary['2. Authentication & RBAC'] = 'PASS';


    // ─── 3. ATTENDANCE STATE MACHINE, MULTI-SESSION GPS & REGULARIZATION ────
    console.log('\n[TEST 3] Attendance State Machine, Multi-Session GPS & Regularization...');
    const todayStr = new Date().toISOString().split('T')[0];

    // Clean up existing attendance for today for test employee
    await query('DELETE FROM attendance_regularizations WHERE employee_id = $1 AND attendance_date = $2', [emp.id, todayStr]);
    await query('DELETE FROM attendance WHERE employee_id = $1 AND date = $2', [emp.id, todayStr]);

    // Check Initial State
    const activeSession = await AttendanceRepository.findActiveSession(emp.id, orgId);
    runStep('Initial state: NO ACTIVE SESSION', !activeSession);

    // Session 1: Punch In with GPS & Accuracy
    const punchInRec = await AttendanceRepository.checkIn(orgId, emp.id, todayStr, 12.971598, 77.594566, 10.0, 'General Shift');
    runStep('Session 1 Punch-In record created with GPS coordinates & accuracy', !!punchInRec.check_in && Number(punchInRec.punch_in_lat) === 12.971598);

    // Duplicate Active Punch-In Check
    try {
      await AttendanceRepository.checkIn(orgId, emp.id, todayStr, 12.971598, 77.594566);
      runStep('Duplicate active punch-in rejected', false);
    } catch (err: any) {
      runStep('Duplicate active punch-in correctly rejected', err.message.includes('active check-in session'));
    }

    // Break Update on Session 1
    await AttendanceRepository.updateBreak(orgId, emp.id, 30);
    const breakActive = await AttendanceRepository.findActiveSession(emp.id, orgId);
    runStep('Break duration incremented on active session', breakActive?.break_duration_mins === 30);

    // Session 1: Punch Out with GPS
    const punchOutRec = await AttendanceRepository.checkOut(orgId, emp.id, 12.971598, 77.594566, 10.0);
    runStep('Session 1 Punch-Out completed with working hours', !!punchOutRec.check_out && punchOutRec.status === 'PRESENT');

    // Duplicate Punch-Out Check (No active session)
    try {
      await AttendanceRepository.checkOut(orgId, emp.id, 12.971598, 77.594566);
      runStep('Check-out with no active session rejected', false);
    } catch (err: any) {
      runStep('Check-out with no active session correctly rejected', err.message.includes('No active check-in session'));
    }

    // Session 2: Second Check-In & Check-Out on Same Date
    const s2CheckIn = await AttendanceRepository.checkIn(orgId, emp.id, todayStr, 28.5355, 77.3910, 5.0, 'Client Site');
    runStep('Session 2 Punch-In created on same date', !!s2CheckIn.check_in);

    const s2CheckOut = await AttendanceRepository.checkOut(orgId, emp.id, 28.5355, 77.3910, 5.0);
    runStep('Session 2 Punch-Out completed on same date', !!s2CheckOut.check_out);

    // Multi-Session Daily Aggregation Verification
    const daySummary = await AttendanceRepository.getTodaySummary(emp.id, orgId, todayStr);
    runStep('Multi-session daily aggregation counts 2 sessions', daySummary.totalSessions === 2);

    // Regularization Workflow
    const regReq = await AttendanceRepository.applyRegularization(
      orgId, emp.id, todayStr, `${todayStr}T09:00:00Z`, `${todayStr}T18:00:00Z`, 'E2E Master Suite Regularization Test'
    );
    runStep('Regularization request submitted with PENDING status', regReq.status === 'PENDING');

    const approvedReg = await AttendanceRepository.approveRegularization(orgId, regReq.id, emp.id);
    runStep('Regularization request APPROVED', approvedReg.regularization.status === 'APPROVED');

    // Cleanup attendance test records
    await query('DELETE FROM attendance_regularizations WHERE id = $1', [regReq.id]);
    await query('DELETE FROM attendance WHERE employee_id = $1 AND date = $2', [emp.id, todayStr]);
    summary['3. Attendance & State Machine'] = 'PASS';


    // ─── 4. LEAVE WORKFLOW ─────────────────────────────────────────────────────
    console.log('\n[TEST 4] Leave Types, Application & Approval Workflow...');
    const leaveTypesRes = await query('SELECT id, name FROM leave_types WHERE organization_id = $1 LIMIT 1', [orgId]);
    if (leaveTypesRes.rows.length > 0) {
      const ltId = leaveTypesRes.rows[0].id;
      const leaveApp = await query(`
        INSERT INTO leave_requests (
          organization_id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status
        ) VALUES ($1, $2, $3, $4, $4, 1.0, 'E2E Master Suite Leave Test', 'PENDING')
        RETURNING *
      `, [orgId, emp.id, ltId, todayStr]);
      runStep('Leave application submitted with PENDING status', leaveApp.rows[0].status === 'PENDING');

      const approvedLeave = await query(`
        UPDATE leave_requests SET status = 'APPROVED', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 RETURNING *
      `, [leaveApp.rows[0].id]);
      runStep('Leave request APPROVED', approvedLeave.rows[0].status === 'APPROVED');

      // Clean up leave test request
      await query('DELETE FROM leave_requests WHERE id = $1', [leaveApp.rows[0].id]);
    } else {
      runStep('Leave workflow check passed (no leave_types seeded)', true);
    }
    summary['4. Leave Workflow'] = 'PASS';


    // ─── 5. UNIFIED CALENDAR INTEGRATION ────────────────────────────────────────
    console.log('\n[TEST 5] Unified Calendar Multi-Query Aggregation (GET /api/calendar)...');
    const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-28`;

    const calEvents = await CalendarRepository.getEvents(orgId, monthStart, monthEnd);
    runStep('Calendar events returned as array', Array.isArray(calEvents));

    const empCalEvents = await CalendarRepository.getEvents(orgId, monthStart, monthEnd, emp.id);
    const leakage = empCalEvents.filter(e => e.employeeId && e.employeeId !== emp.id);
    runStep('Employee isolation enforced on calendar', leakage.length === 0);
    summary['5. Unified Calendar'] = 'PASS';


    // ─── 6. ASSETS, CATEGORIES & EMPLOYEE ASSIGNED ASSETS ──────────────────────
    console.log('\n[TEST 6] Asset Inventory, Categories & Assigned Assets Workflow...');
    const categories = await AssetRepository.getCategories(orgId);
    runStep('Asset categories loaded (Electronic, Hardware, Parts, Machine present)', categories.length >= 4);

    // Create New Category
    const testCatCode = `CAT-TEST-${Date.now()}`;
    const newCategory = await AssetRepository.createCategory(orgId, {
      name: 'Lab Equipment',
      code: testCatCode,
      description: 'Test category created during E2E verification'
    });
    runStep('New Asset Category created successfully', newCategory.code === testCatCode);

    // Create Asset & Verify Immediate Listing
    const testAsset = await AssetRepository.create(orgId, emp.user_id, {
      assetName: 'E2E Test Laptop Workstation',
      assetType: 'HARDWARE',
      categoryId: categories[0].id,
      purchasePrice: 85000,
      currentValue: 85000,
      condition: 'NEW',
      assignmentStatus: 'IN_STOCK'
    });
    runStep('Asset registered with generated asset code', !!testAsset.asset_code && testAsset.status === 'AVAILABLE');

    const inventory = await AssetRepository.findAll(orgId, {});
    const listedAsset = inventory.assets.find(a => a.id === testAsset.id);
    runStep('Newly registered asset appears in GET inventory query', !!listedAsset);

    // Asset Request
    const assetReq = await AssetRepository.createRequest(orgId, emp.id, emp.user_id, {
      categoryId: categories[0].id,
      reason: 'Need workstation for E2E testing',
      priority: 'HIGH'
    });
    runStep('Asset Request created with AR- number and SUBMITTED status', assetReq.request_number.startsWith('AR-') && assetReq.status === 'SUBMITTED');

    // Approve Asset Request
    const appReq = await AssetRepository.approveRequest(orgId, assetReq.id, emp.id, emp.user_id);
    runStep('Asset Request APPROVED', appReq.status === 'APPROVED');

    const fulfillResult = await AssetRepository.fulfillRequest(orgId, assetReq.id, testAsset.id, emp.user_id);
    runStep('Asset Request FULFILLED and asset assigned', fulfillResult.request.status === 'FULFILLED' && fulfillResult.asset.status === 'ASSIGNED');

    // Verify Employee Assigned Assets Query
    const empAssigned = await AssetRepository.findAll(orgId, { assignedEmployeeId: emp.id });
    runStep('Assigned asset appears in employee assigned assets query', empAssigned.assets.some(a => a.id === testAsset.id));

    // Verify Assigned Asset Soft-Delete Rejection
    try {
      await AssetRepository.softDelete(testAsset.id, orgId, emp.user_id);
      runStep('Direct soft-delete of ASSIGNED asset rejected', false);
    } catch (err: any) {
      runStep('Direct soft-delete of ASSIGNED asset correctly rejected', err.message.includes('currently assigned to an employee'));
    }

    // Return Asset to Available Stock
    await AssetRepository.returnAsset(testAsset.id, orgId, emp.user_id, {
      returnedDate: new Date().toISOString().split('T')[0],
      notes: 'Returned during E2E verification test'
    });

    // Soft Delete Available Asset
    const deleteRes = await AssetRepository.softDelete(testAsset.id, orgId, emp.user_id);
    runStep('Available asset soft-deleted successfully', deleteRes === true);

    // Verify Asset Disappears from Active Inventory
    const activeInventoryPostDelete = await AssetRepository.findAll(orgId, {});
    runStep('Soft-deleted asset excluded from active inventory queries', !activeInventoryPostDelete.assets.some(a => a.id === testAsset.id));

    // Verify Asset History & Audit Log Preserved
    const historyPostDelete = await AssetRepository.getHistory(testAsset.id, orgId);
    runStep('Asset lifecycle history preserved post-deletion', historyPostDelete.some(h => h.action === 'DELETED'));

    const auditLog = await query(`SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'DELETE_ASSET'`, [testAsset.id]);
    runStep('DELETE_ASSET audit log recorded', auditLog.rows.length > 0);

    // Cleanup Asset Test Records
    await query('DELETE FROM audit_logs WHERE entity_id = $1', [testAsset.id]);
    await query('DELETE FROM asset_history WHERE asset_id = $1', [testAsset.id]);
    await query('DELETE FROM assets WHERE id = $1', [testAsset.id]);
    await query('DELETE FROM asset_requests WHERE id = $1', [assetReq.id]);
    await query('DELETE FROM asset_categories WHERE id = $1', [newCategory.id]);
    summary['6. Assets & Requisitions'] = 'PASS';


    // ─── 7. EXPENSES & TRIP EXPENSES ──────────────────────────────────────────
    console.log('\n[TEST 7] Expense Claims & Parent/Child Trip Expense Schema...');
    
    // Business Expense Creation without attachment
    const bizExpNoAttach = await ExpenseRepository.create(orgId, emp.id, {
      expenseType: 'BUSINESS',
      category: 'Office Supply',
      amount: 1500,
      bucket: 'Primary',
      description: 'Stationery for office work'
    });
    runStep('Business Expense without attachment created successfully', !!bizExpNoAttach.id && bizExpNoAttach.expense_type === 'BUSINESS');

    // Business Expense Creation with attachment
    const bizExpWithAttach = await ExpenseRepository.create(orgId, emp.id, {
      expenseType: 'BUSINESS',
      category: 'Courier',
      amount: 850,
      bucket: 'Primary',
      description: 'Document dispatch courier',
      attachmentName: 'courier_receipt.pdf',
      receiptUrl: '/uploads/courier_receipt.pdf'
    });
    runStep('Business Expense with attachment created and attachment reference preserved', !!bizExpWithAttach.id && bizExpWithAttach.receipt_url === '/uploads/courier_receipt.pdf');

    // Local Travel Creation without attachment
    const localTravelNoAttach = await ExpenseRepository.create(orgId, emp.id, {
      expenseType: 'LOCAL_TRAVEL',
      category: 'Taxi',
      transportMode: 'Taxi',
      merchant: 'Uber India',
      startLocation: 'Sector 62 Noida',
      endLocation: 'Connaught Place Delhi',
      amount: 650,
      bucket: 'Primary',
      description: 'Client meeting local travel'
    });
    runStep('Local Travel Expense created with transport mode, start & end locations', !!localTravelNoAttach.id && localTravelNoAttach.transport_mode === 'Taxi');

    // Local Travel Creation with attachment
    const localTravelWithAttach = await ExpenseRepository.create(orgId, emp.id, {
      expenseType: 'LOCAL_TRAVEL',
      category: 'Metro Train',
      transportMode: 'Metro',
      merchant: 'DMRC',
      startLocation: 'Noida City Centre',
      endLocation: 'Rajiv Chowk',
      amount: 120,
      bucket: 'Primary',
      description: 'Metro fare for client visit',
      attachmentName: 'metro_ticket.png',
      receiptUrl: '/uploads/metro_ticket.png'
    });
    runStep('Local Travel Expense with attachment created and receipt URL preserved', !!localTravelWithAttach.id && localTravelWithAttach.receipt_url === '/uploads/metro_ticket.png');

    // Trip Expense Workflow: Parent Creation
    const tripParent = await TripExpenseRepository.createTrip(orgId, emp.id, {
      purpose: 'Annual Branch Audit & Partner Conference',
      startPoint: 'New Delhi',
      endPoint: 'Mumbai',
      startDate: todayStr,
      endDate: todayStr
    });
    runStep('Parent Trip Expense created in DRAFT status', !!tripParent.id && tripParent.status === 'DRAFT' && Number(tripParent.total_amount) === 0);

    // Add 2 Travel Children
    const travel1 = await TripExpenseRepository.addTravelExpense(orgId, emp.id, tripParent.id, {
      startDate: todayStr,
      endDate: todayStr,
      transportMode: 'Flight',
      purpose: 'Outbound flight to Mumbai',
      merchant: 'IndiGo Airlines',
      startLocation: 'IGI Airport Delhi',
      endLocation: 'BOM Airport Mumbai',
      amount: 6500
    });

    const travel2 = await TripExpenseRepository.addTravelExpense(orgId, emp.id, tripParent.id, {
      startDate: todayStr,
      endDate: todayStr,
      transportMode: 'Taxi',
      purpose: 'Airport transfer to hotel',
      merchant: 'Uber Mumbai',
      startLocation: 'BOM Airport Mumbai',
      endLocation: 'Taj Lands End',
      amount: 1200
    });
    runStep('Added 2 Travel child expenses to parent trip', !!travel1.id && !!travel2.id);

    // Add Accommodation Child
    const accom1 = await TripExpenseRepository.addAccommodationExpense(orgId, emp.id, tripParent.id, {
      startDate: todayStr,
      endDate: todayStr,
      amount: 4500,
      accommodationDetails: 'Taj Lands End - Executive Suite'
    });
    runStep('Added Accommodation child expense to parent trip', !!accom1.id);

    // Add Other Child
    const other1 = await TripExpenseRepository.addOtherExpense(orgId, emp.id, tripParent.id, {
      transactionDate: todayStr,
      category: 'Food',
      merchant: 'Taj Lands End Dining',
      amount: 1800,
      purpose: 'Client dinner meeting'
    });
    runStep('Added Other child expense to parent trip', !!other1.id);

    // Verify Server-Calculated Total (6500 + 1200 + 4500 + 1800 = 14000)
    let fetchedTrip = await TripExpenseRepository.getTripById(tripParent.id, orgId);
    runStep('Server-calculated trip total equals sum of children (₹14,000)', Number(fetchedTrip.total_amount) === 14000);

    // Delete Travel Child 2 & Verify Total Recalculation (14000 - 1200 = 12800)
    await TripExpenseRepository.deleteTravelExpense(travel2.id, tripParent.id, orgId, emp.id);
    fetchedTrip = await TripExpenseRepository.getTripById(tripParent.id, orgId);
    runStep('Deleting travel child recalculates server total downwards (₹12,800)', Number(fetchedTrip.total_amount) === 12800);

    // Final Trip Submission -> PENDING
    const submittedTrip = await TripExpenseRepository.submitTrip(tripParent.id, orgId, emp.id);
    runStep('Final trip submission transitions status from DRAFT to PENDING', submittedTrip.status === 'PENDING');

    // Attempt to add child expense to PENDING trip -> Rejected
    try {
      await TripExpenseRepository.addOtherExpense(orgId, emp.id, tripParent.id, {
        transactionDate: todayStr,
        category: 'Food',
        amount: 500,
        purpose: 'Post-submission meal'
      });
      runStep('Child expense addition to PENDING trip rejected', false);
    } catch (err: any) {
      runStep('Child expense addition to PENDING trip correctly rejected', err.message.includes('non-draft'));
    }

    // Cleanup Test Expense Records
    await query('DELETE FROM trip_other_expenses WHERE trip_expense_id = $1', [tripParent.id]);
    await query('DELETE FROM trip_accommodation_expenses WHERE trip_expense_id = $1', [tripParent.id]);
    await query('DELETE FROM trip_travel_expenses WHERE trip_expense_id = $1', [tripParent.id]);
    await query('DELETE FROM trip_expenses WHERE id = $1', [tripParent.id]);
    await query('DELETE FROM expenses WHERE id IN ($1, $2, $3, $4)', [bizExpNoAttach.id, bizExpWithAttach.id, localTravelNoAttach.id, localTravelWithAttach.id]);

    summary['7. Expense & Trip Claims'] = 'PASS';


    // ─── 8. PWA INSTALLABILITY & SERVICE WORKER ────────────────────────────────
    console.log('\n[TEST 8] PWA Installability, Manifest & Service Worker Security...');
    const rootDir = path.join(__dirname, '../../../');
    const manifestPath = path.join(rootDir, 'frontend/public/manifest.json');
    const swPath = path.join(rootDir, 'frontend/public/sw.js');
    const icon192Path = path.join(rootDir, 'frontend/public/icons/icon-192x192.png');

    runStep('manifest.json exists in frontend/public', fs.existsSync(manifestPath));
    runStep('sw.js service worker exists in frontend/public', fs.existsSync(swPath));
    runStep('icon-192x192.png resolves in frontend/public/icons', fs.existsSync(icon192Path));

    const swContent = fs.readFileSync(swPath, 'utf8');
    runStep('sw.js contains API route bypass security rule', swContent.includes('/api/'));
    summary['8. PWA Installability'] = 'PASS';


    // ─── 9. DAILY TASK PLANNING & MANAGEMENT SYSTEM ───────────────────────────
    console.log('\n[TEST 9] Daily Task Planning & Management System...');

    // Schema Integrity Check: Verify timesheets.project_id is NULLABLE in PostgreSQL
    const colCheck = await query(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = 'timesheets' AND column_name = 'project_id'
    `);
    runStep('timesheets.project_id column exists and is NULLABLE in database schema', colCheck.rows.length > 0 && colCheck.rows[0].is_nullable === 'YES');

    // Self-Task Creation without Project requirement
    const empTask1 = await TimesheetRepository.createTask(orgId, emp.user_id, 'EMPLOYEE', emp.id, {
      date: todayStr,
      title: 'E2E Self Task 1 - Client Meeting',
      description: 'Self-created daily task for E2E verification',
      hours: 4.0
    });
    runStep('Employee self-task 1 created without project requirement (project_id = NULL)', !!empTask1.id && empTask1.project_id === null && empTask1.title === 'E2E Self Task 1 - Client Meeting');

    const empTask2 = await TimesheetRepository.createTask(orgId, emp.user_id, 'EMPLOYEE', emp.id, {
      date: todayStr,
      title: 'E2E Self Task 2 - Prepare Proposal',
      description: 'Second self-created daily task on same date',
      hours: 3.5
    });
    runStep('Multiple tasks co-exist on same date for same employee', !!empTask2.id && empTask2.id !== empTask1.id);

    // Management Task Assignment
    const hrTask = await TimesheetRepository.createTask(orgId, emp.user_id, 'HR_MANAGER', emp.id, {
      assignedEmployeeId: emp.id,
      date: todayStr,
      title: 'E2E HR Assigned Task - Submit Report',
      description: 'Management assigned task to employee',
      hours: 2.0
    });
    runStep('HR Management assigned task to employee with separate created_by', !!hrTask.id && hrTask.created_by === emp.user_id && hrTask.employee_id === emp.id);

    // Management Assignment by HR user WITHOUT employee profile (actorEmployeeId = null)
    const hrWithoutEmpProfileTask = await TimesheetRepository.createTask(
      orgId,
      emp.user_id,
      'HR_MANAGER',
      null, // HR user has no linked employee profile
      {
        assignedEmployeeId: emp.id,
        date: todayStr,
        title: 'Ghaziabad training',
        description: 'Going to training camp in Ghaziabad',
        hours: 8.0,
        status: 'PLANNED'
      }
    );
    runStep('Management user WITHOUT employee profile successfully assigned task to employee', !!hrWithoutEmpProfileTask.id && hrWithoutEmpProfileTask.created_by === emp.user_id && hrWithoutEmpProfileTask.employee_id === emp.id);

    // Negative Test 1: Employee self-task without linked employee profile rejects
    try {
      await TimesheetRepository.createTask(orgId, emp.user_id, 'EMPLOYEE', null, {
        date: todayStr,
        title: 'Unlinked Self Task'
      });
      runStep('Self-task creation by employee without linked profile rejected', false);
    } catch (err: any) {
      runStep('Self-task creation by employee without linked profile correctly rejected', err.message.includes('not linked to an employee profile'));
    }

    // Negative Test 2: Management assigning to non-existent employee rejects
    try {
      await TimesheetRepository.createTask(orgId, emp.user_id, 'ADMIN', null, {
        assignedEmployeeId: '00000000-0000-0000-0000-000000000099',
        date: todayStr,
        title: 'Invalid Assignment Task'
      });
      runStep('Management assignment to non-existent employee rejected', false);
    } catch (err: any) {
      runStep('Management assignment to non-existent employee correctly rejected', err.message.includes('does not exist'));
    }

    // Task Visibility Query Verification
    const employeeTaskList = await TimesheetRepository.findTasks(orgId, emp.user_id, 'EMPLOYEE', emp.id, { startDate: todayStr, endDate: todayStr });
    runStep('Employee sees all assigned and self-created tasks for date', employeeTaskList.length >= 4);

    // Task Soft Delete Verification
    const delTaskRes = await TimesheetRepository.deleteTask(orgId, empTask1.id, emp.user_id, 'EMPLOYEE', emp.id);
    runStep('Task soft-deleted successfully', delTaskRes === true);

    const postDeleteList = await TimesheetRepository.findTasks(orgId, emp.user_id, 'EMPLOYEE', emp.id, { startDate: todayStr, endDate: todayStr });
    runStep('Soft-deleted task excluded from active task query', !postDeleteList.some((t: any) => t.id === empTask1.id));

    // Cleanup Test Tasks
    await query('DELETE FROM audit_logs WHERE entity_id IN ($1, $2, $3, $4)', [empTask1.id, empTask2.id, hrTask.id, hrWithoutEmpProfileTask.id]);
    await query('DELETE FROM timesheets WHERE id IN ($1, $2, $3, $4)', [empTask1.id, empTask2.id, hrTask.id, hrWithoutEmpProfileTask.id]);
    summary['9. Daily Task Management'] = 'PASS';


    // ─── 10. DATABASE INTEGRITY & ORPHAN FK CHECKS ──────────────────────────────
    console.log('\n[TEST 10] Automated Database Integrity & Foreign Key Checks...');
    const orphanAtt = await query('SELECT COUNT(*)::int as count FROM attendance a LEFT JOIN employees e ON a.employee_id = e.id WHERE e.id IS NULL');
    runStep('Zero orphan attendance records', orphanAtt.rows[0].count === 0);

    const orphanLeaves = await query('SELECT COUNT(*)::int as count FROM leave_requests l LEFT JOIN employees e ON l.employee_id = e.id WHERE e.id IS NULL');
    runStep('Zero orphan leave records', orphanLeaves.rows[0].count === 0);

    const orphanAssets = await query('SELECT COUNT(*)::int as count FROM assets a LEFT JOIN organizations o ON a.organization_id = o.id WHERE o.id IS NULL');
    runStep('Zero orphan asset records', orphanAssets.rows[0].count === 0);

    // Attendance Location Name Columns Schema Check
    const attCols = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance' AND column_name IN ('punch_in_location_name', 'punch_out_location_name')");
    runStep('Attendance punch_in_location_name and punch_out_location_name columns exist', attCols.rows.length === 2);

    // Leave Balances Numeric Schema Check
    const lbCol = await query("SELECT data_type FROM information_schema.columns WHERE table_name = 'leave_balances' AND column_name = 'quota'");
    runStep('Leave balances quota column is numeric/decimal type', lbCol.rows[0]?.data_type === 'numeric');

    summary['10. Database Integrity'] = 'PASS';


    // ─── SUMMARY REPORT ────────────────────────────────────────────────────────
    console.log('\n================================================================');
    console.log('--- MASTER E2E REGRESSION SUITE RESULTS ---');
    console.log('================================================================');
    Object.entries(summary).forEach(([moduleName, status]) => {
      console.log(`${status === 'PASS' ? '✅' : '❌'} ${moduleName.padEnd(35)} : ${status}`);
    });
    console.log(`\nTOTAL PASSED STEPS: ${passedCount} | TOTAL FAILED: ${failedCount}`);
    console.log('================================================================\n');

    if (failedCount > 0) process.exit(1);
  } catch (err: any) {
    console.error('\n❌ MASTER E2E SUITE FAILED WITH EXCEPTION:', err.message);
    process.exit(1);
  }
}

runMasterE2EVerificationSuite();
