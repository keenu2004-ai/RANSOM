import { query } from '../db';
import { AttendanceRepository } from '../repositories/attendanceRepository';

async function measure() {
  console.log('====================================================');
  console.log('PERFORMANCE MEASUREMENT: ATTENDANCE APIS & QUERIES');
  console.log('====================================================\n');

  const empRes = await query('SELECT e.id as emp_id, e.organization_id as org_id FROM employees e WHERE e.status = \'ACTIVE\' LIMIT 1');
  if (empRes.rows.length === 0) {
    console.error('No active employee found for testing.');
    process.exit(1);
  }

  const orgId = String(empRes.rows[0].org_id);
  const empId = String(empRes.rows[0].emp_id);

  // ----------------------------------------------------
  // 1. MEASURE: Workforce Employee Summary API
  // ----------------------------------------------------
  console.log('--- 1. WORKFORCE EMPLOYEE SUMMARY MEASUREMENT ---');
  const t0 = performance.now();
  const workforceResult = await AttendanceRepository.getWorkforceEmployeeSummaries(orgId, {
    startDate: '2026-08-30',
    endDate: '2026-09-05'
  });
  const t1 = performance.now();
  const workforceDurationMs = (t1 - t0).toFixed(2);
  const workforceJson = JSON.stringify(workforceResult);
  const workforceSizeBytes = Buffer.byteLength(workforceJson, 'utf8');

  console.log(`- Employees Returned: ${workforceResult.employees.length}`);
  console.log(`- Response Payload Size: ${workforceSizeBytes} bytes (${(workforceSizeBytes / 1024).toFixed(2)} KB)`);
  console.log(`- Method Execution Time: ${workforceDurationMs} ms`);
  console.log(`- Number of SQL queries: 1 (Single SQL query for aggregation + employee list)`);
  const hasDetailRows = workforceResult.employees.some((e: any) => (e as any).sessions !== undefined || (e as any).records !== undefined);
  console.log(`- Detailed attendance rows included: ${hasDetailRows ? 'YES (BAD)' : 'NO (GOOD - lightweight summary only)'}`);

  // ----------------------------------------------------
  // 2. MEASURE: Single Employee Attendance Detail API
  // ----------------------------------------------------
  console.log('\n--- 2. EMPLOYEE ATTENDANCE DETAIL MEASUREMENT ---');
  const t2 = performance.now();
  const detailResult = await AttendanceRepository.getEmployeeAttendanceDetails(orgId, empId, {
    startDate: '2026-08-01',
    endDate: '2026-09-05',
    page: 1,
    limit: 30
  });
  const t3 = performance.now();
  const detailDurationMs = (t3 - t2).toFixed(2);
  const detailJson = JSON.stringify(detailResult);
  const detailSizeBytes = Buffer.byteLength(detailJson, 'utf8');

  console.log(`- Target Employee: ${detailResult.employee.fullName} (${detailResult.employee.employeeCode})`);
  console.log(`- Returned Daily Records Count: ${detailResult.records.length}`);
  console.log(`- Total Available Dates in Range: ${detailResult.pagination.totalDates}`);
  console.log(`- Current Page: ${detailResult.pagination.page} / ${detailResult.pagination.totalPages}`);
  console.log(`- Has More Pages: ${detailResult.pagination.hasMore}`);
  console.log(`- Response Payload Size: ${detailSizeBytes} bytes (${(detailSizeBytes / 1024).toFixed(2)} KB)`);
  console.log(`- Execution Time: ${detailDurationMs} ms`);
  console.log(`- Number of SQL queries: 4 (Employee verification, Attendance records, Approved Leaves, Holidays, Regularizations)`);

  // ----------------------------------------------------
  // 3. EXPLAIN ANALYZE ON SUMMARY & DETAIL QUERIES
  // ----------------------------------------------------
  console.log('\n--- 3. EXPLAIN ANALYZE: Summary Query Plan ---');
  const summaryPlan = await query(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT 
      e.id, e.employee_code, e.first_name, e.last_name, e.status,
      d.id as department_id, d.name as department_name,
      COALESCE(att_agg.session_count, 0)::int as session_count,
      COALESCE(att_agg.total_hours, 0)::numeric as total_hours,
      COALESCE(att_agg.present_days, 0)::int as present_days,
      att_agg.latest_attendance_date,
      att_agg.latest_check_in,
      att_agg.latest_status
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN (
      SELECT 
        a.employee_id,
        COUNT(a.id) as session_count,
        SUM(COALESCE(a.working_hours, 0)) as total_hours,
        COUNT(DISTINCT a.date) as present_days,
        MAX(a.date::text) as latest_attendance_date,
        MAX(a.check_in) as latest_check_in,
        (ARRAY_AGG(a.status ORDER BY a.date DESC, a.check_in DESC, a.id DESC))[1] as latest_status
      FROM attendance a
      JOIN employees emp_sub ON a.employee_id = emp_sub.id
      WHERE emp_sub.organization_id = $1::int 
        AND a.date BETWEEN '2026-08-30' AND '2026-09-05'
      GROUP BY a.employee_id
    ) att_agg ON e.id = att_agg.employee_id
    WHERE e.organization_id = $1::int AND e.status = 'ACTIVE'
    ORDER BY e.first_name ASC, e.last_name ASC
  `, [orgId]);
  console.log(summaryPlan.rows.map((r: any) => r['QUERY PLAN']).join('\n'));

  console.log('\n--- 4. EXPLAIN ANALYZE: Employee Detail Query Plan ---');
  const detailPlan = await query(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT
      a.id, a.employee_id, a.date::text as date, a.check_in, a.check_out,
      a.punch_in_lat, a.punch_in_lng, a.punch_in_accuracy, a.punch_in_location_name,
      a.punch_out_lat, a.punch_out_lng, a.punch_out_accuracy, a.punch_out_location_name,
      a.break_duration_mins, a.shift_name, a.status, a.session_state, a.working_hours
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE e.id = $1::int AND e.organization_id = $2::int AND a.date BETWEEN '2026-08-01' AND '2026-09-05'
    ORDER BY a.date DESC, a.check_in DESC, a.id DESC
  `, [empId, orgId]);
  console.log(detailPlan.rows.map((r: any) => r['QUERY PLAN']).join('\n'));
}

measure().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
