import { query } from '../db';

export interface UserRecord {
  id: string;
  organization_id: string;
  email: string;
  password_hash: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserWithRole {
  id: string;
  organization_id: string;
  email: string;
  password_hash: string;
  status: string;
  role_name: string;
}

export class UserRepository {
  static async findByEmail(email: string): Promise<UserWithRole | null> {
    const text = `
      SELECT 
        u.id, 
        u.organization_id, 
        u.email, 
        u.password_hash, 
        u.status,
        r.name as role_name
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1
    `;
    const res = await query<UserWithRole>(text, [email]);
    return res.rows[0] || null;
  }

  static async findById(userId: string): Promise<UserWithRole | null> {
    const text = `
      SELECT 
        u.id, 
        u.organization_id, 
        u.email, 
        u.password_hash, 
        u.status,
        r.name as role_name
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
      LIMIT 1
    `;
    const res = await query<UserWithRole>(text, [userId]);
    return res.rows[0] || null;
  }

  /**
   * Canonical Employee Resolution Query:
   * Resolves employees.id linked to user_id for the given organization.
   * Returns employeeId (string) or null.
   */
  static async findEmployeeIdByUserId(userId: string, organizationId: string): Promise<string | null> {
    const text = `
      SELECT e.id
      FROM employees e
      WHERE e.user_id = $1 AND e.organization_id = $2
      LIMIT 1
    `;
    const res = await query<{ id: string }>(text, [userId, organizationId]);
    return res.rows[0]?.id || null;
  }
}
