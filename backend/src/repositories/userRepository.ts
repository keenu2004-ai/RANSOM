import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db';
import { validateRoleAssignment, getAllowedAssignableRoles } from '../utils/roleAuthority';
import { normalizeRole } from '../config/permissions';

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
  password_hash?: string;
  status: string;
  role: string;
  role_name?: string;
  employee_id?: string | null;
  employee_code?: string | null;
  employee_name?: string | null;
  created_at?: Date;
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
        COALESCE(r.name, 'EMPLOYEE') as role,
        r.name as role_name
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
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
        COALESCE(r.name, 'EMPLOYEE') as role,
        r.name as role_name
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
      LIMIT 1
    `;
    const res = await query<UserWithRole>(text, [userId]);
    return res.rows[0] || null;
  }

  static async findAll(organizationId: string, filters?: { search?: string; role?: string }): Promise<UserWithRole[]> {
    let whereClause = `WHERE u.organization_id = $1`;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filters?.search) {
      whereClause += ` AND (LOWER(u.email) LIKE $${paramIndex} OR LOWER(e.first_name) LIKE $${paramIndex} OR LOWER(e.last_name) LIKE $${paramIndex} OR LOWER(e.employee_code) LIKE $${paramIndex})`;
      params.push(`%${filters.search.toLowerCase()}%`);
      paramIndex++;
    }

    if (filters?.role) {
      whereClause += ` AND r.name = $${paramIndex}`;
      params.push(normalizeRole(filters.role));
      paramIndex++;
    }

    const text = `
      SELECT 
        u.id,
        u.organization_id,
        u.email,
        u.status,
        COALESCE(r.name, 'EMPLOYEE') as role,
        r.name as role_name,
        e.id as employee_id,
        e.employee_code,
        CASE WHEN e.id IS NOT NULL THEN CONCAT(e.first_name, ' ', e.last_name) ELSE NULL END as employee_name,
        u.created_at
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN employees e ON e.user_id = u.id
      ${whereClause}
      ORDER BY u.created_at DESC
    `;

    const res = await query<UserWithRole>(text, params);
    return res.rows;
  }

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

  static async updateRole(
    actorUser: { id: string; role: string; organizationId: string },
    targetUserId: string,
    requestedRole: string
  ): Promise<{ success: boolean; newRole: string }> {
    const canonicalRequestedRole = normalizeRole(requestedRole);

    return withTransaction(async (client) => {
      // 1. Lock Target User row DIRECTLY (without outer joins to prevent PostgreSQL 'FOR UPDATE cannot be applied to the nullable side of an outer join' error)
      const targetUserRes = await client.query(`
        SELECT id, organization_id, email, status
        FROM users
        WHERE id = $1
        FOR UPDATE
      `, [targetUserId]);

      if (targetUserRes.rows.length === 0) {
        throw new Error('Target user account not found.');
      }

      const targetUser = targetUserRes.rows[0];

      // Verify Cross-Organization Isolation
      if (targetUser.organization_id !== actorUser.organizationId) {
        const err: any = new Error('Cross-organization operation strictly forbidden.');
        err.statusCode = 403;
        err.code = 'PERMISSION_DENIED';
        throw err;
      }

      // 2. Fetch current target role in a separate query (without FOR UPDATE on outer joins)
      const currentRoleRes = await client.query(`
        SELECT COALESCE(r.name, 'EMPLOYEE') as current_role
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.id = $1
        LIMIT 1
      `, [targetUserId]);

      const currentRole = currentRoleRes.rows[0]?.current_role || 'EMPLOYEE';

      // 3. Validate Role Assignment Authority & Self-Escalation Protection
      const validation = validateRoleAssignment(actorUser, {
        id: targetUser.id,
        organizationId: targetUser.organization_id,
        role: currentRole
      }, canonicalRequestedRole);

      if (!validation.allowed) {
        const err: any = new Error(validation.reason);
        err.statusCode = 403;
        err.code = 'PERMISSION_DENIED';
        throw err;
      }

      // 4. Resolve Target Role ID in Organization or System Roles
      let roleRes = await client.query(
        'SELECT id FROM roles WHERE (organization_id = $1 OR is_system_role = TRUE) AND name = $2 ORDER BY is_system_role DESC LIMIT 1',
        [actorUser.organizationId, canonicalRequestedRole]
      );

      // If system role missing in DB for this org, create it idempotently
      if (roleRes.rows.length === 0) {
        roleRes = await client.query(`
          INSERT INTO roles (organization_id, name, description, is_system_role)
          VALUES ($1, $2, $3, TRUE)
          ON CONFLICT (name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `, [actorUser.organizationId, canonicalRequestedRole, `System role ${canonicalRequestedRole}`]);
      }

      const newRoleId = roleRes.rows[0].id;

      // 5. Update user_roles table atomically
      await client.query('DELETE FROM user_roles WHERE user_id = $1', [targetUserId]);
      await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [targetUserId, newRoleId]);

      // 6. Keep users table updated_at synchronized
      await client.query('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [targetUserId]);

      // 7. Audit Logging for Role Change
      await client.query(`
        INSERT INTO audit_logs (
          organization_id, user_id, action, module, entity_name, entity_id, old_values, new_values
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        actorUser.organizationId,
        actorUser.id,
        'USER_ROLE_CHANGED',
        'users',
        'User',
        targetUserId,
        JSON.stringify({ role: currentRole }),
        JSON.stringify({ role: canonicalRequestedRole, target_user_email: targetUser.email })
      ]);

      // 8. In-App Notification to Target User
      await client.query(`
        INSERT INTO notifications (organization_id, user_id, title, message)
        VALUES ($1, $2, 'System Role Updated', $3)
      `, [
        actorUser.organizationId,
        targetUserId,
        `Your system role has been updated to ${canonicalRequestedRole}. User must sign in again for the new token to take effect.`
      ]);

      return { success: true, newRole: canonicalRequestedRole };
    });
  }

  static async updateStatus(
    actorUser: { id: string; role: string; organizationId: string },
    targetUserId: string,
    newStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  ): Promise<void> {
    const userRes = await query('SELECT organization_id FROM users WHERE id = $1', [targetUserId]);
    if (userRes.rows.length === 0) {
      throw new Error('User account not found.');
    }
    if (userRes.rows[0].organization_id !== actorUser.organizationId) {
      const err: any = new Error('Cross-organization operation strictly forbidden.');
      err.statusCode = 403;
      throw err;
    }

    await query('UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStatus, targetUserId]);
  }

  static async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const text = `
      UPDATE users
      SET password_hash = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await query(text, [userId, passwordHash]);
  }

  static async resetPasswordByAdmin(
    actorUser: { id: string; role: string; organizationId: string },
    targetUserId: string,
    newPassword?: string
  ): Promise<{ success: boolean; temporaryPassword: string }> {
    return withTransaction(async (client) => {
      // 1. Lock Target User row DIRECTLY
      const targetUserRes = await client.query(`
        SELECT id, organization_id, email, status
        FROM users
        WHERE id = $1
        FOR UPDATE
      `, [targetUserId]);

      if (targetUserRes.rows.length === 0) {
        const err: any = new Error('Target user account not found.');
        err.statusCode = 404;
        throw err;
      }

      const targetUser = targetUserRes.rows[0];

      // Verify Cross-Organization Isolation
      if (targetUser.organization_id !== actorUser.organizationId) {
        const err: any = new Error('Cross-organization operation strictly forbidden.');
        err.statusCode = 403;
        err.code = 'PERMISSION_DENIED';
        throw err;
      }

      // 2. Resolve temporary password (provided or generated)
      const tempPassword = newPassword && newPassword.trim().length >= 6 
        ? newPassword.trim() 
        : `TempPass#${Math.floor(1000 + Math.random() * 9000)}`;

      // 3. Hash temporary password with bcrypt
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      // 4. Update users table password_hash
      await client.query(`
        UPDATE users
        SET password_hash = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [targetUserId, passwordHash]);

      // 5. Write USER_PASSWORD_RESET Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          organization_id, user_id, action, module, entity_name, entity_id, old_values, new_values
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        actorUser.organizationId,
        actorUser.id,
        'USER_PASSWORD_RESET',
        'users',
        'User',
        targetUserId,
        JSON.stringify({ action: 'RESET_TRIGGERED' }),
        JSON.stringify({ target_user_email: targetUser.email, timestamp: new Date().toISOString() })
      ]);

      // 6. Send In-App Notification to Target User
      await client.query(`
        INSERT INTO notifications (organization_id, user_id, title, message)
        VALUES ($1, $2, 'Password Reset by Administrator', $3)
      `, [
        actorUser.organizationId,
        targetUserId,
        'Your password was reset by an administrator. Please sign in with your temporary password and change it immediately.'
      ]);

      return { success: true, temporaryPassword: tempPassword };
    });
  }
}
