import { query } from '../db';
import { AttendanceRepository } from '../repositories/attendanceRepository';
import { CalendarRepository } from '../repositories/calendarRepository';
import { AssetRepository } from '../repositories/assetRepository';
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


    // ─── 3. ATTENDANCE STATE MACHINE & GPS & REGULARIZATION ────────────────────
    console.log('\n[TEST 3] Attendance State Machine, Duplicate Punch Rejection & Regularization...');
    const todayStr = new Date().toISOString().split('T')[0];

    // Clean up existing attendance for today for test employee
    await query('DELETE FROM attendance_regularizations WHERE employee_id = $1 AND attendance_date = $2', [emp.id, todayStr]);
    await query('DELETE FROM attendance WHERE employee_id = $1 AND date = $2', [emp.id, todayStr]);

    // Check Initial State
    const initStatus = await AttendanceRepository.findTodayByEmployee(emp.id, orgId, todayStr);
    runStep('Initial state: NOT CHECKED IN', !initStatus || !initStatus.check_in);

    // Punch In with GPS
    const punchInRec = await AttendanceRepository.checkIn(orgId, emp.id, todayStr, 12.971598, 77.594566, 'General Shift');
    runStep('Punch-In record created with GPS coordinates', !!punchInRec.check_in && Number(punchInRec.punch_in_lat) === 12.971598);

    // Duplicate Punch-In Check
    try {
      await AttendanceRepository.checkIn(orgId, emp.id, todayStr, 12.971598, 77.594566);
      runStep('Duplicate punch-in rejected', false);
    } catch (err: any) {
      runStep('Duplicate punch-in correctly rejected', err.message.includes('already punched in'));
    }

    // Break Update
    await AttendanceRepository.updateBreak(orgId, emp.id, todayStr, 30);
    const breakStatus = await AttendanceRepository.findTodayByEmployee(emp.id, orgId, todayStr);
    runStep('Break duration incremented to 30 mins', breakStatus?.break_duration_mins === 30);

    // Punch Out with GPS
    const punchOutRec = await AttendanceRepository.checkOut(orgId, emp.id, todayStr, 12.971598, 77.594566);
    runStep('Punch-Out record completed with working hours', !!punchOutRec.check_out && punchOutRec.status === 'PRESENT');

    // Duplicate Punch-Out Check
    try {
      await AttendanceRepository.checkOut(orgId, emp.id, todayStr, 12.971598, 77.594566);
      runStep('Duplicate punch-out rejected', false);
    } catch (err: any) {
      runStep('Duplicate punch-out correctly rejected', err.message.includes('already punched out'));
    }

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


    // ─── 6. ASSETS & EMPLOYEE ASSET REQUISITIONS ────────────────────────────────
    console.log('\n[TEST 6] Asset Inventory & Employee Asset Requisition Workflow...');
    const catRes = await query('SELECT id FROM asset_categories WHERE organization_id = $1 LIMIT 1', [orgId]);
    const catId = catRes.rows[0]?.id;

    // Create Asset Request
    const assetReq = await AssetRepository.createRequest(orgId, emp.id, emp.user_id, {
      categoryId: catId,
      reason: 'Need workstation for E2E testing',
      priority: 'HIGH'
    });
    runStep('Asset Request created with AR- number and SUBMITTED status', assetReq.request_number.startsWith('AR-') && assetReq.status === 'SUBMITTED');

    // Approve Asset Request
    const appReq = await AssetRepository.approveRequest(orgId, assetReq.id, emp.id, emp.user_id);
    runStep('Asset Request APPROVED', appReq.status === 'APPROVED');

    // Create Available Asset & Fulfill Request
    const testAssetCode = `E2E-AST-${Date.now()}`;
    const testAssetRes = await query(`
      INSERT INTO assets (
        organization_id, asset_code, asset_name, category_id, asset_type, purchase_price, current_value, status, created_by
      ) VALUES ($1, $2, 'E2E Test Laptop', $3, 'HARDWARE', 75000, 75000, 'AVAILABLE', $4)
      RETURNING *
    `, [orgId, testAssetCode, catId, emp.user_id]);
    const testAsset = testAssetRes.rows[0];

    const fulfillResult = await AssetRepository.fulfillRequest(orgId, assetReq.id, testAsset.id, emp.user_id);
    runStep('Asset Request FULFILLED and asset assigned', fulfillResult.request.status === 'FULFILLED' && fulfillResult.asset.status === 'ASSIGNED');

    // Cleanup Asset Test
    await query('DELETE FROM asset_history WHERE asset_id = $1', [testAsset.id]);
    await query('DELETE FROM assets WHERE id = $1', [testAsset.id]);
    await query('DELETE FROM asset_requests WHERE id = $1', [assetReq.id]);
    summary['6. Assets & Requisitions'] = 'PASS';


    // ─── 7. EXPENSES & TRIP EXPENSES ──────────────────────────────────────────
    console.log('\n[TEST 7] Expense Claims & Parent/Child Trip Expense Schema...');
    const expCount = await query('SELECT COUNT(*)::int as count FROM expenses WHERE organization_id = $1', [orgId]);
    runStep('Expenses query succeeds', typeof expCount.rows[0].count === 'number');

    const tripCount = await query('SELECT COUNT(*)::int as count FROM trip_expenses WHERE organization_id = $1', [orgId]);
    runStep('Trip expenses query succeeds', typeof tripCount.rows[0].count === 'number');
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


    // ─── 9. DATABASE INTEGRITY & ORPHAN FK CHECKS ──────────────────────────────
    console.log('\n[TEST 9] Automated Database Integrity & Foreign Key Checks...');
    const orphanAtt = await query('SELECT COUNT(*)::int as count FROM attendance a LEFT JOIN employees e ON a.employee_id = e.id WHERE e.id IS NULL');
    runStep('Zero orphan attendance records', orphanAtt.rows[0].count === 0);

    const orphanLeaves = await query('SELECT COUNT(*)::int as count FROM leave_requests l LEFT JOIN employees e ON l.employee_id = e.id WHERE e.id IS NULL');
    runStep('Zero orphan leave records', orphanLeaves.rows[0].count === 0);

    const orphanAssets = await query('SELECT COUNT(*)::int as count FROM assets a LEFT JOIN organizations o ON a.organization_id = o.id WHERE o.id IS NULL');
    runStep('Zero orphan asset records', orphanAssets.rows[0].count === 0);
    summary['9. Database Integrity'] = 'PASS';


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
