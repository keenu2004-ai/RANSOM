import { AttendanceStatusService } from '../services/attendanceStatusService';
import { AttendanceReconciliationService } from '../services/attendanceReconciliationService';
import { query } from '../db';

async function runAttendanceVerificationSuite() {
  console.log('====================================================');
  console.log('STARTING ATTENDANCE STATUS ENGINE & WORKFLOW SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${testName} - ${detail || ''}`);
      failed++;
    }
  }

  // 1. 09:00 AM Check-In Punctuality
  const lateAt0900 = AttendanceStatusService.isCheckInLate('2026-09-01T09:00:00+05:30');
  assert(!lateAt0900, 'Test 1: 09:00 AM check-in is NOT late (PRESENT)');

  // 2. 09:15 AM Check-In Punctuality (Grace Period Limit)
  const lateAt0915 = AttendanceStatusService.isCheckInLate('2026-09-01T09:15:00+05:30');
  assert(!lateAt0915, 'Test 2: 09:15 AM check-in is NOT late (PRESENT)');

  // 3. 09:16 AM Check-In Punctuality (After Grace Period)
  const lateAt0916 = AttendanceStatusService.isCheckInLate('2026-09-01T09:16:00+05:30');
  assert(lateAt0916, 'Test 3: 09:16 AM check-in IS LATE PRESENT');

  // 4. 10:00 AM Check-In Punctuality
  const lateAt1000 = AttendanceStatusService.isCheckInLate('2026-09-01T10:00:00+05:30');
  assert(lateAt1000, 'Test 4: 10:00 AM check-in IS LATE PRESENT');

  // 5. Completed duration >= 8h => PRESENT (not early checkout)
  const res8h = AttendanceStatusService.resolveDayStatus({
    dateStr: '2026-09-01',
    todayStr: '2026-09-03',
    sessions: [{
      id: 's1',
      organization_id: 'org1',
      employee_id: 'emp1',
      date: '2026-09-01',
      check_in: '2026-09-01T09:00:00+05:30',
      check_out: '2026-09-01T17:00:00+05:30',
      working_hours: 8.0
    }]
  });
  assert(res8h.status === 'PRESENT', 'Test 5: 8.0h completed duration => PRESENT', `Got: ${res8h.status}`);

  // 6. Completed duration < 8h => EARLY CHECKOUT
  const res7h = AttendanceStatusService.resolveDayStatus({
    dateStr: '2026-09-01',
    todayStr: '2026-09-03',
    sessions: [{
      id: 's1',
      organization_id: 'org1',
      employee_id: 'emp1',
      date: '2026-09-01',
      check_in: '2026-09-01T09:00:00+05:30',
      check_out: '2026-09-01T16:00:00+05:30',
      working_hours: 7.0
    }]
  });
  assert(res7h.status === 'EARLY CHECKOUT', 'Test 6: 7.0h completed duration => EARLY CHECKOUT', `Got: ${res7h.status}`);

  // 7. Late check-in + < 8h => LATE PRESENT / EARLY CHECKOUT
  const resLateEarly = AttendanceStatusService.resolveDayStatus({
    dateStr: '2026-09-01',
    todayStr: '2026-09-03',
    sessions: [{
      id: 's1',
      organization_id: 'org1',
      employee_id: 'emp1',
      date: '2026-09-01',
      check_in: '2026-09-01T09:30:00+05:30',
      check_out: '2026-09-01T16:30:00+05:30',
      working_hours: 7.0
    }]
  });
  assert(resLateEarly.status === 'LATE PRESENT / EARLY CHECKOUT', 'Test 7: Late check-in + <8h => LATE PRESENT / EARLY CHECKOUT', `Got: ${resLateEarly.status}`);

  // 8. Multi-session accumulation (4h + 4h = 8h => PRESENT)
  const resMulti = AttendanceStatusService.resolveDayStatus({
    dateStr: '2026-09-01',
    todayStr: '2026-09-03',
    sessions: [
      {
        id: 's1',
        organization_id: 'org1',
        employee_id: 'emp1',
        date: '2026-09-01',
        check_in: '2026-09-01T09:00:00+05:30',
        check_out: '2026-09-01T13:00:00+05:30',
        working_hours: 4.0
      },
      {
        id: 's2',
        organization_id: 'org1',
        employee_id: 'emp1',
        date: '2026-09-01',
        check_in: '2026-09-01T14:00:00+05:30',
        check_out: '2026-09-01T18:00:00+05:30',
        working_hours: 4.0
      }
    ]
  });
  assert(resMulti.status === 'PRESENT' && resMulti.totalWorkingHours === 8.0, 'Test 8: Multi-session accumulated 8.0h => PRESENT', `Got: ${resMulti.status}, totalHours: ${resMulti.totalWorkingHours}`);

  // 9. Past unclosed session (EOD reconciliation) => ABSENT + REGULARIZATION_REQUIRED, check_out = NULL
  const resUnclosedPast = AttendanceStatusService.resolveDayStatus({
    dateStr: '2026-08-31',
    todayStr: '2026-09-03',
    sessions: [{
      id: 's_old',
      organization_id: 'org1',
      employee_id: 'emp1',
      date: '2026-08-31',
      check_in: '2026-08-31T14:38:00+05:30',
      check_out: null,
      working_hours: 0
    }]
  });
  assert(resUnclosedPast.status === 'ABSENT' && resUnclosedPast.sessionState === 'REGULARIZATION_REQUIRED', 'Test 9: Unclosed past session => status ABSENT, sessionState REGULARIZATION_REQUIRED', `Got status: ${resUnclosedPast.status}, sessionState: ${resUnclosedPast.sessionState}`);

  // 10. Today active session => ACTIVE
  const resTodayActive = AttendanceStatusService.resolveDayStatus({
    dateStr: '2026-09-03',
    todayStr: '2026-09-03',
    sessions: [{
      id: 's_today',
      organization_id: 'org1',
      employee_id: 'emp1',
      date: '2026-09-03',
      check_in: '2026-09-03T09:08:00+05:30',
      check_out: null,
      working_hours: 0
    }]
  });
  assert(resTodayActive.status === 'ACTIVE', 'Test 10: Today unclosed session => status ACTIVE', `Got: ${resTodayActive.status}`);

  // 11. Sunday => HOLIDAY
  const holSun = AttendanceStatusService.getCalendarHolidayName('2026-09-06'); // Sept 6, 2026 is Sunday
  assert(holSun === 'Sunday', 'Test 11: Sunday correctly identified as HOLIDAY', `Got: ${holSun}`);

  // 12. 2nd Saturday => HOLIDAY
  const hol2Sat = AttendanceStatusService.getCalendarHolidayName('2026-09-12'); // Sept 12, 2026 is 2nd Saturday
  assert(hol2Sat === '2nd Saturday', 'Test 12: 2nd Saturday correctly identified as HOLIDAY', `Got: ${hol2Sat}`);

  // 13. 4th Saturday => HOLIDAY
  const hol4Sat = AttendanceStatusService.getCalendarHolidayName('2026-09-26'); // Sept 26, 2026 is 4th Saturday
  assert(hol4Sat === '4th Saturday', 'Test 13: 4th Saturday correctly identified as HOLIDAY', `Got: ${hol4Sat}`);

  // 14. 1st / 3rd Saturday => Working day
  const hol1Sat = AttendanceStatusService.getCalendarHolidayName('2026-09-05'); // Sept 5, 2026 is 1st Saturday
  assert(hol1Sat === null, 'Test 14: 1st Saturday is a working day (not holiday)', `Got: ${hol1Sat}`);

  // 15. Working day without attendance => ABSENT
  const resNoPunch = AttendanceStatusService.resolveDayStatus({
    dateStr: '2026-09-01', // Tuesday
    todayStr: '2026-09-03',
    sessions: []
  });
  assert(resNoPunch.status === 'ABSENT' && resNoPunch.canRegularize === true, 'Test 15: Working day with no punch => ABSENT + Regularize', `Got: ${resNoPunch.status}`);

  // 16. Sunday without attendance => HOLIDAY (not ABSENT)
  const resSunNoPunch = AttendanceStatusService.resolveDayStatus({
    dateStr: '2026-09-06', // Sunday
    todayStr: '2026-09-03',
    sessions: []
  });
  assert(resSunNoPunch.status === 'HOLIDAY', 'Test 16: Sunday without punch => HOLIDAY (not ABSENT)', `Got: ${resSunNoPunch.status}`);

  // DB Verification
  try {
    const orgRes = await query(`SELECT id FROM organizations LIMIT 1`);
    if (orgRes.rows.length > 0) {
      const orgId = orgRes.rows[0].id;

      // 17. EOD Reconciliation Job
      const reconResult = await AttendanceReconciliationService.reconcileUnclosedSessions();
      assert(typeof reconResult.reconciledCount === 'number', 'Test 17: EOD Reconciliation Service ran successfully');

      // 18. Database active sessions with missing check_out on past date are status ABSENT & REGULARIZATION_REQUIRED
      const checkUnclosedDb = await query(
        `SELECT id, check_out, status, session_state FROM attendance 
         WHERE organization_id = $1 AND date < CURRENT_DATE AND session_state = 'REGULARIZATION_REQUIRED' LIMIT 5`,
        [orgId]
      );
      for (const row of checkUnclosedDb.rows) {
        assert(row.check_out === null && row.status === 'ABSENT', `Test 18: Unclosed session ${row.id} has check_out NULL and status ABSENT`);
      }
    }
  } catch (err: any) {
    console.warn('DB verification warning (non-fatal):', err.message);
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAttendanceVerificationSuite();
