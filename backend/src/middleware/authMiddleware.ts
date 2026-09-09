import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthenticatedRequest } from '../types';

import { query } from '../db';

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | null = null;
  const authHeader = req.headers.authorization;

  // 1. Prefer cookie, fallback to Bearer or query token
  if (req.cookies && req.cookies.theiakshi_session) {
    token = req.cookies.theiakshi_session;
    
    // Explicit Origin/CSRF validation for non-GET cookie requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.headers.origin || req.headers.referer;
      if (!origin) {
        return res.status(403).json({ success: false, error: 'CSRF validation failed: Missing Origin/Referer.', code: 'CSRF_FAILED' });
      }
      
      const cleanOrigin = origin.trim().replace(/\/$/, '');
      const allowedOrigins = config.corsAllowedOrigins.map(o => o.trim().replace(/\/$/, ''));
      if (!allowedOrigins.some(allowed => cleanOrigin.startsWith(allowed))) {
        return res.status(403).json({ success: false, error: 'CSRF validation failed: Untrusted Origin.', code: 'CSRF_FAILED' });
      }
    }
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication token is required.',
      code: 'UNAUTHENTICATED'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;

    // Check DB for auth_version (Immediate Invalidation)
    const userRes = await query('SELECT auth_version FROM users WHERE id = $1', [decoded.userId]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Session expired or invalid token. Please log in again.',
        code: 'INVALID_TOKEN'
      });
    }

    const dbAuthVersion = userRes.rows[0].auth_version;
    const tokenAuthVersion = decoded.auth_version;

    if (
      tokenAuthVersion === undefined ||
      tokenAuthVersion === null ||
      typeof tokenAuthVersion !== 'number' ||
      !Number.isInteger(tokenAuthVersion) ||
      tokenAuthVersion !== dbAuthVersion
    ) {
      return res.status(401).json({
        success: false,
        error: 'Session expired or invalid token. Please log in again.',
        code: 'INVALID_TOKEN'
      });
    }

    req.user = {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      email: decoded.email,
      role: decoded.role,
      auth_version: tokenAuthVersion,
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
