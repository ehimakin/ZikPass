const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

// Trim SVG viewBoxes to their painted bounds so 80–100px means visible artwork,
// rather than the generous presentation canvas used for the contact sheet.
async function main() {
  const root = path.join(__dirname, '../public/affiliates/logos');
  const brands = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
  await fs.mkdir(path.join(root, 'desktop'), { recursive: true });
  for (const brand of brands) {
    const source = await fs.readFile(path.join(root, `${brand.slug}.svg`), 'utf8');
    const { data, info } = await sharp(Buffer.from(source)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width, top = info.height, right = 0, bottom = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 0) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    const width = right - left + 5, height = bottom - top + 5;
    const svg = source.replace('width="480" height="260" viewBox="0 0 480 260"',
      `width="${width}" height="${height}" viewBox="${left - 2} ${top - 2} ${width} ${height}"`);
    await fs.writeFile(path.join(root, 'desktop', `${brand.slug}.svg`), svg);
  }
  console.log(`Prepared ${brands.length} transparent desktop SVGs.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
