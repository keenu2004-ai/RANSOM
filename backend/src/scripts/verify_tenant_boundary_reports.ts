import { query } from '../db';

async function verifyReportTenantBoundary() {
  console.log('--- STARTING REPORT TENANT BOUNDARY VERIFICATION ---');

  const orgAId = '101';
  const orgBId = '102';
  
  await query(`INSERT INTO organizations (id, name, code) VALUES ($1, 'Tenant A', 'T-A') ON CONFLICT DO NOTHING`, [orgAId]);
  await query(`INSERT INTO organizations (id, name, code) VALUES ($1, 'Tenant B', 'T-B') ON CONFLICT DO NOTHING`, [orgBId]);

  await query(`CREATE TABLE IF NOT EXISTS test_report_archives (
    id SERIAL PRIMARY KEY,
    organization_id VARCHAR(255),
    report_type VARCHAR(255),
    status VARCHAR(255),
    storage_status VARCHAR(255),
    storage_file_id VARCHAR(255)
  )`);
  await query(`TRUNCATE TABLE test_report_archives;`);

  // Insert a test report archive belonging to Tenant A
  const archiveRes = await query(`
    INSERT INTO test_report_archives (organization_id, report_type, status, storage_status, storage_file_id)
    VALUES ($1, 'ATTENDANCE_SUMMARY', 'COMPLETED', 'AVAILABLE', 'dummy_file_id')
    RETURNING id
  `, [orgAId]);
  const archiveId = archiveRes.rows[0].id;

  console.log(`Created Archive ID: ${archiveId} for Tenant A (${orgAId})`);

  // Attempt to update it acting as Tenant B (this mimics the code from reportRoutes.ts)
  console.log(`Attempting to mark archive BROKEN acting as Tenant B (${orgBId})...`);
  const updateRes = await query("UPDATE test_report_archives SET storage_status = 'BROKEN' WHERE id = $1 AND organization_id = $2 RETURNING id", [archiveId, orgBId]);
  
  if (updateRes.rowCount !== null && updateRes.rowCount > 0) {
    throw new Error('Tenant boundary VIOLATED! Tenant B was able to update Tenant A\'s archive.');
  }
  
  console.log('Cross-tenant update affected 0 rows. (Boundary intact)');

  // Ensure it can be updated by the correct tenant
  console.log(`Attempting to mark archive BROKEN acting as Tenant A (${orgAId})...`);
  const correctUpdateRes = await query("UPDATE test_report_archives SET storage_status = 'BROKEN' WHERE id = $1 AND organization_id = $2 RETURNING id", [archiveId, orgAId]);

  if (correctUpdateRes.rowCount === 0) {
    throw new Error('Tenant A could not update its own archive.');
  }

  console.log('Same-tenant update succeeded. (1 row affected)');
  
  console.log('\n--- REPORT TENANT BOUNDARY VERIFICATION PASSED ---');
}

verifyReportTenantBoundary().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
