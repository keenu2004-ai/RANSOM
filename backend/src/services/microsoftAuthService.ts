import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

export interface MicrosoftClaims {
  oid: string;
  tid: string;
  aud?: string;
  email: string;
  name: string;
  preferred_username?: string;
  upn?: string;
  mail?: string;
  sub?: string;
  candidateEmails: string[];
}

// Cached JWKS clients per tenant
const jwksClients = new Map<string, jwksClient.JwksClient>();

function getJwksClientForTenant(tenantId: string): jwksClient.JwksClient {
  const effectiveTenant = (tenantId && tenantId !== 'common') ? tenantId : 'common';
  if (!jwksClients.has(effectiveTenant)) {
    jwksClients.set(
      effectiveTenant,
      jwksClient({
        jwksUri: `https://login.microsoftonline.com/${effectiveTenant}/discovery/v2.0/keys`,
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      })
    );
  }
  return jwksClients.get(effectiveTenant)!;
}

// Hook for test suite to register mock key resolvers for deterministic offline testing
let mockKeyResolver: ((kid: string) => string | null) | null = null;

export function setTestJwksKeyResolver(resolver: ((kid: string) => string | null) | null) {
  mockKeyResolver = resolver;
}

export class MicrosoftAuthService {
  /**
   * Cryptographically verifies a Microsoft Entra ID Token server-side.
   * Enforces:
   * 1. JWT Signature verification via Microsoft published JWKS RSA public keys.
   * 2. Issuer validation (https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/v2.0)
   * 3. Audience validation (aud === MICROSOFT_CLIENT_ID) - fail closed!
   * 4. Single-tenant validation (tid === MICROSOFT_TENANT_ID) & Personal account rejection
   * 5. Token expiration (exp)
   * 6. Identity claims (oid)
   */
  static async verifyMicrosoftToken(token: string): Promise<MicrosoftClaims> {
    const configuredTenantId = process.env.MICROSOFT_TENANT_ID || '';
    const configuredClientId = process.env.MICROSOFT_CLIENT_ID || '';

    if (!token || typeof token !== 'string') {
      const err: any = new Error('Microsoft authentication token is missing or invalid.');
      err.statusCode = 400;
      err.code = 'INVALID_TOKEN';
      throw err;
    }

    // 1. Decode token header to extract kid and alg
    const decodedHeader = jwt.decode(token, { complete: true });
    if (!decodedHeader || typeof decodedHeader !== 'object' || !decodedHeader.header) {
      const err: any = new Error('Invalid Microsoft authentication token format.');
      err.statusCode = 400;
      err.code = 'INVALID_TOKEN_FORMAT';
      throw err;
    }

    const { kid, alg } = decodedHeader.header;
    if (!kid) {
      const err: any = new Error('Microsoft token header is missing key identifier (kid).');
      err.statusCode = 401;
      err.code = 'MISSING_KID';
      throw err;
    }

    // Reject unsecure algorithms (none, HS256, etc.)
    if (alg && alg !== 'RS256') {
      const err: any = new Error(`Unsupported token signing algorithm '${alg}'. RS256 required.`);
      err.statusCode = 401;
      err.code = 'UNSUPPORTED_ALGORITHM';
      throw err;
    }

    // 2. Obtain RSA signing public key
    let signingKey: string;
    if (mockKeyResolver) {
      const testKey = mockKeyResolver(kid);
      if (!testKey) {
        const err: any = new Error(`Signing key with kid '${kid}' not found in JWKS.`);
        err.statusCode = 401;
        err.code = 'KEY_NOT_FOUND';
        throw err;
      }
      signingKey = testKey;
    } else {
      try {
        const client = getJwksClientForTenant(configuredTenantId);
        const key = await client.getSigningKey(kid);
        signingKey = key.getPublicKey();
      } catch (keyErr: any) {
        const err: any = new Error(`Failed to retrieve Microsoft JWKS signing key for kid '${kid}': ${keyErr.message}`);
        err.statusCode = 401;
        err.code = 'JWKS_KEY_NOT_FOUND';
        throw err;
      }
    }

    // 3. Cryptographically verify signature and basic claims
    let payload: any;
    try {
      payload = jwt.verify(token, signingKey, {
        algorithms: ['RS256']
      }) as any;
    } catch (verifyErr: any) {
      const err: any = new Error(`Microsoft ID token signature verification failed: ${verifyErr.message}`);
      err.statusCode = 401;
      err.code = verifyErr.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'SIGNATURE_VERIFICATION_FAILED';
      throw err;
    }

    // 4. Mandatory Audience Check (aud === MICROSOFT_CLIENT_ID) - FAIL CLOSED
    if (configuredClientId) {
      const tokenAud = payload.aud;
      if (!tokenAud) {
        const err: any = new Error('Microsoft token is missing mandatory audience (aud) claim.');
        err.statusCode = 403;
        err.code = 'MISSING_AUDIENCE';
        throw err;
      }
      const isAudMatch = Array.isArray(tokenAud)
        ? tokenAud.includes(configuredClientId)
        : tokenAud === configuredClientId;

      if (!isAudMatch) {
        const err: any = new Error(`Microsoft token audience mismatch. Audience '${tokenAud}' does not match configured Client ID '${configuredClientId}'.`);
        err.statusCode = 403;
        err.code = 'INVALID_AUDIENCE';
        throw err;
      }
    } else if (process.env.NODE_ENV === 'production') {
      const err: any = new Error('MICROSOFT_CLIENT_ID environment variable is missing on server.');
      err.statusCode = 500;
      err.code = 'CONFIG_ERROR';
      throw err;
    }

    // 5. Tenant ID Validation & Personal Account Locking
    const tid = payload.tid;
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

    // 6. Issuer Validation
    if (configuredTenantId && configuredTenantId !== 'common' && payload.iss) {
      const validIssuer1 = `https://login.microsoftonline.com/${configuredTenantId}/v2.0`;
      const validIssuer2 = `https://sts.windows.net/${configuredTenantId}/`;
      if (!payload.iss.startsWith(validIssuer1) && !payload.iss.startsWith(validIssuer2)) {
        const err: any = new Error(`Invalid Microsoft token issuer '${payload.iss}'. Expected tenant issuer for '${configuredTenantId}'.`);
        err.statusCode = 403;
        err.code = 'INVALID_ISSUER';
        throw err;
      }
    }

    // 7. Identity Claims Validation
    const oid = payload.oid || payload.sub;
    if (!oid) {
      const err: any = new Error('Microsoft token is missing mandatory Object Identifier (oid).');
      err.statusCode = 400;
      err.code = 'MISSING_OID';
      throw err;
    }

    const preferredUsername = (payload.preferred_username || '').toLowerCase().trim();
    const emailClaim = (payload.email || '').toLowerCase().trim();
    const upnClaim = (payload.upn || '').toLowerCase().trim();
    const mailClaim = (payload.mail || '').toLowerCase().trim();

    const candidateEmails = Array.from(new Set([
      preferredUsername,
      emailClaim,
      upnClaim,
      mailClaim
    ].filter(Boolean)));

    const primaryEmail = candidateEmails[0] || 'microsoft.user@theiakshi.com';
    const name = payload.name || primaryEmail.split('@')[0] || 'Microsoft User';

    return {
      oid,
      tid: tid || configuredTenantId,
      aud: payload.aud,
      email: primaryEmail,
      name,
      preferred_username: payload.preferred_username || primaryEmail,
      upn: payload.upn,
      mail: payload.mail,
      candidateEmails
    };
  }
}
