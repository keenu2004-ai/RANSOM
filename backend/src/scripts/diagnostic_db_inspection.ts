import { query } from '../db';

async function main() {
  console.log('=== DATABASE SCHEMA & INDEX DIAGNOSTIC ===\n');

  const tables = ['attendance', 'leave_requests', 'holidays', 'audit_logs', 'employees', 'organizations', 'attendance_regularizations'];
  for (const t of tables) {
    const cols = await query('SELECT column_name, data_type, udt_name, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position', [t]);
    console.log(`\nTable [${t}] (${cols.rows.length} columns):`);
    console.log(cols.rows.map((c: any) => `  - ${c.column_name}: ${c.data_type} (${c.udt_name}) [nullable: ${c.is_nullable}]`).join('\n'));
  }

  console.log('\n=== EXISTING INDEXES ===\n');
  const idxs = await query("SELECT tablename, indexname, indexdef FROM pg_indexes WHERE tablename IN ('attendance', 'leave_requests', 'holidays', 'employees') ORDER BY tablename, indexname");
  for (const idx of idxs.rows) {
    console.log(`[${idx.tablename}] ${idx.indexname}: ${idx.indexdef}`);
  }

  console.log('\n=== EXPLAIN ANALYZE BENCHMARKS ===\n');

  // Find sample organization and employee
  const empRes = await query('SELECT e.id as emp_id, e.organization_id as org_id FROM employees e LIMIT 1');
  if (empRes.rows.length > 0) {
    const orgId = empRes.rows[0].org_id;
    const empId = empRes.rows[0].emp_id;

    console.log(`Testing with Org ID: ${orgId}, Emp ID: ${empId}\n`);

    // 1. Workforce employee summary aggregation query
    console.log('--- 1. EXPLAIN ANALYZE: Workforce Summary Query ---');
    const q1 = `
      EXPLAIN ANALYZE
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
        WHERE emp_sub.organization_id = $1 
          AND a.date BETWEEN '2026-08-30' AND '2026-09-05'
        GROUP BY a.employee_id
      ) att_agg ON e.id = att_agg.employee_id
      WHERE e.organization_id = $1 AND e.status = 'ACTIVE'
      ORDER BY e.first_name ASC, e.last_name ASC
    `;
    const res1 = await query(q1, [orgId]);
    console.log(res1.rows.map((r: any) => r['QUERY PLAN']).join('\n'));

    // 2. Single employee attendance detail query
    console.log('\n--- 2. EXPLAIN ANALYZE: Employee Detail Query ---');
    const q2 = `
      EXPLAIN ANALYZE
      SELECT
        a.id, a.employee_id, a.date::text as date, a.check_in, a.check_out,
        a.punch_in_lat, a.punch_in_lng, a.punch_in_accuracy, a.punch_in_location_name,
        a.punch_out_lat, a.punch_out_lng, a.punch_out_accuracy, a.punch_out_location_name,
        a.break_duration_mins, a.shift_name, a.status, a.session_state, a.working_hours
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.id = $1 AND e.organization_id = $2 AND a.date BETWEEN '2026-08-01' AND '2026-09-05'
      ORDER BY a.date DESC, a.check_in DESC, a.id DESC
    `;
    const res2 = await query(q2, [empId, orgId]);
    console.log(res2.rows.map((r: any) => r['QUERY PLAN']).join('\n'));
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
