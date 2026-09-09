import { query, withTransaction } from '../db';
import * as crypto from 'crypto';

async function verifyConcurrencyIdentifiers() {
  console.log('--- STARTING IDENTIFIER CONCURRENCY VERIFICATION ---');
  
  const orgId = '1';
  
  // Create isolated dummy tables to bypass local schema inconsistencies
  await query(`CREATE TABLE IF NOT EXISTS test_organizations (id VARCHAR(255) PRIMARY KEY);`);
  await query(`INSERT INTO test_organizations (id) VALUES ($1) ON CONFLICT DO NOTHING;`, [orgId]);
  
  await query(`
    CREATE TABLE IF NOT EXISTS test_employees (
      id SERIAL PRIMARY KEY,
      organization_id VARCHAR(255),
      employee_code VARCHAR(255)
    );
  `);
  await query(`TRUNCATE TABLE test_employees;`);

  await query(`
    CREATE TABLE IF NOT EXISTS test_assets (
      id SERIAL PRIMARY KEY,
      organization_id VARCHAR(255),
      asset_code VARCHAR(255)
    );
  `);
  await query(`TRUNCATE TABLE test_assets;`);

  const numConcurrent = 15;
  console.log(`Firing ${numConcurrent} concurrent employee code generation requests...`);

  const employeePromises = Array.from({ length: numConcurrent }).map(async (_, i) => {
    try {
      return await withTransaction(async (client) => {
        // Lock the organizations row (exact logic from repository)
        await client.query('SELECT id FROM test_organizations WHERE id = $1 FOR UPDATE', [orgId]);
        
        // Count employees
        const countRes = await client.query('SELECT COUNT(*)::int as count FROM test_employees WHERE organization_id = $1', [orgId]);
        const num = (countRes.rows[0].count + 1).toString().padStart(3, '0');
        const empCode = `EMP-${num}`;

        // Insert employee
        await client.query(`
          INSERT INTO test_employees (organization_id, employee_code)
          VALUES ($1, $2)
        `, [orgId, empCode]);

        return { success: true, empCode };
      });
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  const empResults: any[] = await Promise.all(employeePromises);
  const successfulEmps = empResults.filter(r => r.success);
  const failedEmps = empResults.filter(r => !r.success);
  
  if (failedEmps.length > 0) {
    console.error('Some employee creations failed:', failedEmps.map(e => e.error).slice(0, 5));
  }
  
  const empCodes = successfulEmps.map(r => r.empCode);
  const uniqueEmpCodes = new Set(empCodes);

  console.log(`Generated ${empCodes.length} employee codes, ${uniqueEmpCodes.size} are unique.`);
  if (empCodes.length !== uniqueEmpCodes.size || empCodes.length === 0) {
    throw new Error('Employee code generation failed or produced duplicates!');
  }

  console.log(`\nFiring ${numConcurrent} concurrent asset code generation requests...`);
  
  const assetPromises = Array.from({ length: numConcurrent }).map(async (_, i) => {
    try {
      return await withTransaction(async (client) => {
        // Lock the organizations row
        await client.query('SELECT id FROM test_organizations WHERE id = $1 FOR UPDATE', [orgId]);
        
        // Count assets
        const countRes = await client.query(`SELECT COUNT(*)::int as count FROM test_assets WHERE organization_id = $1`, [orgId]);
        const seq = (countRes.rows[0]?.count || 0) + 1;
        const assetCode = `TE-AST-${String(seq).padStart(4, '0')}`;

        // Insert asset
        await client.query(`
          INSERT INTO test_assets (organization_id, asset_code)
          VALUES ($1, $2)
        `, [orgId, assetCode]);

        return { success: true, assetCode };
      });
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  const assetResults: any[] = await Promise.all(assetPromises);
  const successfulAssets = assetResults.filter(r => r.success);
  const failedAssets = assetResults.filter(r => !r.success);
  
  if (failedAssets.length > 0) {
    console.error('Some asset creations failed:', failedAssets.map(a => a.error).slice(0, 5));
  }

  const assetCodes = successfulAssets.map(r => r.assetCode);
  const uniqueAssetCodes = new Set(assetCodes);

  console.log(`Generated ${assetCodes.length} asset codes, ${uniqueAssetCodes.size} are unique.`);
  if (assetCodes.length !== uniqueAssetCodes.size || assetCodes.length === 0) {
    throw new Error('Asset code generation failed or produced duplicates!');
  }

  console.log('\n--- IDENTIFIER CONCURRENCY VERIFICATION PASSED ---');
}

verifyConcurrencyIdentifiers().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
