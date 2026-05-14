#!/usr/bin/env node

import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PUBLIC_PROVIDER_DEFAULTS } from './provider-defaults.mjs';

const envPath = resolve(process.cwd(), '.env.local');

function parseEnvKeys(text) {
  const keys = new Set();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

function ensureEnvFile() {
  if (!existsSync(envPath)) {
    writeFileSync(envPath, '# Atlas Insight local environment\n', { encoding: 'utf8', mode: 0o600 });
    console.log('Created .env.local');
  }
}

ensureEnvFile();

const existing = readFileSync(envPath, 'utf8');
const existingKeys = parseEnvKeys(existing);
const additions = PUBLIC_PROVIDER_DEFAULTS.filter((item) => !existingKeys.has(item.key));

if (additions.length === 0) {
  console.log('No public provider defaults added. All known free/no-key provider keys already exist in .env.local.');
} else {
  const block = [
    '',
    '# Atlas Insight free/public provider defaults',
    '# Added by npm run providers:defaults. These require no private API keys.'
  ];

  for (const item of additions) {
    block.push(`# ${item.class}: ${item.note}`);
    block.push(`${item.key}=${item.value}`);
  }

  appendFileSync(envPath, `${block.join('\n')}\n`, 'utf8');
  console.log(`Added ${additions.length} free/public provider default${additions.length === 1 ? '' : 's'} to .env.local:`);
  for (const item of additions) console.log(`- ${item.key}`);
}

const presentButEmpty = PUBLIC_PROVIDER_DEFAULTS
  .filter((item) => existingKeys.has(item.key))
  .filter((item) => new RegExp(`^${item.key}=\\s*$`, 'm').test(existing));

if (presentButEmpty.length) {
  console.log('\nThese keys already exist but are empty, so they were not overwritten:');
  for (const item of presentButEmpty) console.log(`- ${item.key}`);
  console.log('To use the safe default, fill the value manually or remove the empty line and rerun this command.');
}

console.log('\nNext: run npm run providers:check');
