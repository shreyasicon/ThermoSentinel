/**
 * Zip `out/` for Amplify manual deploy.
 * - Windows `Compress-Archive` embeds backslashes — Linux extract omits `_next/static` (no CSS/JS).
 * - `tar -a` can prefix entries with `./` which some pipelines mishandle.
 * Use archiver: forward slashes, paths relative to zip root (index.html, _next/...).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'out');
const zipPath = path.join(root, 'amplify-manual.zip');

if (!fs.existsSync(outDir)) {
  console.error('Missing out/ — run: npm run build:amplify');
  process.exit(1);
}
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

await new Promise((resolve, reject) => {
  output.on('close', () => resolve());
  archive.on('error', reject);
  archive.pipe(output);
  // Second arg false: add contents of out/ at archive root (index.html, _next/, …)
  archive.directory(outDir, false);
  archive.finalize();
});

const { size } = fs.statSync(zipPath);
console.log('Wrote', zipPath, `(${(size / 1024).toFixed(0)} KB)`);
