import sharp from 'sharp';
import fs from 'fs';

const input = 'test-output/caps_original.jpg';
if (!fs.existsSync(input)) {
  console.log('Input file not found');
  process.exit(1);
}

const buffer = fs.readFileSync(input);
console.log('Original:', (buffer.length / 1024).toFixed(1), 'KB');

// 256px WebP
const webp256 = await sharp(buffer)
  .resize(256, 256, { fit: 'cover', position: 'center' })
  .webp({ quality: 80 })
  .toBuffer();
fs.writeFileSync('test-output/caps_256.webp', webp256);
console.log('WebP 256px:', (webp256.length / 1024).toFixed(1), 'KB',
  '(' + ((1 - webp256.length / buffer.length) * 100).toFixed(0) + '% smaller)');

// 128px WebP (thumbnail)
const webp128 = await sharp(buffer)
  .resize(128, 128, { fit: 'cover', position: 'center' })
  .webp({ quality: 70 })
  .toBuffer();
fs.writeFileSync('test-output/caps_128.webp', webp128);
console.log('WebP 128px:', (webp128.length / 1024).toFixed(1), 'KB');

// Original size WebP
const webpOrig = await sharp(buffer)
  .webp({ quality: 80 })
  .toBuffer();
fs.writeFileSync('test-output/caps_orig.webp', webpOrig);
console.log('WebP orig:', (webpOrig.length / 1024).toFixed(1), 'KB');
