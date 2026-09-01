import { normalizeRole } from '../config/permissions';

export interface RoleAssignmentValidationResult {
  allowed: boolean;
  reason?: string;
}

export function getAllowedAssignableRoles(actorRole?: string | null): string[] {
  const canonicalRole = normalizeRole(actorRole);
  switch (canonicalRole) {
    case 'SUPER_ADMIN':
      return ['SUPER_ADMIN', 'HR_MANAGER', 'OPERATIONAL_MANAGER', 'EMPLOYEE'];
    case 'HR_MANAGER':
      return ['OPERATIONAL_MANAGER', 'EMPLOYEE'];
    case 'OPERATIONAL_MANAGER':
      return ['EMPLOYEE'];
    case 'EMPLOYEE':
    default:
      return [];
  }
}

/**
 * Validates whether actorUser can assign targetRole to targetUserId.
 */
export function validateRoleAssignment(
  actorUser: { id: string; role: string; organizationId: string },
  targetUser: { id: string; organizationId: string; role?: string },
  requestedRole: string
): RoleAssignmentValidationResult {
  const canonicalActorRole = normalizeRole(actorUser.role);
  const canonicalRequestedRole = normalizeRole(requestedRole);

  // 1. Cross-Organization Isolation Check
  if (actorUser.organizationId !== targetUser.organizationId) {
    return {
      allowed: false,
      reason: 'Cross-organization user role assignment is strictly forbidden.'
    };
  }

  // 2. Self-Role Escalation Protection Check
  if (actorUser.id === targetUser.id) {
    return {
      allowed: false,
      reason: 'Self-role escalation or modification is strictly forbidden. Users cannot alter their own system role.'
    };
  }

  // 3. Role Authority Matrix Check
  const allowedAssignable = getAllowedAssignableRoles(canonicalActorRole);
  if (!allowedAssignable.includes(canonicalRequestedRole)) {
    return {
      allowed: false,
      reason: `Role '${actorUser.role}' is not authorized to assign system role '${requestedRole}'. Allowed roles: ${allowedAssignable.join(', ')}.`
    };
  }

  return { allowed: true };
}
