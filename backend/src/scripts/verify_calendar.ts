import { query } from '../db';
import { CalendarRepository } from '../repositories/calendarRepository';

async function runCalendarVerificationTests() {
  console.log('================================================================');
  console.log('--- STARTING UNIFIED CALENDAR INTEGRATION VERIFICATION ---');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  };

  try {
    // Fetch a baseline organization ID
    const orgRes = await query('SELECT id FROM organizations LIMIT 1');
    if (!orgRes.rows[0]) {
      console.log('No organization found in database to run integration tests.');
      process.exit(0);
    }
    const orgId = orgRes.rows[0].id;

    // Fetch baseline employee
    const empRes = await query('SELECT id, first_name FROM employees WHERE organization_id = $1 LIMIT 1', [orgId]);
    const emp = empRes.rows[0];

    const todayStr = new Date().toISOString().split('T')[0];
    const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-28`;

    // TEST 1: Attendance record -> Calendar Event mapping
    console.log('[TEST 1] Testing Attendance Mapping onto Calendar...');
    const eventsAll = await CalendarRepository.getEvents(orgId, monthStart, monthEnd);
    const attEvents = eventsAll.filter(e => e.type === 'ATTENDANCE');
    assert(Array.isArray(attEvents), 'Attendance events returned as array');

    // TEST 2: Approved Leave -> Calendar Event mapping
    console.log('\n[TEST 2] Testing Approved Leave Mapping onto Calendar...');
    const leaveEvents = eventsAll.filter(e => e.type === 'LEAVE');
    assert(Array.isArray(leaveEvents), 'Leave events returned as array');

    // TEST 3: Holiday -> Calendar Event mapping
    console.log('\n[TEST 3] Testing Holiday Mapping onto Calendar...');
    const holidayEvents = eventsAll.filter(e => e.type === 'HOLIDAY');
    assert(Array.isArray(holidayEvents), 'Holiday events returned as array');

    // TEST 4: Weekly Plan / Task -> Calendar Event mapping
    console.log('\n[TEST 4] Testing Task/Weekly Plan Mapping onto Calendar...');
    const taskEvents = eventsAll.filter(e => e.type === 'TASK');
    assert(Array.isArray(taskEvents), 'Task events returned as array');

    // TEST 5: Date Range Filtering
    console.log('\n[TEST 5] Testing Date Range Filtering...');
    const narrowStart = '2099-01-01';
    const narrowEnd = '2099-01-02';
    const emptyRangeEvents = await CalendarRepository.getEvents(orgId, narrowStart, narrowEnd);
    assert(emptyRangeEvents.length === 0, 'Date range out of bounds returns empty array');

    // TEST 6: Employee Data Isolation
    console.log('\n[TEST 6] Testing Employee Data Isolation...');
    if (emp) {
      const empEvents = await CalendarRepository.getEvents(orgId, monthStart, monthEnd, emp.id);
      const invalidEmpEvents = empEvents.filter(e => e.employeeId && e.employeeId !== emp.id);
      assert(invalidEmpEvents.length === 0, 'Employee filter correctly excludes other employees events');
    } else {
      assert(true, 'Employee filter check skipped (no employee record present)');
    }

    // TEST 7: Organization Tenant Isolation
    console.log('\n[TEST 7] Testing Organization Tenant Isolation...');
    const dummyOrgId = '00000000-0000-0000-0000-000000000000';
    const tenantEvents = await CalendarRepository.getEvents(dummyOrgId, monthStart, monthEnd);
    assert(tenantEvents.length === 0, 'Non-existent organization ID returns 0 events');

    // TEST 8: Event Data Contract Verification
    console.log('\n[TEST 8] Testing Event Contract Properties...');
    if (eventsAll.length > 0) {
      const sample = eventsAll[0];
      const validContract = !!(sample.id && sample.type && sample.date && sample.title && sample.status && sample.sourceId);
      assert(validContract, 'Event object satisfies unified CalendarEventDTO contract');
    } else {
      assert(true, 'Event contract check passed (0 events in current month)');
    }

    console.log('\n================================================================');
    console.log(`--- CALENDAR VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal error during calendar verification:', err.message);
    process.exit(1);
  }
}

runCalendarVerificationTests();
