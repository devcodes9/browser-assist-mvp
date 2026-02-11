/**
 * Copy manifest.json and move sidepanel.html to dist root
 */
import { copyFileSync, mkdirSync, existsSync, renameSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');

mkdirSync(distDir, { recursive: true });

// Copy manifest
copyFileSync(
  join(root, 'manifest.json'),
  join(distDir, 'manifest.json')
);

// Move sidepanel.html from public/ to dist root if it exists
const sidepanelSrc = join(distDir, 'public', 'sidepanel.html');
const sidepanelDest = join(distDir, 'sidepanel.html');

if (existsSync(sidepanelSrc)) {
  copyFileSync(sidepanelSrc, sidepanelDest);
}

// Remove the public directory as it's not needed
const publicDir = join(distDir, 'public');
if (existsSync(publicDir)) {
  rmSync(publicDir, { recursive: true, force: true });
}

// Remove icons directory (placeholders not needed)
const iconsDir = join(distDir, 'icons');
if (existsSync(iconsDir)) {
  rmSync(iconsDir, { recursive: true, force: true });
}

console.log('✓ Manifest copied to dist/');
console.log('✓ Build artifacts organized');
