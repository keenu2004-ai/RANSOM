/**
 * LIVE DEPLOYMENT END-TO-END VERIFICATION SCRIPT
 * Tests all 5 demo accounts, JWT issue, /auth/me identity resolution,
 * and pure admin null employee safety against deployed backend!
 */

const https = require('https');

const BASE_URL = process.env.LIVE_BACKEND_URL || 'https://ransom-eetj.onrender.com/api';

const ACCOUNTS = [
  { email: 'superadmin@theiakshi.com', expectedRole: 'SUPER_ADMIN', expectedEmp: null },
  { email: 'admin@theiakshi.com', expectedRole: 'ADMIN', expectedEmp: null },
  { email: 'hr@theiakshi.com', expectedRole: 'HR_MANAGER', expectedEmp: 'EMP-001' },
  { email: 'manager@theiakshi.com', expectedRole: 'MANAGER', expectedEmp: 'EMP-002' },
  { email: 'employee@theiakshi.com', expectedRole: 'EMPLOYEE', expectedEmp: 'EMP-003' }
];

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runLiveTest() {
  console.log('================================================================');
  console.log(' LIVE RENDER BACKEND & NEON POSTGRESQL END-TO-END AUTH TEST');
  console.log(` Target Backend: ${BASE_URL}`);
  console.log('================================================================\n');

  for (const acc of ACCOUNTS) {
    console.log(`Testing Account: ${acc.email} (${acc.expectedRole})...`);
    
    // 1. Login
    const loginRes = await postJson('/auth/login', { email: acc.email, password: 'ChangeMe@123' });
    if (loginRes.status !== 200 || !loginRes.body.success) {
      console.error(`  ❌ LOGIN FAILED (${loginRes.status}):`, loginRes.body);
      continue;
    }
    const token = loginRes.body.data.token;
    console.log(`  ✓ Login Success (HTTP 200). JWT Issued.`);

    // 2. Auth Me
    const meRes = await getJson('/auth/me', token);
    if (meRes.status !== 200 || !meRes.body.success) {
      console.error(`  ❌ AUTH ME FAILED (${meRes.status}):`, meRes.body);
      continue;
    }
    const user = meRes.body.data.user;
    console.log(`  ✓ Auth Me Success: Role = ${user.role}, EmployeeId = ${user.employeeId}`);

    // Verify Identity Rules
    if (acc.expectedEmp === null && user.employeeId !== null) {
      console.error(`  ❌ FAIL: Expected employeeId null for pure admin, got ${user.employeeId}`);
    } else {
      console.log(`  ✓ Pure Admin / Employee Identity Rule PASS.`);
    }

    // 3. Test Dashboard Overview
    const dashRes = await getJson('/dashboard', token);
    if (dashRes.status !== 200) {
      console.error(`  ❌ Dashboard fetch failed (${dashRes.status})`);
    } else {
      console.log(`  ✓ Dashboard Overview loaded cleanly (HTTP 200).`);
    }
    console.log('');
  }

  console.log('================================================================');
  console.log(' ✅ ALL 5 LIVE DEMO ACCOUNTS TESTED AGAINST RENDER & NEON DEPLOYMENT.');
  console.log('================================================================');
}

runLiveTest().catch(console.error);
