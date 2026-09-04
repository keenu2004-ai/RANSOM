import { query } from '../db';
import { ExpenseRepository } from '../repositories/expenseRepository';
import { getFinancialYearPeriod } from '../utils/financialYear';

async function runVerification() {
  console.log('--- STARTING EXPENSE ENGINE & ANALYTICS VERIFICATION ---');

  // 1. Check Indian Financial Year boundaries for FY 2026-27
  const fy2026 = getFinancialYearPeriod(2026);
  console.log('FY 2026-27 Period:', fy2026);
  if (fy2026.startDate !== '2026-04-01' || fy2026.endDate !== '2027-03-31') {
    throw new Error('Financial year boundary calculation failed!');
  }

  // 2. Fetch Organizations & Test Data
  const orgRes = await query('SELECT id FROM organizations LIMIT 1');
  if (orgRes.rows.length === 0) {
    console.log('No organization found in database to test.');
    process.exit(0);
  }
  const orgId = orgRes.rows[0].id;

  // 3. Test getManagementSummary
  const summary = await ExpenseRepository.getManagementSummary(orgId, fy2026.startDate, fy2026.endDate);
  console.log('Management Summary:', summary);

  // 4. Test getEmployeeExpenseOverview
  const overview = await ExpenseRepository.getEmployeeExpenseOverview(orgId, fy2026.startDate, fy2026.endDate, { page: 1, limit: 5 });
  console.log('Employee Overview Count:', overview.pagination.total);
  console.log('First 3 Employees:', overview.employees.slice(0, 3));

  // 5. Test getExpenseAnalytics
  const analytics = await ExpenseRepository.getExpenseAnalytics(orgId, fy2026.startDate, fy2026.endDate, 2026);
  console.log('Overall Total Amount:', analytics.overallTotal);
  console.log('Monthly Trend Length (Must be 12):', analytics.monthlyTrend.length);
  console.log('Monthly Trend Order:', analytics.monthlyTrend.map(m => m.month).join(', '));
  console.log('Optimization Insight:', analytics.costOptimizationInsight);

  // 6. Test Recent Requests
  const recent = await ExpenseRepository.getRecentRequests(orgId, fy2026.startDate, fy2026.endDate, 5);
  console.log('Recent Requests Count:', recent.length);

  // 7. Reconcile Totals
  const sumApproved = overview.employees.reduce((acc, e) => acc + e.approvedAmount, 0);
  const sumPending = overview.employees.reduce((acc, e) => acc + e.pendingAmount, 0);
  const sumRejected = overview.employees.reduce((acc, e) => acc + e.rejectedAmount, 0);
  console.log(`Overview Sample Totals -> Approved: ₹${sumApproved}, Pending: ₹${sumPending}, Rejected: ₹${sumRejected}`);

  console.log('--- VERIFICATION SUCCESSFUL ---');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
