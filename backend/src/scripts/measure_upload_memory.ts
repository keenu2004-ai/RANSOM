import http from 'http';
import express from 'express';

const app = express();
const PORT = 5001; // Use a different port for test server

app.post('/api/files/upload-direct', (req, res, next) => {
  const startMem = process.memoryUsage().heapUsed;
  const chunks: Buffer[] = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const endMem = process.memoryUsage().heapUsed;
      res.status(200).json({
        success: true,
        bufferSize: buffer.length,
        memDeltaMB: (endMem - startMem) / (1024 * 1024)
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
});

const server = app.listen(PORT, async () => {
  console.log(`Test server running on port ${PORT}`);
  
  // Create a fake 25MB payload
  const payloadSize = 25 * 1024 * 1024;
  const payload = Buffer.alloc(payloadSize, 'a');

  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/api/files/upload-direct?objectPath=test/path',
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': payload.length
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const parsed = JSON.parse(data);
      console.log('Upload Result:', parsed);
      console.log('Test completed.');
      server.close();
      process.exit(0);
    });
  });

  req.write(payload);
  req.end();
});
