const http = require('http');

const BASE_URL = 'http://127.0.0.1:5000/api/v1';
const EMAIL = 'superadmin@theiakshi.com';
const PASSWORD = 'password123'; 

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        // Collect cookies
        const cookies = res.headers['set-cookie'] || [];
        try { resolve({ status: res.statusCode, body: JSON.parse(buf), cookies }); }
        catch (e) { resolve({ status: res.statusCode, body: buf, cookies }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path, cookies) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = http.request(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        'Cookie': cookies.join('; '),
        'Accept-Encoding': 'gzip, deflate, br' // Tell server we accept compression
      }
    }, (res) => {
      let size = 0;
      let buf = [];
      res.on('data', chunk => {
        size += chunk.length;
        buf.push(chunk);
      });
      res.on('end', () => {
        const end = performance.now();
        const latency = end - start;
        const encoding = res.headers['content-encoding'] || 'none';
        resolve({ status: res.statusCode, latency, sizeBytes: size, encoding });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log(`Logging in as ${EMAIL}...`);
  const loginRes = await postJson('/auth/login', { email: EMAIL, password: PASSWORD });
  if (loginRes.status !== 200) {
    console.error('Login failed!', loginRes.status, loginRes.body);
    return;
  }
  
  const cookies = loginRes.cookies;
  console.log('Login successful. Running benchmarks...\n');
  
  const endpoints = [
    '/dashboard?period=This%20Week',
    '/employees',
    '/leave',
    '/expenses',
    '/attendance/today',
    '/assets'
  ];
  
  for (const ep of endpoints) {
    // Warmup
    try { await getJson(ep, cookies); } catch (e) {}
    
    // Measure
    let totalLatency = 0;
    let totalSize = 0;
    let encoding = 'none';
    const iterations = 5;
    
    for (let i = 0; i < iterations; i++) {
      try {
        const res = await getJson(ep, cookies);
        totalLatency += res.latency;
        totalSize = res.sizeBytes;
        encoding = res.encoding;
      } catch (e) {
        console.error(e);
      }
    }
    
    const avgLatency = totalLatency / iterations;
    console.log(`Endpoint: ${ep}`);
    console.log(`  Avg Latency: ${avgLatency.toFixed(2)} ms`);
    console.log(`  Payload Size: ${(totalSize / 1024).toFixed(2)} KB`);
    console.log(`  Compression: ${encoding}\n`);
  }
}

run().catch(console.error);
