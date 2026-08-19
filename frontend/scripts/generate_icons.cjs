const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate high quality SVG branding icons
const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="40" fill="#0f172a"/>
  <circle cx="96" cy="96" r="70" fill="url(#grad)" />
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <path d="M 60,65 L 132,65 M 96,65 L 96,135 M 65,100 L 127,100" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
</svg>`;

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#0f172a"/>
  <circle cx="256" cy="256" r="180" fill="url(#grad512)" />
  <defs>
    <linearGradient id="grad512" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <path d="M 160,170 L 352,170 M 256,170 L 256,350 M 175,260 L 337,260" stroke="#ffffff" stroke-width="36" stroke-linecap="round"/>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon-192x192.svg'), svg192);
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.svg'), svg512);

// Create valid PNG files using standard PNG binary header & raw uncompressed DEFLATE chunks
function createSimplePNG(width, height) {
  const zlib = require('zlib');
  const buffer = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < width * 0.38) {
        buffer[idx] = 6;       // R
        buffer[idx + 1] = 182; // G
        buffer[idx + 2] = 212; // B
        buffer[idx + 3] = 255; // A
      } else {
        buffer[idx] = 15;      // R
        buffer[idx + 1] = 23;  // G
        buffer[idx + 2] = 42;  // B
        buffer[idx + 3] = 255; // A
      }
    }
  }

  const rawData = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0;
    buffer.copy(rawData, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawData);

  function writeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'binary');
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      let byte = buf[i];
      for (let j = 0; j < 8; j++) {
        const bit = (byte ^ crc) & 1;
        crc = (crc >>> 1) ^ (bit ? 0xedb88320 : 0);
        byte >>>= 1;
      }
    }
    return (crc ^ -1) >>> 0;
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = writeChunk('IHDR', ihdr);
  const idatChunk = writeChunk('IDAT', compressed);
  const iendChunk = writeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), createSimplePNG(192, 192));
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), createSimplePNG(512, 512));
fs.writeFileSync(path.join(iconsDir, 'maskable-512x512.png'), createSimplePNG(512, 512));

console.log('✅ PWA icons successfully generated in frontend/public/icons');
