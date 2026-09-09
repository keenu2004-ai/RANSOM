import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { StreamingFileValidator } from '../utils/streamingFileValidator';

const config = { jwtSecret: 'test-secret' };

const app = express();
const PORT = 5002;

app.post('/api/files/upload-direct', (req, res, next) => {
  const token = req.query.token as string;
  let payload: any;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }

  const { objectPath, mimeType, maxSize } = payload;
  const validator = new StreamingFileValidator(mimeType, maxSize);
  
  req.pipe(validator);

  validator.on('error', (err: any) => {
    if (err.code === 'FILE_TOO_LARGE') return res.status(413).json({ error: err.message });
    if (err.code === 'INVALID_FILE_CONTENT') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  });

  // Consume the stream silently
  validator.on('data', () => {});
  
  validator.on('end', () => {
    res.status(200).json({ success: true, actualSize: validator.totalBytesProcessed });
  });
});

async function runTests() {
  const server = app.listen(PORT);

  const makeRequest = (token: string, payload: Buffer, contentType: string): Promise<any> => {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: `/api/files/upload-direct?token=${token}`,
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'Content-Length': payload.length
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      });

      req.write(payload);
      req.end();
    });
  };

  const createToken = (mimeType: string, maxSize: number) => {
    return jwt.sign({ typ: 'upload', objectPath: 'test/path', mimeType, maxSize }, config.jwtSecret);
  };

  console.log('--- STARTING SECURITY VERIFICATION ---');

  // 1. Valid PDF
  const validPdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(100, 'a')]);
  const res1 = await makeRequest(createToken('application/pdf', 1000), validPdf, 'application/pdf');
  console.log('Valid PDF:', res1.status === 200 ? 'PASS' : 'FAIL', res1);

  // 2. Spoofed PDF (starts with MZ - DOS executable)
  const spoofedPdf = Buffer.concat([Buffer.from('MZ\x90\x00'), Buffer.alloc(100, 'a')]);
  const res2 = await makeRequest(createToken('application/pdf', 1000), spoofedPdf, 'application/pdf');
  console.log('Spoofed PDF:', res2.status === 400 ? 'PASS' : 'FAIL', res2);

  // 3. Oversized File (25MB limit, send 26MB)
  const token3 = createToken('application/pdf', 25 * 1024 * 1024);
  const oversizedPdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(26 * 1024 * 1024, 'a')]);
  
  const startMem = process.memoryUsage().heapUsed;
  const res3 = await makeRequest(token3, oversizedPdf, 'application/pdf');
  const endMem = process.memoryUsage().heapUsed;
  console.log('Oversized PDF (26MB):', res3.status === 413 ? 'PASS' : 'FAIL', res3);
  console.log(`Memory Delta for 26MB streaming upload failure: ${(endMem - startMem) / (1024 * 1024)} MB`);

  server.close();
}

runTests().catch(console.error);
