import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

/**
 * Reusable backend helper requiring a linked employee profile for personal self-service actions.
 * If employeeId is null, returns structured HTTP 400 response:
 * { success: false, error: "This action requires a linked employee profile.", code: "EMPLOYEE_PROFILE_REQUIRED" }
 */
export function requireEmployee(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication is required.',
      code: 'UNAUTHENTICATED'
    });
  }

  if (!req.user.employeeId) {
    return res.status(400).json({
      success: false,
      error: 'This action requires a linked employee profile.',
      code: 'EMPLOYEE_PROFILE_REQUIRED'
    });
  }

  return next();
}
