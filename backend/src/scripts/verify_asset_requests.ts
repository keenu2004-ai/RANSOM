import { query } from '../db';
import { AssetRepository } from '../repositories/assetRepository';

async function runAssetRequestVerificationTests() {
  console.log('================================================================');
  console.log('--- STARTING ASSET REQUEST WORKFLOW VERIFICATION (PHASE 4) ---');
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
    // 1. Fetch Organization & Baseline Employee/Admin
    const orgRes = await query('SELECT id FROM organizations LIMIT 1');
    if (!orgRes.rows[0]) {
      console.log('No organization found in database to run integration tests.');
      process.exit(0);
    }
    const orgId = orgRes.rows[0].id;

    const empRes = await query('SELECT id, user_id FROM employees WHERE organization_id = $1 AND user_id IS NOT NULL LIMIT 1', [orgId]);
    const emp = empRes.rows[0];
    if (!emp) {
      console.log('No employee with user_id found in database to run integration tests.');
      process.exit(0);
    }

    const catRes = await query('SELECT id FROM asset_categories WHERE organization_id = $1 LIMIT 1', [orgId]);
    const categoryId = catRes.rows[0]?.id;

    // TEST 1: Employee Creates Asset Request
    console.log('[TEST 1] Employee Submits Asset Request...');
    const req1 = await AssetRepository.createRequest(orgId, emp.id, emp.user_id, {
      categoryId,
      reason: 'Need high-performance laptop for development',
      priority: 'HIGH',
      requiredDate: new Date().toISOString().split('T')[0]
    });
    assert(req1 && req1.request_number && req1.status === 'SUBMITTED', 'Asset request created with request_number and SUBMITTED status');

    // TEST 2: Employee Sees Own Request
    console.log('\n[TEST 2] Employee Fetches Own Requests...');
    const empRequests = await AssetRepository.getRequests(orgId, { employeeId: emp.id });
    const foundEmpReq = empRequests.find(r => r.id === req1.id);
    assert(!!foundEmpReq, 'Submitted request returned in employee own requests list');

    // TEST 3: Admin Sees Organizational Requests
    console.log('\n[TEST 3] Admin Fetches Organizational Requests...');
    const allRequests = await AssetRepository.getRequests(orgId, {});
    assert(allRequests.length > 0, 'Admin can query organizational asset requests');

    // TEST 4: Admin Rejects a Request & Stores Rejection Reason
    console.log('\n[TEST 4] Admin Rejects Asset Request with Reason...');
    const req2 = await AssetRepository.createRequest(orgId, emp.id, emp.user_id, {
      categoryId,
      reason: 'Temporary test request to reject',
      priority: 'LOW'
    });
    const rejected = await AssetRepository.rejectRequest(orgId, req2.id, emp.id, emp.user_id, 'Out of budget for Q3');
    assert(rejected.status === 'REJECTED' && rejected.rejection_reason === 'Out of budget for Q3', 'Request status set to REJECTED with rejection_reason');

    // TEST 5: Admin Approves Request
    console.log('\n[TEST 5] Admin Approves Asset Request...');
    const approved = await AssetRepository.approveRequest(orgId, req1.id, emp.id, emp.user_id);
    assert(approved.status === 'APPROVED' && approved.reviewed_by === emp.id, 'Request status set to APPROVED');

    // TEST 6: Approved Request Fulfillment & Asset Assignment
    console.log('\n[TEST 6] Admin Fulfills Approved Request with Available Asset...');
    // Create temporary available test asset
    const testAssetCode = `TST-${Date.now()}`;
    const assetInsert = await query(`
      INSERT INTO assets (
        organization_id, asset_code, asset_name, category_id, asset_type, purchase_price, current_value, status, created_by
      ) VALUES (
        $1, $2, 'Test Available Laptop', $3, 'HARDWARE', 50000, 50000, 'AVAILABLE', $4
      ) RETURNING *
    `, [orgId, testAssetCode, categoryId, emp.user_id]);
    const testAsset = assetInsert.rows[0];

    const fulfilledResult = await AssetRepository.fulfillRequest(orgId, req1.id, testAsset.id, emp.user_id);
    assert(fulfilledResult.request.status === 'FULFILLED', 'Request status updated to FULFILLED');
    assert(fulfilledResult.asset.status === 'ASSIGNED', 'Assigned asset status updated to ASSIGNED');

    // TEST 7: Asset History Records Assignment
    console.log('\n[TEST 7] Asset History Audit Record...');
    const histRes = await query(`SELECT * FROM asset_history WHERE asset_id = $1 AND action = 'ASSIGNED_VIA_REQUEST'`, [testAsset.id]);
    assert(histRes.rows.length > 0, 'Asset history recorded ASSIGNED_VIA_REQUEST action');

    // TEST 8: Organization Isolation Check
    console.log('\n[TEST 8] Organization Isolation Check...');
    const dummyOrgId = '00000000-0000-0000-0000-000000000000';
    const dummyReqs = await AssetRepository.getRequests(dummyOrgId, {});
    assert(dummyReqs.length === 0, 'Non-existent organization returns 0 asset requests');

    // Cleanup test asset & requests
    await query(`DELETE FROM asset_history WHERE asset_id = $1`, [testAsset.id]);
    await query(`DELETE FROM assets WHERE id = $1`, [testAsset.id]);
    await query(`DELETE FROM asset_requests WHERE id IN ($1, $2)`, [req1.id, req2.id]);

    console.log('\n================================================================');
    console.log(`--- ASSET REQUEST VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err: any) {
    console.error('Fatal error during asset request verification:', err.message);
    process.exit(1);
  }
}

runAssetRequestVerificationTests();
