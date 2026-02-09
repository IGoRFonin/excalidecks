#!/usr/bin/env node
// Usage: node scripts/bump-version.cjs 1.2.0

const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('Usage: node scripts/bump-version.cjs <version>');
  console.error('Example: node scripts/bump-version.cjs 1.2.0');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const files = [
  'package.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
];

for (const file of files) {
  const filePath = path.join(root, file);
  const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Top-level version
  if ('version' in json) json.version = newVersion;
  // marketplace.json: metadata.version
  if (json.metadata?.version) json.metadata.version = newVersion;
  // marketplace.json: plugins[].version
  if (Array.isArray(json.plugins)) {
    for (const p of json.plugins) {
      if ('version' in p) p.version = newVersion;
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
  console.log(`${file}: -> ${newVersion}`);
}

console.log(`\nVersion bumped to ${newVersion}`);
