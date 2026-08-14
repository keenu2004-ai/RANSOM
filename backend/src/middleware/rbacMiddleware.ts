import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { query } from '../db';

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication is required.',
        code: 'UNAUTHENTICATED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access forbidden. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`,
        code: 'FORBIDDEN'
      });
    }

    return next();
  };
}

export function requirePermission(permissionKey: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication is required.',
        code: 'UNAUTHENTICATED'
      });
    }

    // SUPER_ADMIN has implicit full system control
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    try {
      const text = `
        SELECT COUNT(*)::int as count
        FROM role_permissions rp
        INNER JOIN roles r ON r.id = rp.role_id
        INNER JOIN permissions p ON p.id = rp.permission_id
        WHERE r.name = $1 AND p.key = $2
      `;
      const result = await query<{ count: number }>(text, [req.user.role, permissionKey]);

      if (result.rows[0].count === 0) {
        return res.status(403).json({
          success: false,
          error: `Permission denied. Missing required permission: ${permissionKey}`,
          code: 'PERMISSION_DENIED'
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
