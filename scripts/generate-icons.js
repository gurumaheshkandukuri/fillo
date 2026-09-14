import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates a valid PNG Buffer in memory without external dependencies.
 * Conforms to ISO/IEC 15948:2004 (PNG specification).
 */
function createPng(width, height, getPixel) {
  // 1. Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // 2. IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8 bits per channel
  ihdrData.writeUInt8(6, 9); // RGBA color type
  ihdrData.writeUInt8(0, 10); // Deflate compression
  ihdrData.writeUInt8(0, 11); // Filter: standard
  ihdrData.writeUInt8(0, 12); // No interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // 3. IDAT (Scanlines)
  const rowStride = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowStride);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowStride;
    rawData[rowOffset] = 0; // Filter byte: 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = getPixel(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // 4. IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcPayload = Buffer.concat([typeBuf, data]);
  const crc = zlib.crc32(crcPayload);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([lenBuf, crcPayload, crcBuf]);
}

/**
 * Pixel renderer for FILLO icon:
 * Sleek indigo rounded container with a crisp white 'F'.
 */
function filloIconShader(x, y, w, h) {
  // Normalized coordinates: -1 to 1
  const nx = (x / (w - 1)) * 2 - 1;
  const ny = (y / (h - 1)) * 2 - 1;

  // Rounded rectangle check
  const cornerRadius = 0.35;
  const qx = Math.max(0, Math.abs(nx) - (1 - cornerRadius));
  const qy = Math.max(0, Math.abs(ny) - (1 - cornerRadius));
  const distOutside = Math.sqrt(qx * qx + qy * qy);

  if (distOutside > cornerRadius) {
    return [0, 0, 0, 0]; // Transparent
  }

  // Base background color: Indigo (#4F46E5 -> R:79, G:70, B:229) with slight vertical gradient
  const grad = (ny + 1) * 0.15;
  const bgR = Math.min(255, Math.max(0, Math.round(79 - grad * 30)));
  const bgG = Math.min(255, Math.max(0, Math.round(70 - grad * 20)));
  const bgB = Math.min(255, Math.max(0, Math.round(229 - grad * 15)));

  // Render stylized 'F' symbol
  // Vertical stem: x in [-0.45, -0.15], y in [-0.55, 0.55]
  // Top bar: x in [-0.45, 0.45], y in [-0.55, -0.28]
  // Middle bar: x in [-0.45, 0.25], y in [-0.10, 0.15]
  const inStem = nx >= -0.45 && nx <= -0.15 && ny >= -0.55 && ny <= 0.55;
  const inTopBar = nx >= -0.45 && nx <= 0.45 && ny >= -0.55 && ny <= -0.28;
  const inMidBar = nx >= -0.45 && nx <= 0.25 && ny >= -0.10 && ny <= 0.15;

  if (inStem || inTopBar || inMidBar) {
    return [255, 255, 255, 255]; // Crisp white
  }

  return [bgR, bgG, bgB, 255];
}

const iconsDir = path.resolve(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [16, 48, 128];

for (const size of sizes) {
  const pngBuffer = createPng(size, size, filloIconShader);
  const targetPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(targetPath, pngBuffer);
  console.log(`Generated valid PNG: icon${size}.png (${pngBuffer.length} bytes)`);
}
