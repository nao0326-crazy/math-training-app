/**
 * Generate PWA icons using pure Node.js (no external dependencies)
 * Creates PNG files for the web app manifest
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// PNG color types
const COLOR_TYPE_RGB = 2;
const COLOR_TYPE_RGBA = 6;

// PNG chunk types
const IHDR = 0x49484452;
const IDAT = 0x49444154;
const IEND = 0x49454e44;

function pngChunk(type, data) {
  // PNG chunk format: [4 bytes: length][4 bytes: type][data][4 bytes: CRC]
  // CRC is calculated over type + data (not including length)
  const buf = Buffer.alloc(8 + data.length + 4);
  buf.writeUInt32BE(data.length, 0); // length
  buf.writeUInt32BE(type, 4); // type
  data.copy(buf, 8); // data
  const crc = zlib.crc32(buf.slice(4, 8 + data.length));
  buf.writeUInt32BE(crc >>> 0, 8 + data.length); // CRC
  return buf;
}

function createPNG(width, height, pixels) {
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = COLOR_TYPE_RGBA; // color type
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  // Image data with filter bytes
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0; // filter type 0 (none)
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (width * 4 + 1) + 1 + x * 4;
      rawData[dstIdx] = pixels[srcIdx];
      rawData[dstIdx + 1] = pixels[srcIdx + 1];
      rawData[dstIdx + 2] = pixels[srcIdx + 2];
      rawData[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }

  const compressed = zlib.deflateSync(rawData);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk(IHDR, ihdrData),
    pngChunk(IDAT, compressed),
    pngChunk(IEND, Buffer.alloc(0)),
  ]);
}

function createIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const primary = [0x4a, 0x90, 0xd9]; // #4a90d9
  const primaryDark = [0x35, 0x7a, 0xbd]; // #357abd
  const white = [0xff, 0xff, 0xff];
  const light = [0xe8, 0xf1, 0xfb];
  const green = [0x4c, 0xaf, 0x50]; // #4caf50

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const px = x / size;
      const py = y / size;

      // Background
      pixels[idx] = primary[0];
      pixels[idx + 1] = primary[1];
      pixels[idx + 2] = primary[2];
      pixels[idx + 3] = 255;

      // Draw a book/calculator shape (representing math learning)
      // Outer rectangle (white card)
      const cardLeft = 0.25;
      const cardRight = 0.75;
      const cardTop = 0.20;
      const cardBottom = 0.80;

      if (px >= cardLeft && px <= cardRight && py >= cardTop && py <= cardBottom) {
        pixels[idx] = white[0];
        pixels[idx + 1] = white[1];
        pixels[idx + 2] = white[2];
      }

      // Inner light area
      const innerLeft = 0.30;
      const innerRight = 0.70;
      const innerTop = 0.25;
      const innerBottom = 0.75;

      if (px >= innerLeft && px <= innerRight && py >= innerTop && py <= innerBottom) {
        pixels[idx] = light[0];
        pixels[idx + 1] = light[1];
        pixels[idx + 2] = light[2];
      }

      // Calculator buttons (grid of small squares)
      const buttonSize = 0.06;
      const buttonGap = 0.02;
      const gridStartX = 0.40;
      const gridStartY = 0.40;

      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const bx = gridStartX + col * (buttonSize + buttonGap);
          const by = gridStartY + row * (buttonSize + buttonGap);
          if (px >= bx && px <= bx + buttonSize && py >= by && py <= by + buttonSize) {
            pixels[idx] = primary[0];
            pixels[idx + 1] = primary[1];
            pixels[idx + 2] = primary[2];
          }
        }
      }

      // Green checkmark area (bottom center)
      const checkLeft = 0.38;
      const checkRight = 0.62;
      const checkTop = 0.68;
      const checkBottom = 0.78;

      if (px >= checkLeft && px <= checkRight && py >= checkTop && py <= checkBottom) {
        pixels[idx] = green[0];
        pixels[idx + 1] = green[1];
        pixels[idx + 2] = green[2];
      }
    }
  }

  return createPNG(size, size, pixels);
}

function createMaskableIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const primary = [0x4a, 0x90, 0xd9]; // #4a90d9
  const white = [0xff, 0xff, 0xff];
  const light = [0xe8, 0xf1, 0xfb];
  const green = [0x4c, 0xaf, 0x50]; // #4caf50

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const px = x / size;
      const py = y / size;

      // Background
      pixels[idx] = primary[0];
      pixels[idx + 1] = primary[1];
      pixels[idx + 2] = primary[2];
      pixels[idx + 3] = 255;

      // Draw a book/calculator shape (representing math learning)
      // Outer rectangle (white card)
      const cardLeft = 0.20;
      const cardRight = 0.80;
      const cardTop = 0.15;
      const cardBottom = 0.85;

      if (px >= cardLeft && px <= cardRight && py >= cardTop && py <= cardBottom) {
        pixels[idx] = white[0];
        pixels[idx + 1] = white[1];
        pixels[idx + 2] = white[2];
      }

      // Inner light area
      const innerLeft = 0.25;
      const innerRight = 0.75;
      const innerTop = 0.20;
      const innerBottom = 0.80;

      if (px >= innerLeft && px <= innerRight && py >= innerTop && py <= innerBottom) {
        pixels[idx] = light[0];
        pixels[idx + 1] = light[1];
        pixels[idx + 2] = light[2];
      }

      // Calculator buttons (grid of small squares)
      const buttonSize = 0.08;
      const buttonGap = 0.03;
      const gridStartX = 0.35;
      const gridStartY = 0.35;

      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const bx = gridStartX + col * (buttonSize + buttonGap);
          const by = gridStartY + row * (buttonSize + buttonGap);
          if (px >= bx && px <= bx + buttonSize && py >= by && py <= by + buttonSize) {
            pixels[idx] = primary[0];
            pixels[idx + 1] = primary[1];
            pixels[idx + 2] = primary[2];
          }
        }
      }

      // Green checkmark area (bottom center)
      const checkLeft = 0.35;
      const checkRight = 0.65;
      const checkTop = 0.70;
      const checkBottom = 0.82;

      if (px >= checkLeft && px <= checkRight && py >= checkTop && py <= checkBottom) {
        pixels[idx] = green[0];
        pixels[idx + 1] = green[1];
        pixels[idx + 2] = green[2];
      }
    }
  }

  return createPNG(size, size, pixels);
}

// Create icons directory
const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate icons
const icon192 = createIcon(192);
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), icon192);
console.log('Created icon-192.png');

const icon512 = createIcon(512);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), icon512);
console.log('Created icon-512.png');

const iconMaskable = createMaskableIcon(512);
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), iconMaskable);
console.log('Created icon-maskable-512.png');

console.log('All icons created successfully!');
