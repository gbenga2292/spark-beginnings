/**
 * generate-ico.cjs
 * Generates a proper multi-resolution Windows .ico file from logo-1.png
 * ICO spec: https://en.wikipedia.org/wiki/ICO_(file_format)
 * Requires: sharp (already installed as @capacitor/assets dep)
 */
const path = require('path');
const fs   = require('fs');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));

const SRC  = path.join(__dirname, '..', 'logo', 'logo-1.png');
const DEST = path.join(__dirname, '..', 'logo', 'icon.ico');

// ICO sizes Windows / electron-builder expect
const SIZES = [16, 24, 32, 48, 64, 128, 256];

async function buildIco() {
  console.log('Reading source:', SRC);

  // Render each size as raw 32-bit RGBA PNG buffer
  const images = await Promise.all(
    SIZES.map(size =>
      sharp(SRC)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );

  // --- Build ICO binary ---
  // ICO header: 6 bytes
  // ICONDIRENTRY per image: 16 bytes
  // Image data follows all entries

  const numImages = images.length;
  const headerSize = 6 + numImages * 16;

  // Compute offsets
  let offset = headerSize;
  const offsets = images.map(buf => {
    const o = offset;
    offset += buf.length;
    return o;
  });

  const totalSize = offset;
  const ico = Buffer.alloc(totalSize);
  let pos = 0;

  // ICONDIR
  ico.writeUInt16LE(0, pos);       pos += 2; // Reserved (must be 0)
  ico.writeUInt16LE(1, pos);       pos += 2; // Type: 1 = ICO
  ico.writeUInt16LE(numImages, pos); pos += 2; // Image count

  // ICONDIRENTRY × n
  SIZES.forEach((size, i) => {
    const w = size === 256 ? 0 : size; // 0 means 256 in ICO spec
    const h = size === 256 ? 0 : size;
    ico.writeUInt8(w, pos);           pos += 1; // Width
    ico.writeUInt8(h, pos);           pos += 1; // Height
    ico.writeUInt8(0, pos);           pos += 1; // Colour count (0 = >8bpp)
    ico.writeUInt8(0, pos);           pos += 1; // Reserved
    ico.writeUInt16LE(1, pos);        pos += 2; // Planes
    ico.writeUInt16LE(32, pos);       pos += 2; // Bit count
    ico.writeUInt32LE(images[i].length, pos); pos += 4; // Bytes in image
    ico.writeUInt32LE(offsets[i], pos);       pos += 4; // Offset of image data
  });

  // Image data
  images.forEach(buf => {
    buf.copy(ico, pos);
    pos += buf.length;
  });

  fs.writeFileSync(DEST, ico);
  console.log(`✅  icon.ico written → ${DEST}`);
  console.log(`    Sizes: ${SIZES.join(', ')} px  |  File size: ${(ico.length / 1024).toFixed(1)} KB`);
}

buildIco().catch(err => { console.error('❌ Failed:', err); process.exit(1); });
