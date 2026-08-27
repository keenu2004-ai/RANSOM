import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../db';
import { UserRepository } from '../repositories/userRepository';
import { AuthUser } from '../types';
import { MicrosoftAuthService } from './microsoftAuthService';
import { normalizeRole } from '../config/permissions';

export class AuthService {
  static async loginWithMicrosoftToken(microsoftToken: string): Promise<{ token: string; user: AuthUser }> {
    const claims = await MicrosoftAuthService.verifyMicrosoftToken(microsoftToken);

    // 1. Primary Identity Lookup by Microsoft Object Identifier (oid)
    let userWithRole = await UserRepository.findByMicrosoftOid(claims.oid);

    // 2. Secondary Fallback Lookup by Candidate Emails (for first-time Microsoft identity linking)
    if (!userWithRole && claims.candidateEmails && claims.candidateEmails.length > 0) {
      userWithRole = await UserRepository.findByCandidateEmails(claims.candidateEmails);
      if (!userWithRole && claims.email) {
        userWithRole = await UserRepository.findByEmail(claims.email);
      }
      if (userWithRole) {
        await UserRepository.linkMicrosoftIdentity(userWithRole.id, claims.oid, claims.tid);
      }
    }

    if (process.env.DEBUG_AUTH === 'true' || process.env.NODE_ENV === 'development') {
      console.log('[MICROSOFT AUTH DIAGNOSTIC]', {
        oid: claims.oid,
        tid: claims.tid,
        candidateEmails: claims.candidateEmails,
        matchedUserId: userWithRole ? userWithRole.id : null,
        matchedRole: userWithRole ? (userWithRole.role || userWithRole.role_name) : null,
        status: userWithRole ? userWithRole.status : 'NOT_FOUND'
      });
    }

    if (!userWithRole) {
      const err: any = new Error('Your Microsoft account is authenticated, but it is not linked to an authorized THEIAKSHI account. Contact the THEIAKSHI administrator.');
      err.statusCode = 403;
      err.code = 'UNAUTHORIZED_USER';
      throw err;
    }

    if (userWithRole.status !== 'ACTIVE') {
      const err: any = new Error('Your user account is suspended or inactive.');
      err.statusCode = 403;
      err.code = 'ACCOUNT_INACTIVE';
      throw err;
    }

    const employeeId = await UserRepository.findEmployeeIdByUserId(userWithRole.id, userWithRole.organization_id);
    const canonicalRole = normalizeRole(userWithRole.role || userWithRole.role_name);

    const resolvedName = (userWithRole.first_name || userWithRole.last_name)
      ? `${userWithRole.first_name || ''} ${userWithRole.last_name || ''}`.trim()
      : (userWithRole.display_name && userWithRole.display_name.trim() !== '')
        ? userWithRole.display_name.trim()
        : claims.name || userWithRole.email.split('@')[0];

    const authUser: AuthUser = {
      userId: userWithRole.id,
      organizationId: userWithRole.organization_id,
      email: userWithRole.email,
      role: canonicalRole,
      employeeId: employeeId,
      name: resolvedName,
      displayName: resolvedName,
      firstName: userWithRole.first_name || null,
      lastName: userWithRole.last_name || null
    };

    const token = jwt.sign(authUser, config.jwtSecret, { expiresIn: '24h' });

    // Record Audit Event
    try {
      await query(`
        INSERT INTO audit_logs (organization_id, user_id, action, module, entity_name, entity_id, new_values)
        VALUES ($1, $2, 'LOGIN_SUCCESS', 'security', 'User', $2, $3)
      `, [
        userWithRole.organization_id,
        userWithRole.id,
        JSON.stringify({
          provider: 'MICROSOFT_ENTRA_ID',
          microsoft_oid: claims.oid,
          microsoft_tid: claims.tid,
          email: userWithRole.email
        })
      ]);
    } catch (auditErr) {
      console.error('Failed to log audit event for Microsoft login:', auditErr);
    }

    return { token, user: authUser };
  }

  static async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    // Password login policy check (Allow legacy password login unless explicitly set to false)
    if (process.env.ALLOW_PASSWORD_LOGIN === 'false') {
      const err: any = new Error('Password authentication has been disabled by the administrator. Please sign in with Microsoft.');
      err.statusCode = 400;
      err.code = 'MICROSOFT_AUTH_REQUIRED';
      throw err;
    }

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
    const canonicalRole = normalizeRole(userWithRole.role || userWithRole.role_name);

    const resolvedName = (userWithRole.first_name || userWithRole.last_name)
      ? `${userWithRole.first_name || ''} ${userWithRole.last_name || ''}`.trim()
      : (userWithRole.display_name && userWithRole.display_name.trim() !== '')
        ? userWithRole.display_name.trim()
        : userWithRole.email.split('@')[0];

    const authUser: AuthUser = {
      userId: userWithRole.id,
      organizationId: userWithRole.organization_id,
      email: userWithRole.email,
      role: canonicalRole,
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
