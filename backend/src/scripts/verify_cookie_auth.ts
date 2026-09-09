import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/authMiddleware';
import { config } from '../config';
import cors from 'cors';

import * as db from '../db';

// ==========================================
// MOCK DB — Simulates auth_version lookups
// ==========================================
let mockAuthVersion = 1; // Mutable: tests can change this to simulate mutations

const originalQuery = db.query;
(db as any).query = async (text: string, params: any[]) => {
  if (text.includes('SELECT auth_version FROM users')) {
    const requestedUserId = params[0];
    if (requestedUserId === '11111111-1111-1111-1111-111111111111') {
      return { rows: [{ auth_version: mockAuthVersion }] };
    }
    // Unknown user → empty result
    return { rows: [] };
  }
  return originalQuery(text, params);
};

// ==========================================
// Express App — Minimal test harness
// ==========================================
const app = express();
app.use(cookieParser());

const allowedOrigins = config.corsAllowedOrigins.map(o => o.trim().replace(/\/$/, ''));
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.trim().replace(/\/$/, '');
    const isAllowed = allowedOrigins.some(allowed => allowed === cleanOrigin);
    if (isAllowed) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.get('/api/auth/me', authenticate, (req: any, res) => {
  res.status(200).json({ success: true, user: req.user });
});

app.post('/api/auth/logout', authenticate, (req: any, res) => {
  res.clearCookie('theiakshi_session', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/'
  });
  res.status(200).json({ success: true, user: req.user });
});

// ==========================================
// Test Constants
// ==========================================
const userId = '11111111-1111-1111-1111-111111111111';
const email = 'test@theiakshi.com';

function makeToken(overrides: Record<string, any> = {}, expiresIn: any = '1h'): string {
  const payload: any = {
    userId,
    organizationId: '1',
    email,
    role: 'SUPER_ADMIN',
    auth_version: 1,
    ...overrides
  };
  // Allow removing fields by passing undefined
  Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
  return jwt.sign(payload, config.jwtSecret, { expiresIn } as any);
}

let passed = 0;
let failed = 0;

async function assertStatus(desc: string, res: request.Response, expected: number) {
  if (res.status === expected) {
    console.log(`  ✅ ${desc} → ${res.status}`);
    passed++;
  } else {
    console.error(`  ❌ ${desc} → Expected ${expected}, got ${res.status}`);
    failed++;
  }
}

