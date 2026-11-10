import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const manifest = JSON.parse(readFileSync(path.join(dist, 'manifest.webmanifest'), 'utf8'));
const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
const worker = readFileSync(path.join(dist, 'sw.js'), 'utf8');

assert.equal(manifest.display, 'standalone', 'The app must support standalone installation.');
assert.equal(manifest.scope, './', 'The manifest scope must remain relative for subfolder hosting.');
assert.equal(manifest.theme_color, '#ff6a00', 'The PWA color must match the GrowMoney theme.');
assert(manifest.icons.some((icon) => icon.sizes === '192x192'), 'A 192px Android icon is required.');
assert(manifest.icons.some((icon) => icon.sizes === '512x512'), 'A 512px Android icon is required.');
for (const icon of manifest.icons) {
  assert(existsSync(path.join(dist, icon.src.replace(/^\.\//, ''))), `Missing PWA icon: ${icon.src}`);
}
assert(html.includes('/grow/sw.js') || html.includes('/sw.js'), 'The service worker must be registered under the app base path.');
assert(worker.includes('self.registration.scope'), 'The service worker must derive its cache scope from its registration path.');

console.log(`PWA manifest, ${manifest.icons.length} icons and service-worker scope verified.`);
