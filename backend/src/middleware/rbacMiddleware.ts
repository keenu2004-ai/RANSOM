import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { hasPermission, normalizeRole, ScopeLevel } from '../config/permissions';

/**
 * Ensures req.user role matches one of the allowed role names (supports ADMINISTRATOR alias normalization)
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication is required.',
        code: 'UNAUTHENTICATED'
      });
    }

    const userRole = normalizeRole(req.user.role);
    const normalizedAllowed = allowedRoles.map(r => normalizeRole(r));

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: `Access forbidden. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`,
        code: 'FORBIDDEN'
      });
    }

    return next();
  };
}

/**
 * Centralized Permission Guard Middleware
 */
export function requirePermission(permissionKey: string, requiredScope?: ScopeLevel) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication is required.',
        code: 'UNAUTHENTICATED'
      });
    }

    const isAuthorized = hasPermission(req.user.role, permissionKey, requiredScope);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: `Permission denied. Required permission '${permissionKey}' is missing or insufficient for role '${req.user.role}'.`,
        code: 'PERMISSION_DENIED'
      });
    }

    return next();
  };
}
