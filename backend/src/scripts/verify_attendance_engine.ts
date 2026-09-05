import { AttendanceStatusService } from '../services/attendanceStatusService';
import { AttendanceReconciliationService } from '../services/attendanceReconciliationService';
import { AttendanceRepository } from '../repositories/attendanceRepository';
import { query } from '../db';

async function runAttendanceVerificationSuite() {
  console.log('====================================================');
  console.log('STARTING ATTENDANCE STATUS ENGINE & WORKFLOW SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  function skip(testName: string, reason: string) {
    console.log(`⚠️ SKIPPED: ${testName} (${reason})`);
    skipped++;
  }

  // ----------------------------------------------------
  // TESTS 1–16: CORE ATTENDANCE ENGINE & HOLIDAY RULES
  // ----------------------------------------------------

  // 1. Punctuality Category Exact Boundaries
  assert(AttendanceStatusService.getPunctualityCategory('2026-09-01T09:14:59+05:30') === 'PRESENT', 'Test 1a: 09:14:59 is PRESENT');
  assert(!AttendanceStatusService.isCheckInLate('2026-09-01T09:14:59+05:30'), 'Test 1b: 09:14:59 is NOT late');

  assert(AttendanceStatusService.getPunctualityCategory('2026-09-01T09:15:00+05:30') === 'LATE_PRESENT', 'Test 2a: 09:15:00 is LATE CHECK-IN');
  assert(AttendanceStatusService.isCheckInLate('2026-09-01T09:15:00+05:30'), 'Test 2b: 09:15:00 IS late');

  assert(AttendanceStatusService.getPunctualityCategory('2026-09-01T09:20:00+05:30') === 'LATE_PRESENT', 'Test 3a: 09:20:00 is LATE CHECK-IN');
  assert(AttendanceStatusService.getPunctualityCategory('2026-09-01T09:29:59+05:30') === 'LATE_PRESENT', 'Test 3b: 09:29:59 is LATE CHECK-IN');

  assert(AttendanceStatusService.getPunctualityCategory('2026-09-01T09:30:00+05:30') === 'SHORT_LEAVE', 'Test 4a: 09:30:00 is SHORT LEAVE');
  assert(AttendanceStatusService.getPunctualityCategory('2026-09-01T10:30:00+05:30') === 'SHORT_LEAVE', 'Test 4b: 10:30:00 is SHORT LEAVE');
  assert(AttendanceStatusService.getPunctualityCategory('2026-09-01T10:59:59+05:30') === 'SHORT_LEAVE', 'Test 4c: 10:59:59 is SHORT LEAVE');

  assert(AttendanceStatusService.getPunctualityCategory('2026-09-01T11:00:00+05:30') === 'HALF_DAY', 'Test 4d: 11:00:00 is HALF DAY');
  assert(AttendanceStatusService.getPunctualityCategory('2026-09-01T12:59:59+05:30') === 'HALF_DAY', 'Test 4e: 12:59:59 is HALF DAY');

  assert(AttendanceStatusService.getPunctualityCategory('2026-09-01T13:00:00+05:30') === 'ABSENT', 'Test 4f: 13:00:00 is ABSENT');

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
  assert(res8h.status === 'PRESENT', 'Test 5: 8.0h completed duration => PRESENT');

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
  assert(res7h.status === 'EARLY CHECKOUT', 'Test 6: 7.0h completed duration => EARLY CHECKOUT');

  // 7. Late check-in + < 8h => LATE PRESENT / EARLY CHECKOUT
  const resLateEarly = AttendanceStatusService.resolveDayStatus({
    dateStr: '2026-09-01',
    todayStr: '2026-09-03',
    sessions: [{
      id: 's1',
      organization_id: 'org1',
      employee_id: 'emp1',
      date: '2026-09-01',
      check_in: '2026-09-01T09:15:00+05:30',
      check_out: '2026-09-01T16:15:00+05:30',
      working_hours: 7.0
    }]
  });
  assert(resLateEarly.status === 'LATE PRESENT / EARLY CHECKOUT', 'Test 7: Late check-in + <8h => LATE PRESENT / EARLY CHECKOUT');

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
  assert(resMulti.status === 'PRESENT' && resMulti.totalWorkingHours === 8.0, 'Test 8: Multi-session accumulated 8.0h => PRESENT');

  // 9. Past unclosed session (EOD reconciliation status) => ABSENT + REGULARIZATION_REQUIRED, check_out = NULL
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
  assert(resUnclosedPast.status === 'ABSENT' && resUnclosedPast.sessionState === 'REGULARIZATION_REQUIRED', 'Test 9: Unclosed past session => status ABSENT, sessionState REGULARIZATION_REQUIRED');

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
  assert(resTodayActive.status === 'ACTIVE', 'Test 10: Today unclosed session => status ACTIVE');

  // 11. Sunday => HOLIDAY
  const holSun = AttendanceStatusService.getCalendarHolidayName('2026-09-06'); // Sept 6, 2026 is Sunday
  assert(holSun === 'Sunday', 'Test 11: Sunday correctly identified as HOLIDAY');

  // 12. 2nd Saturday => HOLIDAY
  const hol2Sat = AttendanceStatusService.getCalendarHolidayName('2026-09-12'); // Sept 12, 2026 is 2nd Saturday
  assert(hol2Sat === '2nd Saturday', 'Test 12: 2nd Saturday correctly identified as HOLIDAY');

  // 13. 4th Saturday => HOLIDAY
  const hol4Sat = AttendanceStatusService.getCalendarHolidayName('2026-09-26'); // Sept 26, 2026 is 4th Saturday
  assert(hol4Sat === '4th Saturday', 'Test 13: 4th Saturday correctly identified as HOLIDAY');

  // 14. 1st / 3rd Saturday => Working day
  const hol1Sat = AttendanceStatusService.getCalendarHolidayName('2026-09-05'); // Sept 5, 2026 is 1st Saturday
  assert(hol1Sat === null, 'Test 14: 1st Saturday is a working day (not holiday)');

  // 15. Working day without attendance => ABSENT
  const resNoPunch = AttendanceStatusService.resolveDayStatus({
    dateStr: '2026-09-01', // Tuesday
    todayStr: '2026-09-03',
    sessions: []
  });
  assert(resNoPunch.status === 'ABSENT' && resNoPunch.canRegularize === true, 'Test 15: Working day with no punch => ABSENT + Regularize');

  // 16. Sunday without attendance => HOLIDAY (not ABSENT)
  const resSunNoPunch = AttendanceStatusService.resolveDayStatus({
    dateStr: '2026-09-06', // Sunday
    todayStr: '2026-09-03',
    sessions: []
  });
  assert(resSunNoPunch.status === 'HOLIDAY', 'Test 16: Sunday without punch => HOLIDAY (not ABSENT)');

  // ----------------------------------------------------
  // REPOSITORY & INTEGRATION TESTS 17–25 (UNISOLATED TRY/CATCH)
  // ----------------------------------------------------

  let orgId: string | null = null;

  try {
    const orgRes = await query(`SELECT id FROM organizations LIMIT 1`);
    if (orgRes.rows.length > 0) {
      orgId = orgRes.rows[0].id;
    }
  } catch (err: any) {
    orgId = null;
  }

  // TEST 17: EOD RECONCILIATION JOB EXECUTION
  try {
    if (orgId) {
      const reconResult = await AttendanceReconciliationService.reconcileUnclosedSessions();
      assert(typeof reconResult.reconciledCount === 'number', 'Test 17: EOD Reconciliation Service executed successfully');
    } else {
      skip('Test 17: EOD Reconciliation Service', 'Database connection unavailable');
    }
  } catch (e: any) {
    assert(false, 'Test 17: EOD Reconciliation Service', e.message);
  }

  // TEST 18: COMPLETE ABSENT GRID
  try {
    if (orgId) {
      const gridSep = await AttendanceRepository.findAll(orgId, { year: 2026, month: 9 });
      const synthAbsentRec = gridSep.attendance.find((a: any) => a.isSynthesized === true && (a.status === 'ABSENT' || a.status === 'ABSENT → Regularize'));
      const isAbsentValid = synthAbsentRec &&
        synthAbsentRec.check_in === null &&
        synthAbsentRec.check_out === null &&
        Number(synthAbsentRec.working_hours || 0) === 0 &&
        synthAbsentRec.canRegularize === true;
      assert(!!isAbsentValid, 'Test 18: Complete Absent Grid (synthesized working day record has status ABSENT, null check-in/out, 0h, canRegularize true)');
    } else {
      skip('Test 18: Complete Absent Grid', 'Database connection unavailable');
    }
  } catch (e: any) {
    assert(false, 'Test 18: Complete Absent Grid', e.message);
  }

  // TEST 19: SUNDAY MISSING ATTENDANCE GENERATES HOLIDAY
  try {
    if (orgId) {
      const gridSep = await AttendanceRepository.findAll(orgId, { year: 2026, month: 9 });
      const sunRec = gridSep.attendance.find((a: any) => a.date === '2026-09-06');
      assert(sunRec && sunRec.status === 'HOLIDAY', 'Test 19: Sunday in repository grid resolves to HOLIDAY (not ABSENT)');
    } else {
      skip('Test 19: Sunday Missing Attendance', 'Database connection unavailable');
    }
  } catch (e: any) {
    assert(false, 'Test 19: Sunday Missing Attendance', e.message);
  }

  // TEST 20: 2ND SATURDAY HOLIDAY
  try {
    if (orgId) {
      const gridSep = await AttendanceRepository.findAll(orgId, { year: 2026, month: 9 });
      const sat2Rec = gridSep.attendance.find((a: any) => a.date === '2026-09-12');
      assert(sat2Rec && sat2Rec.status === 'HOLIDAY', 'Test 20: 2nd Saturday in repository grid resolves to HOLIDAY');
    } else {
      skip('Test 20: 2nd Saturday Holiday', 'Database connection unavailable');
    }
  } catch (e: any) {
    assert(false, 'Test 20: 2nd Saturday Holiday', e.message);
  }

  // TEST 21: 4TH SATURDAY HOLIDAY
  try {
    if (orgId) {
      const gridSep = await AttendanceRepository.findAll(orgId, { year: 2026, month: 9 });
      const sat4Rec = gridSep.attendance.find((a: any) => a.date === '2026-09-26');
      assert(sat4Rec && sat4Rec.status === 'HOLIDAY', 'Test 21: 4th Saturday in repository grid resolves to HOLIDAY');
    } else {
      skip('Test 21: 4th Saturday Holiday', 'Database connection unavailable');
    }
  } catch (e: any) {
    assert(false, 'Test 21: 4th Saturday Holiday', e.message);
  }

  // TEST 22: DELETED EMPLOYEE EXCLUSION (Hard Deletion + ON DELETE SET NULL)
  try {
    if (orgId) {
      let deletedHistoricalAtt: any = { rows: [] };
      try {
        deletedHistoricalAtt = await query(
          `SELECT id, employee_name_snapshot, employee_code_snapshot
           FROM attendance
           WHERE organization_id = $1 AND employee_id IS NULL AND (employee_name_snapshot IS NOT NULL OR employee_code_snapshot IS NOT NULL)
           LIMIT 1`,
          [orgId]
        );
      } catch {
        deletedHistoricalAtt = { rows: [] };
      }
      if (deletedHistoricalAtt.rows.length > 0) {
        const gridSep = await AttendanceRepository.findAll(orgId, { year: 2026, month: 9 });
        const snapshotName = deletedHistoricalAtt.rows[0].employee_name_snapshot;
        const nullEmpInGrid = gridSep.attendance.some((a: any) => a.employee_id === null || (snapshotName && a.employee_name === snapshotName && a.employee_id === undefined));
        assert(!nullEmpInGrid, `Test 22: Historical attendance of physically deleted employee (${snapshotName}) is excluded from current AttendanceRepository grid`);
      } else {
        skip('Test 22: Deleted Employee Exclusion', 'Deleted employee historical fixture unavailable');
      }
    } else {
      skip('Test 22: Deleted Employee Exclusion', 'Database connection unavailable');
    }
  } catch (e: any) {
    assert(false, 'Test 22: Deleted Employee Exclusion', e.message);
  }

  // TEST 23: SUMMARY COUNTS VERIFICATION
  try {
    if (orgId) {
      const gridSep = await AttendanceRepository.findAll(orgId, { year: 2026, month: 9 });
      const uniqueDayMap = new Map<string, string>();
      gridSep.attendance.forEach((a: any) => {
        const key = `${a.employee_id}_${a.date}`;
        if (!uniqueDayMap.has(key)) {
          uniqueDayMap.set(key, a.status);
        }
      });

      let expectedPresent = 0;
      let expectedAbsent = 0;
      uniqueDayMap.forEach((status) => {
        if (['PRESENT', 'LATE PRESENT', 'EARLY CHECKOUT', 'LATE PRESENT / EARLY CHECKOUT', 'ACTIVE'].includes(status)) {
          expectedPresent++;
        } else if (status === 'ABSENT' || status === 'ABSENT → Regularize' || status.startsWith('ABSENT')) {
          expectedAbsent++;
        }
      });
      const summaryMatch = gridSep.summary && gridSep.summary.totalPresentDays === expectedPresent && gridSep.summary.totalAbsentDays === expectedAbsent;
      assert(summaryMatch, `Test 23: Summary Counts Match Grid (Expected Present: ${expectedPresent}, Got: ${gridSep.summary?.totalPresentDays}; Expected Absent: ${expectedAbsent}, Got: ${gridSep.summary?.totalAbsentDays})`);
    } else {
      skip('Test 23: Summary Counts Verification', 'Database connection unavailable');
    }
  } catch (e: any) {
    assert(false, 'Test 23: Summary Counts Verification', e.message);
  }

  // TEST 24: SELECTED MONTH ISOLATION (September vs August)
  try {
    if (orgId) {
      const gridSep = await AttendanceRepository.findAll(orgId, { year: 2026, month: 9 });
      const sepDates = gridSep.attendance.map((a: any) => typeof a.date === 'string' ? a.date.split('T')[0] : a.date);
      const allSepValid = sepDates.every((d: string) => d >= '2026-09-01' && d <= '2026-09-30');
      const noAugInSep = sepDates.every((d: string) => !d.startsWith('2026-08'));

      const gridAug = await AttendanceRepository.findAll(orgId, { year: 2026, month: 8 });
      const augDates = gridAug.attendance.map((a: any) => typeof a.date === 'string' ? a.date.split('T')[0] : a.date);
      const allAugValid = augDates.every((d: string) => d.startsWith('2026-08'));

      assert(allSepValid && noAugInSep && allAugValid && sepDates.length > 0, 'Test 24: Selected Month Isolation (Sep 2026 has strictly Sep dates, Aug has strictly Aug dates)');
    } else {
      skip('Test 24: Selected Month Isolation', 'Database connection unavailable');
    }
  } catch (e: any) {
    assert(false, 'Test 24: Selected Month Isolation', e.message);
  }

  // TEST 25: MULTI-SESSION SINGLE EMPLOYEE-DAY
  const resMultiSingleDay = AttendanceStatusService.resolveDayStatus({
    dateStr: '2026-09-01',
    todayStr: '2026-09-03',
    sessions: [
      { id: '1', organization_id: 'o', employee_id: 'e', date: '2026-09-01', check_in: '2026-09-01T09:00:00+05:30', check_out: '2026-09-01T13:00:00+05:30', working_hours: 4.0 },
      { id: '2', organization_id: 'o', employee_id: 'e', date: '2026-09-01', check_in: '2026-09-01T14:00:00+05:30', check_out: '2026-09-01T18:00:00+05:30', working_hours: 4.0 }
    ]
  });
  assert(resMultiSingleDay.status === 'PRESENT' && resMultiSingleDay.totalWorkingHours === 8.0, 'Test 25: Multi-session on a single day resolves to 1 employee-day with 8.0h status PRESENT');

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED, ${skipped} SKIPPED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAttendanceVerificationSuite();
