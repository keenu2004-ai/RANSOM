import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../types';

const loginSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required')
});

export class AuthController {
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
}
