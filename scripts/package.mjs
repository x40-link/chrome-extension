import fs from 'node:fs';
import path from 'node:path';

const dev = process.argv.includes('--dev');
const manifest = JSON.parse(fs.readFileSync('assets/manifest.base.json', 'utf8'));
if (dev) {
  if (!fs.existsSync('dist/dev-worker.js')) throw new Error('Compile TypeScript before packaging the development build.');
  manifest.optional_host_permissions.push('http://localhost/*', 'http://127.0.0.1/*');
  // Test-only install grant so headless Chromium can reach the local mock.
  manifest.host_permissions.push('http://localhost/*', 'http://127.0.0.1/*');
  manifest.background.service_worker='dev-worker.js';
} else {
  fs.rmSync('dist/dev-worker.js',{force:true});
}
fs.writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
for (const filename of ['popup.html', 'offscreen.html', 'theme.css']) {
  fs.copyFileSync(path.join('assets', filename), path.join('dist', filename));
}
fs.mkdirSync('dist/icons', {recursive:true});
for (const size of [16,32,48,128]) fs.copyFileSync(`assets/icons/icon${size}.png`, `dist/icons/icon${size}.png`);
fs.writeFileSync('dist/build.json', JSON.stringify({development:dev}, null, 2) + '\n');
