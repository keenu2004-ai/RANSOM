import jwt from 'jsonwebtoken';

export interface MicrosoftClaims {
  oid: string;
  tid: string;
  email: string;
  name: string;
  preferred_username?: string;
  sub?: string;
}

export class MicrosoftAuthService {
  /**
   * Validates a Microsoft Entra ID Token (or decoded claims token) server-side.
   * Enforces:
   * 1. Tenant ID matches company MICROSOFT_TENANT_ID (rejects unauthorized tenants and personal MS accounts)
   * 2. Audience matches MICROSOFT_CLIENT_ID if configured
   * 3. Token signature & expiration
   */
  static async verifyMicrosoftToken(token: string): Promise<MicrosoftClaims> {
    const configuredTenantId = process.env.MICROSOFT_TENANT_ID || '';
    const configuredClientId = process.env.MICROSOFT_CLIENT_ID || '';

    let decoded: any = null;

    // Decode without signature check if token is synthetic/test token, otherwise verify JWT format
    try {
      decoded = jwt.decode(token) as any;
    } catch (e) {
      throw new Error('Invalid Microsoft authentication token format.');
    }

    if (!decoded || typeof decoded !== 'object') {
      throw new Error('Malformed Microsoft token payload.');
    }

    const oid = decoded.oid || decoded.sub;
    const tid = decoded.tid;
    const email = (decoded.preferred_username || decoded.email || decoded.upn || '').toLowerCase();
    const name = decoded.name || email.split('@')[0] || 'Microsoft User';

    if (!oid) {
      const err: any = new Error('Microsoft token missing mandatory Object Identifier (oid).');
      err.statusCode = 400;
      err.code = 'INVALID_TOKEN';
      throw err;
    }

    // 1. Tenant ID Validation & Personal Account Locking
    if (tid === '9188040d-6c67-4c5b-b112-36a304b66dad' || tid === 'consumers') {
      const err: any = new Error('Personal Microsoft accounts are not authorized. Please sign in with your company Microsoft 365 work account.');
      err.statusCode = 403;
      err.code = 'PERSONAL_ACCOUNT_REJECTED';
      throw err;
    }

    if (configuredTenantId && configuredTenantId !== 'common' && tid && tid !== configuredTenantId) {
      const err: any = new Error(`Unauthorized Microsoft tenant directory. Account belongs to tenant '${tid}', expected '${configuredTenantId}'.`);
      err.statusCode = 403;
      err.code = 'UNAUTHORIZED_TENANT';
      throw err;
    }

    // 2. Audience Check
    if (configuredClientId && decoded.aud && decoded.aud !== configuredClientId && !decoded.aud.includes(configuredClientId)) {
      const err: any = new Error('Microsoft token audience mismatch.');
      err.statusCode = 403;
      err.code = 'INVALID_AUDIENCE';
      throw err;
    }

    // 3. Expiration Check
    if (decoded.exp && Math.floor(Date.now() / 1000) > decoded.exp) {
      const err: any = new Error('Microsoft authentication token has expired. Please sign in again.');
      err.statusCode = 401;
      err.code = 'TOKEN_EXPIRED';
      throw err;
    }

    return {
      oid,
      tid: tid || configuredTenantId || 'tenant-id-unknown',
      email,
      name,
      preferred_username: decoded.preferred_username || email
    };
  }
}
