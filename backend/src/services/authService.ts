import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../db';
import { UserRepository } from '../repositories/userRepository';
import { AuthUser } from '../types';

export class AuthService {
  static async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const userWithRole = await UserRepository.findByEmail(email);

    if (!userWithRole) {
      const err: any = new Error('Invalid email or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    if (userWithRole.status !== 'ACTIVE') {
      const err: any = new Error('Your user account is suspended or inactive.');
      err.statusCode = 403;
      err.code = 'ACCOUNT_INACTIVE';
      throw err;
    }

    if (!userWithRole.password_hash) {
      const err: any = new Error('Invalid email or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const isMatch = await bcrypt.compare(password, userWithRole.password_hash);
    if (!isMatch) {
      const err: any = new Error('Invalid email or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const employeeId = await UserRepository.findEmployeeIdByUserId(userWithRole.id, userWithRole.organization_id);
    const resolvedName = (userWithRole.first_name || userWithRole.last_name)
      ? `${userWithRole.first_name || ''} ${userWithRole.last_name || ''}`.trim()
      : (userWithRole.display_name && userWithRole.display_name.trim() !== '')
        ? userWithRole.display_name.trim()
        : userWithRole.email.split('@')[0];

    const authUser: AuthUser = {
      userId: userWithRole.id,
      organizationId: userWithRole.organization_id,
      email: userWithRole.email,
      role: (userWithRole.role || userWithRole.role_name || 'EMPLOYEE') as any,
      employeeId: employeeId,
      name: resolvedName,
      displayName: resolvedName,
      firstName: userWithRole.first_name || null,
      lastName: userWithRole.last_name || null
    };

    const token = jwt.sign(authUser, config.jwtSecret, { expiresIn: '24h' });

    return { token, user: authUser };
  }

  static async getMe(userId: string): Promise<AuthUser> {
    const userWithRole = await UserRepository.findById(userId);

    if (!userWithRole || userWithRole.status !== 'ACTIVE') {
      const err: any = new Error('User account not found or inactive.');
      err.statusCode = 401;
      err.code = 'UNAUTHENTICATED';
      throw err;
    }

    const employeeId = await UserRepository.findEmployeeIdByUserId(userWithRole.id, userWithRole.organization_id);
    const resolvedName = (userWithRole.first_name || userWithRole.last_name)
      ? `${userWithRole.first_name || ''} ${userWithRole.last_name || ''}`.trim()
      : (userWithRole.display_name && userWithRole.display_name.trim() !== '')
        ? userWithRole.display_name.trim()
        : userWithRole.email.split('@')[0];

    return {
      userId: userWithRole.id,
      organizationId: userWithRole.organization_id,
      email: userWithRole.email,
      role: (userWithRole.role || userWithRole.role_name || 'EMPLOYEE') as any,
      employeeId: employeeId,
      name: resolvedName,
      displayName: resolvedName,
      firstName: userWithRole.first_name || null,
      lastName: userWithRole.last_name || null
    };
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const userWithRole = await UserRepository.findById(userId);
    if (!userWithRole || !userWithRole.password_hash) {
      const err: any = new Error('User account not found.');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const isMatch = await bcrypt.compare(currentPassword, userWithRole.password_hash);
    if (!isMatch) {
      const err: any = new Error('Current password is incorrect.');
      err.statusCode = 400;
      err.code = 'INVALID_PASSWORD';
      throw err;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await UserRepository.updatePassword(userId, newHash);

    // Record Audit Log Event
    try {
      await query(`
        INSERT INTO audit_logs (organization_id, user_id, action, module, entity_name, entity_id, new_values)
        VALUES ($1, $2, 'USER_PASSWORD_CHANGED', 'security', 'User', $2, $3)
      `, [userWithRole.organization_id, userId, JSON.stringify({ message: 'User updated password successfully' })]);
    } catch (auditErr) {
      console.warn('Audit log write failed for password change:', auditErr);
    }
  }
}
