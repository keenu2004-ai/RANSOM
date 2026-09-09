import { MicrosoftAuthService, setTestJwksKeyResolver } from '../services/microsoftAuthService';
import jwt from 'jsonwebtoken';

async function runAdversarialVerification() {
  console.log('===================================================================');
  console.log('  PHASE 7 REMEDIATION — ADVERSARIAL SECURITY VERIFICATION');
  console.log('===================================================================');

  let passed = 0;
  let failed = 0;

  function assertReject(name: string, fn: () => Promise<any>, expectedErrorContains: string) {
    return fn().then(() => {
      console.error(`❌ [FAILED] ${name} — Expected rejection containing "${expectedErrorContains}" but succeeded!`);
      failed++;
    }).catch(err => {
      if (err.message.includes(expectedErrorContains)) {
        console.log(`✅ [PASSED] ${name} — Correctly rejected: ${err.message}`);
        passed++;
      } else {
        console.error(`❌ [FAILED] ${name} — Rejected, but with wrong reason. Expected "${expectedErrorContains}", got: "${err.message}"`);
        failed++;
      }
    });
  }

  // Setup mock key resolver for deterministic tests
  setTestJwksKeyResolver((kid) => {
    return 'mock-public-key'; // Normally a real PEM string
  });

  // Mock jwt.verify for these offline tests so we bypass actual RSA verification
  // and focus on claims validation
  const originalVerify = jwt.verify;
  let mockPayload: any = null;
  (jwt as any).verify = () => {
    return mockPayload;
  };

  const MOCK_TOKEN = 'header.payload.signature';
  const originalDecode = jwt.decode;
  (jwt as any).decode = () => {
    return { header: { kid: 'test-kid', alg: 'RS256' } };
  };

  const configuredTenantId = 'tenant-123';
  const configuredClientId = 'client-456';
  process.env.MICROSOFT_TENANT_ID = configuredTenantId;
  process.env.MICROSOFT_CLIENT_ID = configuredClientId;
  process.env.NODE_ENV = 'production';

  // 1. Missing issuer
  mockPayload = {
    aud: configuredClientId,
    tid: configuredTenantId,
    oid: 'user-oid'
  };
  await assertReject('Missing Issuer', () => MicrosoftAuthService.verifyMicrosoftToken(MOCK_TOKEN), 'missing mandatory issuer');

  // 2. Wrong issuer
  mockPayload = {
    aud: configuredClientId,
    tid: configuredTenantId,
    oid: 'user-oid',
    iss: 'https://login.microsoftonline.com/wrong-tenant/v2.0'
  };
  await assertReject('Wrong Issuer', () => MicrosoftAuthService.verifyMicrosoftToken(MOCK_TOKEN), 'Invalid Microsoft token issuer');

  // 3. Prefix/lookalike issuer
  mockPayload = {
    aud: configuredClientId,
    tid: configuredTenantId,
    oid: 'user-oid',
    iss: `https://login.microsoftonline.com/${configuredTenantId}/v2.0/lookalike`
  };
  await assertReject('Prefix/Lookalike Issuer', () => MicrosoftAuthService.verifyMicrosoftToken(MOCK_TOKEN), 'Invalid Microsoft token issuer');

  // 4. Missing tid
  mockPayload = {
    aud: configuredClientId,
    oid: 'user-oid',
    iss: `https://login.microsoftonline.com/${configuredTenantId}/v2.0`
  };
  await assertReject('Missing tid (Personal Account Fallback)', () => MicrosoftAuthService.verifyMicrosoftToken(MOCK_TOKEN), 'missing mandatory tenant identifier');

  // 5. Wrong tenant
  mockPayload = {
    aud: configuredClientId,
    tid: 'other-tenant',
    oid: 'user-oid',
    iss: `https://login.microsoftonline.com/${configuredTenantId}/v2.0`
  };
  await assertReject('Wrong Tenant', () => MicrosoftAuthService.verifyMicrosoftToken(MOCK_TOKEN), 'Unauthorized Microsoft tenant directory');

  // 6. Wrong audience
  mockPayload = {
    aud: 'wrong-client',
    tid: configuredTenantId,
    oid: 'user-oid',
    iss: `https://login.microsoftonline.com/${configuredTenantId}/v2.0`
  };
  await assertReject('Wrong Audience', () => MicrosoftAuthService.verifyMicrosoftToken(MOCK_TOKEN), 'mismatch');

  // Restore mocks
  (jwt as any).verify = originalVerify;
  (jwt as any).decode = originalDecode;

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAdversarialVerification();
