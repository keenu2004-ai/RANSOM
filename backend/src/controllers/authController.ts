import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../types';

const loginSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required')
});

export class AuthController {
  static async microsoft(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { token, idToken, accessToken } = req.body || {};
      const microsoftToken = token || idToken || accessToken;

      if (!microsoftToken) {
        return res.status(400).json({
          success: false,
          error: 'Microsoft authentication token is required.',
          code: 'VALIDATION_ERROR'
        });
      }

      const result = await AuthService.loginWithMicrosoftToken(microsoftToken);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      return next(error);
    }
  }
  static async login(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: parseResult.error.errors[0].message,
          code: 'VALIDATION_ERROR'
        });
      }

      const { email, password } = parseResult.data;
      const result = await AuthService.login(email, password);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      return next(error);
    }
  }

  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthenticated user.',
          code: 'UNAUTHENTICATED'
        });
      }

      const user = await AuthService.getMe(req.user.userId);
      return res.status(200).json({
        success: true,
        data: { user }
      });
    } catch (error) {
      return next(error);
    }
  }

  static async logout(req: AuthenticatedRequest, res: Response) {
    return res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully.' }
    });
  }

  static async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthenticated user.', code: 'UNAUTHENTICATED' });
      }

      const { currentPassword, newPassword, confirmPassword } = req.body;
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ success: false, error: 'Current password, new password, and confirmation are required.', code: 'VALIDATION_ERROR' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, error: 'New passwords do not match.', code: 'PASSWORD_MISMATCH' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.', code: 'WEAK_PASSWORD' });
      }

      await AuthService.changePassword(req.user.userId, currentPassword, newPassword);

      return res.status(200).json({
        success: true,
        data: { message: 'Password updated successfully.' }
      });
    } catch (error) {
      return next(error);
    }
  }
}
