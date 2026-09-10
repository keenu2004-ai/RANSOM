/**
 * permissions.unit.test.ts — Unit Tests for Permission System (P1)
 *
 * Tests the backend `normalizeRole` and `hasPermission` utilities in pure isolation.
 * No database, no HTTP, no supertest.
 *
 * These are the fastest tests in the suite and protect the core RBAC logic
 * from silent regressions.
 */
import { normalizeRole, hasPermission } from '../config/permissions';

describe('normalizeRole()', () => {
  it('normalizes SUPER_ADMIN variants', () => {
    expect(normalizeRole('SUPER_ADMIN')).toBe('SUPER_ADMIN');
    expect(normalizeRole('ADMIN')).toBe('SUPER_ADMIN');
    expect(normalizeRole('ADMINISTRATOR')).toBe('SUPER_ADMIN');
    expect(normalizeRole('admin')).toBe('SUPER_ADMIN');
    expect(normalizeRole('  ADMIN  ')).toBe('SUPER_ADMIN');
  });

  it('normalizes HR_MANAGER variants', () => {
    expect(normalizeRole('HR_MANAGER')).toBe('HR_MANAGER');
    expect(normalizeRole('HR_ADMIN')).toBe('HR_MANAGER');
    expect(normalizeRole('HR_EXECUTIVE')).toBe('HR_MANAGER');
    expect(normalizeRole('hr_manager')).toBe('HR_MANAGER');
  });

  it('normalizes OPERATIONAL_MANAGER variants', () => {
    expect(normalizeRole('OPERATIONAL_MANAGER')).toBe('OPERATIONAL_MANAGER');
    expect(normalizeRole('MANAGER')).toBe('OPERATIONAL_MANAGER');
    expect(normalizeRole('FINANCE')).toBe('OPERATIONAL_MANAGER');
    expect(normalizeRole('TEAM_LEAD')).toBe('OPERATIONAL_MANAGER');
  });

  it('defaults unknown roles to EMPLOYEE', () => {
    expect(normalizeRole('UNKNOWN_ROLE')).toBe('EMPLOYEE');
    expect(normalizeRole('GUEST')).toBe('EMPLOYEE');
    expect(normalizeRole(null)).toBe('EMPLOYEE');
    expect(normalizeRole(undefined)).toBe('EMPLOYEE');
    expect(normalizeRole('')).toBe('EMPLOYEE');
  });

  it('normalizes EMPLOYEE', () => {
    expect(normalizeRole('EMPLOYEE')).toBe('EMPLOYEE');
    expect(normalizeRole('employee')).toBe('EMPLOYEE');
  });
});

describe('hasPermission() — SUPER_ADMIN', () => {
  it('SUPER_ADMIN has all permissions', () => {
    expect(hasPermission('SUPER_ADMIN', 'ANY_PERMISSION_KEY')).toBe(true);
    expect(hasPermission('ADMIN', 'EMPLOYEE_CREATE')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'LEAVE_APPROVE', 'ORGANIZATION')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'NONEXISTENT_PERMISSION', 'ORGANIZATION')).toBe(true);
  });
});

describe('hasPermission() — HR_MANAGER', () => {
  it('HR_MANAGER can approve leaves at ORGANIZATION scope', () => {
    expect(hasPermission('HR_MANAGER', 'LEAVE_APPROVE', 'ORGANIZATION')).toBe(true);
  });

  it('HR_MANAGER can view workforce attendance', () => {
    expect(hasPermission('HR_MANAGER', 'ATTENDANCE_WORKFORCE_VIEW', 'ORGANIZATION')).toBe(true);
  });

  it('HR_MANAGER can reset user passwords', () => {
    expect(hasPermission('HR_MANAGER', 'USER_PASSWORD_RESET')).toBe(true);
  });
});

describe('hasPermission() — OPERATIONAL_MANAGER', () => {
  it('OPERATIONAL_MANAGER can view workforce attendance', () => {
    expect(hasPermission('OPERATIONAL_MANAGER', 'ATTENDANCE_WORKFORCE_VIEW', 'ORGANIZATION')).toBe(true);
  });

  it('OPERATIONAL_MANAGER cannot manage leave policies (HR-only)', () => {
    expect(hasPermission('OPERATIONAL_MANAGER', 'LEAVE_POLICY_MANAGE')).toBe(false);
  });

  it('OPERATIONAL_MANAGER cannot reset user passwords (HR-only)', () => {
    expect(hasPermission('OPERATIONAL_MANAGER', 'USER_PASSWORD_RESET')).toBe(false);
  });

  it('OPERATIONAL_MANAGER cannot create employees', () => {
    expect(hasPermission('OPERATIONAL_MANAGER', 'EMPLOYEE_CREATE')).toBe(false);
  });
});

describe('hasPermission() — EMPLOYEE', () => {
  it('EMPLOYEE can only self-punch attendance', () => {
    expect(hasPermission('EMPLOYEE', 'ATTENDANCE_SELF_PUNCH', 'SELF')).toBe(true);
  });

  it('EMPLOYEE cannot view workforce attendance', () => {
    expect(hasPermission('EMPLOYEE', 'ATTENDANCE_WORKFORCE_VIEW')).toBe(false);
  });

  it('EMPLOYEE cannot approve leaves', () => {
    expect(hasPermission('EMPLOYEE', 'LEAVE_APPROVE')).toBe(false);
  });

  it('EMPLOYEE cannot approve expenses', () => {
    expect(hasPermission('EMPLOYEE', 'EXPENSE_APPROVE')).toBe(false);
  });

  it('EMPLOYEE cannot create employees', () => {
    expect(hasPermission('EMPLOYEE', 'EMPLOYEE_CREATE')).toBe(false);
  });

  it('EMPLOYEE cannot reset user passwords', () => {
    expect(hasPermission('EMPLOYEE', 'USER_PASSWORD_RESET')).toBe(false);
  });

  it('EMPLOYEE can self-apply leave', () => {
    expect(hasPermission('EMPLOYEE', 'LEAVE_SELF_APPLY', 'SELF')).toBe(true);
  });
});

describe('hasPermission() — Scope hierarchy', () => {
  it('ORGANIZATION scope satisfies SELF requirement', () => {
    // HR_MANAGER has LEAVE_APPROVE at ORGANIZATION scope
    // Requiring SELF should be satisfied (higher scope covers lower)
    expect(hasPermission('HR_MANAGER', 'LEAVE_APPROVE', 'SELF')).toBe(true);
  });

  it('SELF scope does NOT satisfy ORGANIZATION requirement', () => {
    // EMPLOYEE has LEAVE_SELF_APPLY at SELF scope only
    // Requiring ORGANIZATION should NOT be satisfied
    expect(hasPermission('EMPLOYEE', 'LEAVE_SELF_APPLY', 'ORGANIZATION')).toBe(false);
  });

  it('Unknown/null role has no permissions', () => {
    expect(hasPermission(null, 'LEAVE_APPROVE')).toBe(false);
    expect(hasPermission(undefined, 'EMPLOYEE_CREATE')).toBe(false);
    expect(hasPermission('', 'ANY_KEY')).toBe(false);
  });
});
