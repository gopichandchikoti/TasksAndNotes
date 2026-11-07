import fs from 'node:fs';
import path from 'node:path';
import console from 'node:console';

const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const inventory = [];
fs.mkdirSync('dist/licenses', { recursive: true });
for (const [location, entry] of Object.entries(lock.packages)) {
  if (!location || entry.dev || !fs.existsSync(location)) continue;
  const manifest = JSON.parse(fs.readFileSync(path.join(location, 'package.json'), 'utf8'));
  const name = `${manifest.name.replaceAll('/', '_')}-${manifest.version}`;
  const licenseFiles = fs.readdirSync(location).filter((filename) => /^(license|licence|notice)(\.|$)/i.test(filename));
  for (const filename of licenseFiles) {
    fs.copyFileSync(path.join(location, filename), path.join('dist/licenses', `${name}-${filename}`));
  }
  inventory.push({
    name: manifest.name,
    version: manifest.version,
    license: manifest.license ?? 'UNKNOWN',
    repository: manifest.repository,
    notices: licenseFiles,
  });
}
fs.writeFileSync('dist/dependency-licenses.json', `${JSON.stringify(inventory, null, 2)}\n`);
console.log(
  `Inventoried ${inventory.length} runtime packages; missing licenses: ${inventory.filter((p) => p.license === 'UNKNOWN').length}`,
);
