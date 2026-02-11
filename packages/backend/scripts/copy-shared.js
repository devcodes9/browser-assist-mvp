/**
 * Copy shared types to dist folder after build
 */
import { copyFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const sharedSrc = join(root, '../../shared/types.ts');
const sharedDest = join(root, 'dist/shared');

mkdirSync(sharedDest, { recursive: true });

// Copy as .js since we're emitting JS
copyFileSync(sharedSrc, join(sharedDest, 'types.js'));

console.log('✓ Shared types copied to dist/');
