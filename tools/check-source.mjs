import fs from 'node:fs';
import console from 'node:console';
import path from 'node:path';

const roots = ['src', 'public', 'tools', '.github'];
const findings = [];
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      inspect(filename);
      continue;
    }
    if (!/\.(tsx?|css|mjs|json|ya?ml|svg)$/.test(filename)) continue;
    const text = fs.readFileSync(filename, 'utf8');
    if (text.startsWith('\ufeff')) findings.push(`${filename}: BOM`);
    if (/\.(tsx?|css)$/.test(filename) && text.split('\n').length >= 400) findings.push(`${filename}: >=400 lines`);
    const secretPatterns = [
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
      /\bAKIA[A-Z0-9]{16}\b/,
      /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
      /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/,
    ];
    if (secretPatterns.some((pattern) => pattern.test(text))) findings.push(`${filename}: possible secret`);
  }
}
roots.forEach(inspect);
if (findings.length) throw new Error(findings.join('\n'));
console.log('Source size, encoding and basic secret-pattern checks passed (not a complete secret scanner).');
