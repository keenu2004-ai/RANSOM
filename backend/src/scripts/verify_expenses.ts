import { query } from '../db';
import { ExpenseRepository } from '../repositories/expenseRepository';
import { TripExpenseRepository } from '../repositories/tripExpenseRepository';

async function runExpenseStabilizationE2EScenario() {
  console.log('================================================================');
  console.log('--- STARTING PHASE 7 EXPENSE CLAIMS & TRIP STABILIZATION E2E ---');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, stepName: string) => {
    if (condition) {
      console.log(`✅ [PASS] ${stepName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${stepName}`);
      failed++;
      throw new Error(`Step failed: ${stepName}`);
    }
  };

  try {
    // Fetch Organization & Test Employee
    const orgRes = await query('SELECT id FROM organizations LIMIT 1');
    if (!orgRes.rows[0]) throw new Error('No organization found.');
    const orgId = orgRes.rows[0].id;

    const empRes = await query('SELECT id, user_id FROM employees WHERE organization_id = $1 AND user_id IS NOT NULL LIMIT 1', [orgId]);
    if (!empRes.rows[0]) throw new Error('No employee found.');
    const emp = empRes.rows[0];

    // ─── STEP 1: BUSINESS EXPENSE SCENARIO ──────────────────────────────────────
    console.log('[SCENARIO 1] Creating Business Expense (Office Supplies)...');
    const busExp = await ExpenseRepository.create(orgId, emp.id, {
      expenseType: 'BUSINESS',
      transactionDate: '2026-08-20',
      category: 'Office Supply',
      merchant: 'ABC Stationery',
      currency: 'INR',
      amount: 1500,
      bucket: 'Internal',
      description: 'Office Supplies'
    });
    assert(busExp && busExp.amount == 1500 && busExp.bucket === 'Internal', 'Business expense created in PostgreSQL');

    // Persistence Check: Re-fetch from database
    const fetchedBus = await ExpenseRepository.findById(busExp.id, orgId);
    assert(fetchedBus && fetchedBus.category === 'Office Supply' && Number(fetchedBus.amount) === 1500, 'Business expense verified in DB after re-fetch');


    // ─── STEP 2: LOCAL TRAVEL EXPENSE SCENARIO ─────────────────────────────────
    console.log('\n[SCENARIO 2] Creating Local Travel Expense (Client Visit)...');
    const localExp = await ExpenseRepository.create(orgId, emp.id, {
      expenseType: 'LOCAL_TRAVEL',
      transactionDate: '2026-08-21',
      category: 'Taxi',
      merchant: 'Uber',
      transportMode: 'Taxi',
      startLocation: 'Office',
      endLocation: 'Client Office',
      currency: 'INR',
      amount: 450,
      bucket: 'Primary',
      description: 'Client Visit'
    });
    assert(localExp && localExp.amount == 450 && localExp.transport_mode === 'Taxi', 'Local travel expense created in PostgreSQL');

    const fetchedLocal = await ExpenseRepository.findById(localExp.id, orgId);
    assert(fetchedLocal && fetchedLocal.start_location === 'Office' && Number(fetchedLocal.amount) === 450, 'Local travel expense verified in DB after re-fetch');


    // ─── STEP 3: PARENT TRIP EXPENSE (DRAFT) ───────────────────────────────────
    console.log('\n[SCENARIO 3] Creating Parent Trip Expense Draft...');
    const parentTrip = await TripExpenseRepository.createTrip(orgId, emp.id, {
      purpose: 'Client Meeting',
      startPoint: 'Delhi',
      endPoint: 'Mumbai',
      startDate: '2026-08-22',
      endDate: '2026-08-24',
      currency: 'INR'
    });
    assert(parentTrip && parentTrip.status === 'DRAFT' && Number(parentTrip.total_amount) === 0, 'Parent trip draft created');


    // ─── STEP 4: ADD CHILD EXPENSES ───────────────────────────────────────────
    console.log('\n[SCENARIO 4] Adding Child Expenses (Travel, Accommodation, Other)...');
    // A. Travel Child (Flight)
    const travelChild1 = await TripExpenseRepository.addTravelExpense(orgId, emp.id, parentTrip.id, {
      startDate: '2026-08-22',
      endDate: '2026-08-22',
      transportMode: 'Flight',
      purpose: 'Flight to Mumbai',
      startLocation: 'Delhi Airport',
      endLocation: 'Mumbai Airport',
      distanceKm: 1150,
      currency: 'INR',
      amount: 5000
    });
    assert(travelChild1 && travelChild1.amount == 5000, 'Travel child 1 (Flight) added');

    // B. Accommodation Child (Hotel)
    const accomChild = await TripExpenseRepository.addAccommodationExpense(orgId, emp.id, parentTrip.id, {
      startDate: '2026-08-22',
      endDate: '2026-08-24',
      currency: 'INR',
      amount: 4000,
      accommodationDetails: 'Business hotel'
    });
    assert(accomChild && accomChild.amount == 4000, 'Accommodation child added');

    // C. Other Child (Food)
    const otherChild = await TripExpenseRepository.addOtherExpense(orgId, emp.id, parentTrip.id, {
      transactionDate: '2026-08-23',
      category: 'Food',
      merchant: 'Restaurant',
      currency: 'INR',
      amount: 800,
      purpose: 'Client dinner'
    });
    assert(otherChild && otherChild.amount == 800, 'Other child added');

    // Verify Total Server-Side Recalculation: 5000 + 4000 + 800 = 9800
    let tripDetails = await TripExpenseRepository.getTripById(parentTrip.id, orgId);
    assert(Number(tripDetails.total_amount) === 9800, 'Parent trip total recalculated server-side to 9800 (5000+4000+800)');
    assert(tripDetails.travelExpenses.length === 1 && tripDetails.accommodationExpenses.length === 1 && tripDetails.otherExpenses.length === 1, 'All 3 child records verified on trip details');


    // ─── STEP 5: ADD MULTIPLE CHILD EXPENSE & VERIFY RECALCULATION ─────────────
    console.log('\n[SCENARIO 5] Adding second Travel Child (Taxi ₹500)...');
    const travelChild2 = await TripExpenseRepository.addTravelExpense(orgId, emp.id, parentTrip.id, {
      startDate: '2026-08-24',
      endDate: '2026-08-24',
      transportMode: 'Taxi',
      purpose: 'Airport cab',
      startLocation: 'Hotel',
      endLocation: 'Mumbai Airport',
      distanceKm: 25,
      currency: 'INR',
      amount: 500
    });
    assert(travelChild2 && travelChild2.amount == 500, 'Travel child 2 (Taxi) added');

    tripDetails = await TripExpenseRepository.getTripById(parentTrip.id, orgId);
    assert(Number(tripDetails.total_amount) === 10300, 'Grand total updated to 10300 after adding Taxi');


    // ─── STEP 6: DELETE CHILD EXPENSE & VERIFY RECALCULATION ──────────────────
    console.log('\n[SCENARIO 6] Deleting Taxi Child Expense (₹500)...');
    await TripExpenseRepository.deleteTravelExpense(travelChild2.id, parentTrip.id, orgId, emp.id);

    tripDetails = await TripExpenseRepository.getTripById(parentTrip.id, orgId);
    assert(Number(tripDetails.total_amount) === 9800, 'Grand total returned to 9800 after deleting Taxi');


    // ─── STEP 7: FINAL TRIP SUBMISSION (DRAFT -> PENDING) ─────────────────────
    console.log('\n[SCENARIO 7] Submitting Final Trip Expense...');
    const submittedTrip = await TripExpenseRepository.submitTrip(parentTrip.id, orgId, emp.id);
    assert(submittedTrip.status === 'PENDING', 'Trip status updated to PENDING');

    // Verify submission persistence
    const reFetchedTrip = await TripExpenseRepository.getTripById(parentTrip.id, orgId);
    assert(reFetchedTrip.status === 'PENDING' && Number(reFetchedTrip.total_amount) === 9800, 'Submitted trip verified in DB as PENDING with 9800 total');


    // ─── STEP 8: NEGATIVE TESTS ───────────────────────────────────────────────
    console.log('\n[SCENARIO 8] Running Negative Test Suite...');

    // 1. Submit empty trip without child expenses
    const emptyTrip = await TripExpenseRepository.createTrip(orgId, emp.id, {
      purpose: 'Empty Trip Test',
      startPoint: 'City A',
      endPoint: 'City B',
      startDate: '2026-09-01',
      endDate: '2026-09-02'
    });
    try {
      await TripExpenseRepository.submitTrip(emptyTrip.id, orgId, emp.id);
      assert(false, 'Submission of empty trip should fail');
    } catch (err: any) {
      assert(err.message.includes('Add at least one travel, accommodation, or other expense'), 'Empty trip submission correctly rejected');
    }
    await TripExpenseRepository.deleteTripDraft(emptyTrip.id, orgId, emp.id);

    // 2. Modify submitted trip
    try {
      await TripExpenseRepository.addTravelExpense(orgId, emp.id, parentTrip.id, {
        startDate: '2026-08-22', endDate: '2026-08-22', transportMode: 'Taxi', purpose: 'Late Taxi',
        startLocation: 'A', endLocation: 'B', amount: 300
      });
      assert(false, 'Adding child to submitted trip should fail');
    } catch (err: any) {
      assert(err.message.includes('non-draft trip'), 'Modification of submitted trip correctly rejected');
    }

    // ─── CLEANUP ─────────────────────────────────────────────────────────────
    console.log('\n[CLEANUP] Cleaning up test records...');
    await query('DELETE FROM trip_travel_expenses WHERE trip_expense_id = $1', [parentTrip.id]);
    await query('DELETE FROM trip_accommodation_expenses WHERE trip_expense_id = $1', [parentTrip.id]);
    await query('DELETE FROM trip_other_expenses WHERE trip_expense_id = $1', [parentTrip.id]);
    await query('DELETE FROM trip_expenses WHERE id = $1', [parentTrip.id]);
    await query('DELETE FROM expenses WHERE id IN ($1, $2)', [busExp.id, localExp.id]);

    console.log('\n================================================================');
    console.log(`--- PHASE 7 EXPENSE E2E SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
    console.log('================================================================\n');
  } catch (err: any) {
    console.error('Fatal error during expense E2E scenario:', err.message);
    process.exit(1);
  }
}

runExpenseStabilizationE2EScenario();
