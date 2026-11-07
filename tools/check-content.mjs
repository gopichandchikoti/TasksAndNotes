import fs from 'node:fs';
import console from 'node:console';
import ts from 'typescript';

const path = 'public/tasksandnotes.model.json';
const text = fs.readFileSync(path, 'utf8');
const source = ts.parseJsonText(path, text);
if (source.parseDiagnostics.length) throw new Error('Invalid content JSON');
function checkDuplicates(node) {
  if (ts.isObjectLiteralExpression(node)) {
    const keys = node.properties.map((property) => property.name?.getText(source));
    if (new Set(keys).size !== keys.length) throw new Error('Duplicate content key');
  }
  ts.forEachChild(node, checkDuplicates);
}
checkDuplicates(source);
const model = JSON.parse(text);
if (model.schemaVersion !== 1 || model.defaultLocale !== 'en') throw new Error('Invalid content schema');
const defaults = model.locales.en;
const placeholders = (value) =>
  [...value.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1])
    .sort()
    .join(',');
for (const dictionary of Object.values(model.locales)) {
  if (Object.keys(dictionary).sort().join('|') !== Object.keys(defaults).sort().join('|')) {
    throw new Error('Locale key mismatch');
  }
  for (const [key, value] of Object.entries(dictionary)) {
    if (typeof value !== 'string' || !value.trim() || placeholders(value) !== placeholders(defaults[key])) {
      throw new Error(`Invalid message: ${key}`);
    }
  }
}
console.log(`Validated ${Object.keys(defaults).length} keys across ${Object.keys(model.locales).length} locales.`);
