import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
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

    const isMatch = await bcrypt.compare(password, userWithRole.password_hash);
    if (!isMatch) {
      const err: any = new Error('Invalid email or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const employeeId = await UserRepository.findEmployeeIdByUserId(userWithRole.id, userWithRole.organization_id);

    const authUser: AuthUser = {
      userId: userWithRole.id,
      organizationId: userWithRole.organization_id,
      email: userWithRole.email,
      role: userWithRole.role_name,
      employeeId: employeeId // Explicit string | null
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

    return {
      userId: userWithRole.id,
      organizationId: userWithRole.organization_id,
      email: userWithRole.email,
      role: userWithRole.role_name,
      employeeId: employeeId // Explicit string | null
    };
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const userWithRole = await UserRepository.findById(userId);
    if (!userWithRole) {
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
  }
}
