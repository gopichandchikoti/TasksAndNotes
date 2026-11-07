import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? files(filename) : [filename];
  });
}
const checksums = files('dist')
  .filter((filename) => path.basename(filename) !== 'SHA256SUMS')
  .sort()
  .map((filename) => {
    const hash = createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
    return `${hash}  ${path.relative('dist', filename).replaceAll('\\', '/')}`;
  });
fs.writeFileSync('dist/SHA256SUMS', `${checksums.join('\n')}\n`);
