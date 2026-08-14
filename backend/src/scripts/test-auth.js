/**
 * THEIAKSHI ENTERPRISE HRMS — PHASE 8 INTEGRATION TEST SUITE
 * Tests Health & Authentication Endpoints against real PostgreSQL database.
 */

const http = require('http');
const path = require('path');
const { Pool } = require('pg');

try {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
} catch (e) {}

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(method, pathUrl, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runPhase8Tests() {
  console.log('===================================================================');
  console.log('  THEIAKSHI ENTERPRISE HRMS — PHASE 8 AUTH & HEALTH TEST SUITE');
  console.log('===================================================================');

  try {
    // 1. Health Endpoint Test
    console.log('👉 Testing GET /api/health ...');
    const health = await makeRequest('GET', '/api/health');
    console.log(`   Status: ${health.status} | DB: ${health.body?.database}`);
    if (health.status !== 200 || health.body?.database !== 'connected') {
      throw new Error('Health check failed!');
    }
    console.log('   ✅ GET /api/health PASSED');

    // 2. Demo Account Logins
    const accounts = [
      { email: 'superadmin@theiakshi.com', role: 'SUPER_ADMIN', expectEmployee: null },
      { email: 'admin@theiakshi.com', role: 'ADMIN', expectEmployee: null },
      { email: 'hr@theiakshi.com', role: 'HR_MANAGER', expectEmployee: 'EMP-001' },
      { email: 'manager@theiakshi.com', role: 'MANAGER', expectEmployee: 'EMP-002' },
      { email: 'employee@theiakshi.com', role: 'EMPLOYEE', expectEmployee: 'EMP-003' }
    ];

    for (const acc of accounts) {
      console.log(`👉 Testing POST /api/auth/login for ${acc.email} (${acc.role})...`);
      const loginRes = await makeRequest('POST', '/api/auth/login', {
        email: acc.email,
        password: 'ChangeMe@123'
      });

      if (loginRes.status !== 200 || !loginRes.body?.success) {
        throw new Error(`Login failed for ${acc.email}: ${JSON.stringify(loginRes.body)}`);
      }

      const { token, user } = loginRes.body.data;
      console.log(`   Role Resolved: ${user.role} | Employee ID: ${user.employeeId}`);

      if (user.role !== acc.role) {
        throw new Error(`Role mismatch for ${acc.email}. Expected ${acc.role}, got ${user.role}`);
      }

      if (acc.expectEmployee === null && user.employeeId !== null) {
        throw new Error(`Expected null employeeId for ${acc.email}, got ${user.employeeId}`);
      }

      // Test GET /api/auth/me
      console.log(`   👉 Testing GET /api/auth/me for ${acc.email}...`);
      const meRes = await makeRequest('GET', '/api/auth/me', null, token);
      if (meRes.status !== 200 || meRes.body?.data?.user?.email !== acc.email) {
        throw new Error(`GET /api/auth/me failed for ${acc.email}`);
      }
      console.log(`   ✅ Login & Auth/Me PASSED for ${acc.email}`);
    }

    console.log('-------------------------------------------------------------------');
    console.log('🎉 PHASE 8 AUTHENTICATION & HEALTH TEST SUITE PASSED PERFECTLY!');
  } catch (error) {
    console.error('❌ PHASE 8 TEST FAILED:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runPhase8Tests();
}

module.exports = { runPhase8Tests };
