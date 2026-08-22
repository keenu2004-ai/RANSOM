import { query } from '../db';

export interface ApproverContext {
  userId: string;
  role: string;
  organizationId: string;
  employeeId?: string | null;
}

export interface ExpenseApprovalValidation {
  allowed: boolean;
  reason?: string;
  submitterRole?: string;
}

/**
 * Validates whether a reviewer is authorized to approve/reject an expense submitted by submitterEmployeeId.
 * Enforces hierarchical role boundaries, manager assignment, multi-tenant isolation, and self-approval prohibition.
 */
export async function validateExpenseApprover(
  organizationId: string,
  submitterEmployeeId: string,
  reviewer: ApproverContext
): Promise<ExpenseApprovalValidation> {
  // 1. Multi-Tenant Guard
  if (organizationId !== reviewer.organizationId) {
    return { allowed: false, reason: 'Cross-organization expense approval is strictly forbidden.' };
  }

  // 2. Fetch Submitter Details (user_id, role, manager_id)
  const submitterRes = await query(`
    SELECT 
      e.id as employee_id,
      e.user_id as submitter_user_id,
      e.manager_id,
      r.name as role_name
    FROM employees e
    LEFT JOIN users u ON e.user_id = u.id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE e.id = $1 AND e.organization_id = $2
  `, [submitterEmployeeId, organizationId]);

  if (submitterRes.rows.length === 0) {
    return { allowed: false, reason: 'Submitter employee record not found.' };
  }

  const submitter = submitterRes.rows[0];
  const submitterRole = submitter.role_name || 'EMPLOYEE';
  const submitterUserId = submitter.submitter_user_id;

  // 3. Self-Approval Prohibition Guard
  if (reviewer.userId && submitterUserId && reviewer.userId === submitterUserId) {
    return { allowed: false, reason: 'Self-approval is strictly forbidden. Submitter cannot approve their own expense claim.' };
  }
  if (reviewer.employeeId && submitterEmployeeId && reviewer.employeeId === submitterEmployeeId) {
    return { allowed: false, reason: 'Self-approval is strictly forbidden. Submitter cannot approve their own expense claim.' };
  }

  // 4. Role Hierarchy Authority Engine
  const reviewerRole = reviewer.role;

  switch (submitterRole) {
    case 'EMPLOYEE': {
      // Primary: Submitter's assigned manager
      if (submitter.manager_id && reviewer.employeeId && reviewer.employeeId === submitter.manager_id) {
        return { allowed: true, submitterRole };
      }
      // Fallback: HR_MANAGER, ADMIN, or SUPER_ADMIN in the same organization
      if (['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(reviewerRole)) {
        return { allowed: true, submitterRole };
      }
      return { allowed: false, reason: 'Only the assigned Manager, HR Manager, Admin, or Super Admin may approve Employee expenses.' };
    }

    case 'MANAGER': {
      // MANAGER expenses require HR_MANAGER, ADMIN, or SUPER_ADMIN
      if (['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(reviewerRole)) {
        return { allowed: true, submitterRole };
      }
      return { allowed: false, reason: 'Manager expenses must be approved by HR Manager, Admin, or Super Admin.' };
    }

    case 'HR_MANAGER': {
      // HR_MANAGER expenses require ADMIN or SUPER_ADMIN
      if (['ADMIN', 'SUPER_ADMIN'].includes(reviewerRole)) {
        return { allowed: true, submitterRole };
      }
      return { allowed: false, reason: 'HR Manager expenses must be approved by Admin or Super Admin.' };
    }

    case 'ADMIN': {
      // ADMIN expenses require SUPER_ADMIN
      if (reviewerRole === 'SUPER_ADMIN') {
        return { allowed: true, submitterRole };
      }
      return { allowed: false, reason: 'Admin expenses must be approved by Super Admin.' };
    }

    case 'SUPER_ADMIN': {
      // SUPER_ADMIN expenses require ANOTHER SUPER_ADMIN (Self-approval already guarded above)
      if (reviewerRole === 'SUPER_ADMIN') {
        return { allowed: true, submitterRole };
      }
      return { allowed: false, reason: 'Super Admin expenses can only be approved by another Super Admin.' };
    }

    default: {
      // Default fallback: HR_MANAGER, ADMIN, SUPER_ADMIN
      if (['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(reviewerRole)) {
        return { allowed: true, submitterRole };
      }
      return { allowed: false, reason: 'No eligible approver role configured for this claim.' };
    }
  }
}
