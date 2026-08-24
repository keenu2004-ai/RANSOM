export interface UserIdentity {
  displayName?: string;
  name?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
}

/**
 * Canonical Display Name Resolution Helper
 * 1. employee.first_name + employee.last_name
 * 2. user.displayName / user.name
 * 3. email prefix fallback
 */
export function getDisplayName(user?: UserIdentity | null): string {
  if (!user) return 'User';
  if (user.displayName && user.displayName.trim() !== '') return user.displayName.trim();
  if (user.name && user.name.trim() !== '') return user.name.trim();
  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }
  if (user.email) {
    const part = user.email.split('@')[0];
    return part.charAt(0).toUpperCase() + part.slice(1);
  }
  return 'User';
}
