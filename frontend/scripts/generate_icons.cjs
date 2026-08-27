const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Canonical Right-Facing THEIAKSHI Emblem SVG
const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="40" fill="#020817"/>
  <defs>
    <linearGradient id="ringGrad192" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3A3E45" />
      <stop offset="50%" stop-color="#181B20" />
      <stop offset="100%" stop-color="#080A0C" />
    </linearGradient>
    <linearGradient id="redFill192" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF383F" />
      <stop offset="50%" stop-color="#EF1B23" />
      <stop offset="100%" stop-color="#C51118" />
    </linearGradient>
  </defs>

  <ellipse cx="96" cy="96" rx="84" ry="70" fill="url(#ringGrad192)" stroke="#2D323C" stroke-width="4" />
  <ellipse cx="96" cy="96" rx="78" ry="64" fill="none" stroke="#EF1B23" stroke-width="3" opacity="0.95" />
  <ellipse cx="96" cy="96" rx="68" ry="54" fill="#020817" />

  <!-- Correct Right-Facing 't' Mark -->
  <path d="M 30,80 C 65,74 125,74 170,84 C 170,96 125,94 30,96 Z" fill="url(#redFill192)" />
  <path d="M 46,38 L 63,38 L 63,110 C 63,138 86,150 118,130 C 122,120 108,115 92,115 C 71,115 63,103 63,88 L 63,38 Z" fill="url(#redFill192)" />
</svg>`;

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#020817"/>
  <defs>
    <linearGradient id="ringGrad512" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3A3E45" />
      <stop offset="50%" stop-color="#181B20" />
      <stop offset="100%" stop-color="#080A0C" />
    </linearGradient>
    <linearGradient id="redFill512" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF383F" />
      <stop offset="50%" stop-color="#EF1B23" />
      <stop offset="100%" stop-color="#C51118" />
    </linearGradient>
  </defs>

  <ellipse cx="256" cy="256" rx="224" ry="186" fill="url(#ringGrad512)" stroke="#2D323C" stroke-width="10" />
  <ellipse cx="256" cy="256" rx="208" ry="170" fill="none" stroke="#EF1B23" stroke-width="8" opacity="0.95" />
  <ellipse cx="256" cy="256" rx="180" ry="144" fill="#020817" />

  <!-- Correct Right-Facing 't' Mark -->
  <path d="M 80,214 C 175,198 335,198 454,224 C 454,256 335,250 80,256 Z" fill="url(#redFill512)" />
  <path d="M 122,102 L 168,102 L 168,294 C 168,368 230,400 315,347 C 325,320 288,307 245,307 C 190,307 168,275 168,235 L 168,102 Z" fill="url(#redFill512)" />
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon-192x192.svg'), svg192);
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.svg'), svg512);

// Create valid PNG files matching emblem colors
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
        buffer[idx] = 239;     // R (#EF)
        buffer[idx + 1] = 27;  // G (#1B)
        buffer[idx + 2] = 35;  // B (#23)
        buffer[idx + 3] = 255; // A
      } else {
        buffer[idx] = 2;       // R (#02)
        buffer[idx + 1] = 8;   // G (#08)
        buffer[idx + 2] = 23;  // B (#17)
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

console.log('✅ Canonical Right-Facing PWA icons successfully generated in frontend/public/icons');