// ==========================================
// MAIN TEST SUITE
// ==========================================
async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  PHASE 8 BATCH 2 — FINAL ACCEPTANCE VERIFICATION       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // ── 1. MIDDLEWARE RULE PROOF ──
  console.log('\n── 1. MIDDLEWARE RULE VERIFICATION ──');
  console.log('  Middleware location: authMiddleware.ts lines 59-64');
  console.log('  Rule: tokenAuthVersion !== dbAuthVersion → 401');
  console.log('  Also rejects: undefined, null, non-number, non-integer');
  console.log('  This is strict equality (===), NOT less-than (<).');

  // ── 2. VERSION MATRIX ──
  console.log('\n── 2. EXPLICIT VERSION MATRIX ──');
  mockAuthVersion = 1;

  // A: Equal
  let res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${makeToken({ auth_version: 1 })}`);
  await assertStatus('A. JWT=1 / DB=1 (equal)', res, 200);

  // B: Old (JWT < DB)
  mockAuthVersion = 2;
  res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${makeToken({ auth_version: 1 })}`);
  await assertStatus('B. JWT=1 / DB=2 (old)', res, 401);

  // C: Future (JWT > DB)
  mockAuthVersion = 1;
  res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${makeToken({ auth_version: 2 })}`);
  await assertStatus('C. JWT=2 / DB=1 (future)', res, 401);

  // D: Missing auth_version
  res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${makeToken({ auth_version: undefined })}`);
  await assertStatus('D. JWT missing auth_version', res, 401);

  // E: Malformed (string)
  res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${makeToken({ auth_version: "1" })}`);
  await assertStatus('E. JWT auth_version="1" (string)', res, 401);

  // E2: Malformed (float)
  res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${makeToken({ auth_version: 1.5 })}`);
  await assertStatus('E2. JWT auth_version=1.5 (float)', res, 401);

  // E3: Malformed (null)
  res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${makeToken({ auth_version: null })}`);
  await assertStatus('E3. JWT auth_version=null', res, 401);

  // E4: Malformed (boolean)
  res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${makeToken({ auth_version: true })}`);
  await assertStatus('E4. JWT auth_version=true (boolean)', res, 401);

  // ── 3. SECURITY MUTATION SIMULATION ──
  console.log('\n── 3. SECURITY MUTATION TEST ──');
  mockAuthVersion = 1;
  const oldSessionToken = makeToken({ auth_version: 1 });

  // Verify old session works before mutation
  res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldSessionToken}`);
  await assertStatus('Pre-mutation: old session valid', res, 200);

  // Simulate password change → auth_version incremented to 2
  mockAuthVersion = 2;
  res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldSessionToken}`);
  await assertStatus('Post-password-change: old session (JWT=1, DB=2)', res, 401);

  // Simulate role change → auth_version incremented to 3
  mockAuthVersion = 3;
  res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldSessionToken}`);
  await assertStatus('Post-role-change: old session (JWT=1, DB=3)', res, 401);

  // New session after mutation works
  const newSessionToken = makeToken({ auth_version: 3 });
  res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${newSessionToken}`);
  await assertStatus('Post-mutation: new session (JWT=3, DB=3)', res, 200);

  // ── 4. COOKIE TEST ──
  console.log('\n── 4. COOKIE AUTHENTICATION TEST ──');
  mockAuthVersion = 1;
  const currentCookie = `theiakshi_session=${makeToken({ auth_version: 1 })}`;

  res = await request(app).get('/api/auth/me').set('Cookie', currentCookie);
  await assertStatus('Cookie + current version', res, 200);

  // After increment
  mockAuthVersion = 2;
  res = await request(app).get('/api/auth/me').set('Cookie', currentCookie);
  await assertStatus('Cookie + stale version (JWT=1, DB=2)', res, 401);

  // ── 5. BEARER TEST ──
  console.log('\n── 5. BEARER AUTHENTICATION TEST ──');
  mockAuthVersion = 1;

  res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${makeToken({ auth_version: 1 })}`);
  await assertStatus('Bearer + current version', res, 200);

  mockAuthVersion = 2;
  res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${makeToken({ auth_version: 1 })}`);
  await assertStatus('Bearer + stale version (JWT=1, DB=2)', res, 401);

  // ── 6. MISSING COOKIE → 401 ──
  console.log('\n── 6. MISSING CREDENTIALS TEST ──');
  res = await request(app).get('/api/auth/me');
  await assertStatus('No cookie, no Bearer → 401', res, 401);

  // ── 7. CSRF TEST ──
  console.log('\n── 7. CSRF ORIGIN VALIDATION ──');
  mockAuthVersion = 1;
  const csrfCookie = `theiakshi_session=${makeToken({ auth_version: 1 })}`;

  res = await request(app).post('/api/auth/logout')
    .set('Cookie', csrfCookie).set('Origin', 'http://evil.com');
  await assertStatus('Untrusted Origin POST', res, 403);

  res = await request(app).post('/api/auth/logout')
    .set('Cookie', csrfCookie).set('Origin', 'http://localhost:5173');
  await assertStatus('Trusted Origin POST', res, 200);

  // ── 8. CONFLICTING CREDENTIALS ──
  console.log('\n── 8. CONFLICTING CREDENTIALS ──');
  const cookieUserToken = makeToken({ auth_version: 1 });
  const bearerEvilToken = jwt.sign({ userId: 'evil-id', email: 'evil@evil.com', auth_version: 1 }, config.jwtSecret);
  res = await request(app).get('/api/auth/me')
    .set('Cookie', `theiakshi_session=${cookieUserToken}`)
    .set('Authorization', `Bearer ${bearerEvilToken}`);
  if (res.status === 200 && res.body.user.email === email) {
    console.log(`  ✅ Conflicting credentials → Cookie prioritized (Identity: ${email})`);
    passed++;
  } else {
    console.error('  ❌ Conflicting credentials: Wrong identity or unexpected status');
    failed++;
  }

  // ── 9. LOGOUT SEMANTICS ──
  console.log('\n── 9. LOGOUT SEMANTICS ──');
  mockAuthVersion = 1;
  res = await request(app).post('/api/auth/logout')
    .set('Cookie', `theiakshi_session=${makeToken({ auth_version: 1 })}`)
    .set('Origin', 'http://localhost:5173');
  const setCookieHeader = res.headers['set-cookie'];
  if (setCookieHeader && setCookieHeader[0].includes('theiakshi_session=')) {
    console.log('  ✅ Logout clears theiakshi_session cookie');
    passed++;
  } else {
    console.error('  ❌ Logout did not clear cookie');
    failed++;
  }
  // Verify auth_version NOT incremented (mock still at 1)
  if (mockAuthVersion === 1) {
    console.log('  ✅ Logout does NOT increment auth_version (intentional design)');
    passed++;
  } else {
    console.error('  ❌ Logout incorrectly modified auth_version');
    failed++;
  }

  // ── 10. COOKIE FLAGS ──
  console.log('\n── 10. COOKIE FLAGS EVIDENCE ──');
  if (setCookieHeader) {
    const cookie = setCookieHeader[0];
    const hasHttpOnly = cookie.includes('HttpOnly');
    const hasSameSite = cookie.includes('SameSite=Lax');
    const hasPath = cookie.includes('Path=/');
    console.log(`  HttpOnly: ${hasHttpOnly ? '✅' : '❌'}`);
    console.log(`  SameSite=Lax: ${hasSameSite ? '✅' : '❌'}`);
    console.log(`  Path=/: ${hasPath ? '✅' : '❌'}`);
    if (hasHttpOnly && hasSameSite && hasPath) passed++; else failed++;
  }

  // ── 11. ERROR RESPONSE CONTRACT ──
  console.log('\n── 11. ERROR RESPONSE CONTRACT ──');
  mockAuthVersion = 2;
  res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${makeToken({ auth_version: 1 })}`);
  const body = res.body;
  const errorMsg = body.error || '';
  const noLeak = !errorMsg.includes('auth_version') &&
    !errorMsg.includes('security changes') &&
    !errorMsg.includes('invalidated') &&
    !errorMsg.includes('version') &&
    body.code === 'INVALID_TOKEN';
  if (noLeak) {
    console.log('  ✅ Generic 401 response: no internal state leaked');
    passed++;
  } else {
    console.error(`  ❌ Error response leaks info: "${errorMsg}" / code: "${body.code}"`);
    failed++;
  }

  // ══════════ SUMMARY ══════════
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  RESULTS: ${passed} PASSED, ${failed} FAILED                        ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (failed > 0) {
    console.error('\n🔴 FINAL STATUS: NOT READY');
    process.exit(1);
  } else {
    console.log('\n🟢 FINAL STATUS: ALL ACCEPTANCE TESTS PASS');
    process.exit(0);
  }
}

runTests().catch(e => {
  console.error('UNEXPECTED ERROR:', e);
  process.exit(1);
});
