import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthenticatedRequest, AuthUser } from '../types';

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication token is required.',
      code: 'UNAUTHENTICATED'
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;

    req.user = {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      email: decoded.email,
      role: decoded.role,
      employeeId: decoded.employeeId !== undefined ? decoded.employeeId : null
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Session expired or invalid token. Please log in again.',
      code: 'INVALID_TOKEN'
    });
  }
}
