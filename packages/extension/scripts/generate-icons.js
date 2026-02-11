/**
 * Generate placeholder icons for the extension
 * Creates simple colored squares as placeholders
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../dist/icons');

// Create icons directory
mkdirSync(iconsDir, { recursive: true });

// Generate SVG icon template
function generateSVG(size) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#2563eb" rx="${size * 0.2}"/>

  <!-- AI Symbol -->
  <circle cx="${size * 0.5}" cy="${size * 0.35}" r="${size * 0.12}" fill="white"/>
  <circle cx="${size * 0.3}" cy="${size * 0.6}" r="${size * 0.08}" fill="white"/>
  <circle cx="${size * 0.7}" cy="${size * 0.6}" r="${size * 0.08}" fill="white"/>
  <circle cx="${size * 0.5}" cy="${size * 0.75}" r="${size * 0.06}" fill="white"/>

  <!-- Connecting lines -->
  <line x1="${size * 0.5}" y1="${size * 0.35}" x2="${size * 0.3}" y2="${size * 0.6}" stroke="white" stroke-width="${size * 0.03}"/>
  <line x1="${size * 0.5}" y1="${size * 0.35}" x2="${size * 0.7}" y2="${size * 0.6}" stroke="white" stroke-width="${size * 0.03}"/>
  <line x1="${size * 0.3}" y1="${size * 0.6}" x2="${size * 0.5}" y2="${size * 0.75}" stroke="white" stroke-width="${size * 0.03}"/>
  <line x1="${size * 0.7}" y1="${size * 0.6}" x2="${size * 0.5}" y2="${size * 0.75}" stroke="white" stroke-width="${size * 0.03}"/>
</svg>`;
}

// For MVP, we'll create SVG files
// In production, you'd convert these to PNG using a library like sharp or puppeteer

const sizes = [16, 48, 128];

for (const size of sizes) {
  const svg = generateSVG(size);
  const filename = `icon-${size}.svg`;
  writeFileSync(join(iconsDir, filename), svg);
  console.log(`✓ Generated ${filename}`);
}

console.log('\n⚠️  Note: Chrome prefers PNG icons.');
console.log('For production, convert these SVG files to PNG using:');
console.log('- Online tool: https://convertio.co/svg-png/');
console.log('- CLI tool: imagemagick (convert icon.svg icon.png)');
console.log('- Node.js: sharp library\n');
