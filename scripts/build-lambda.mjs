import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'lambda');
const outfile = path.join(outDir, 'handler.js');

fs.mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, 'services', 'lambda-api', 'handler.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile,
  format: 'cjs',
  logLevel: 'info',
});

console.log(`Wrote ${outfile}`);
