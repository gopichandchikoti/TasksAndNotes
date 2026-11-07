import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import console from 'node:console';

const scripts = fs.readdirSync('dist/assets').filter((name) => name.endsWith('.js'));
for (const name of scripts) {
  const bytes = fs.readFileSync(`dist/assets/${name}`);
  if (bytes.length > 500000) throw new Error(`JavaScript chunk exceeds 500 KB: ${name}`);
  if (name.startsWith('index-') && gzipSync(bytes).length > 200000) throw new Error('Initial JS exceeds 200 KB gzip');
}
console.log('Build budgets passed: each JS chunk <=500 KB; initial JS <=200 KB gzip.');
