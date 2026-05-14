#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MANUAL_PROVIDER_GUIDANCE, PUBLIC_PROVIDER_DEFAULTS } from './provider-defaults.mjs';

const envPath = resolve(process.cwd(), '.env.local');
const TIMEOUT_MS = 8000;

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    values[key] = rawValue.replace(/^['"]|['"]$/g, '').trim();
  }
  return values;
}

function isUsefulValue(value) {
  if (!value) return false;
  const normalised = String(value).trim().toLowerCase();
  return !['replace-me', 'replace_me', 'changeme', 'your-key-here', 'your_key_here', 'todo'].includes(normalised);
}

function providerUrls(item, value) {
  if (item.key === 'NEWS_RSS_FEEDS') {
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  return value ? [value] : [];
}

async function fetchWithTimeout(url, method) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        'User-Agent': 'AtlasInsightProviderCheck/1.0 (configuration validation; no bulk collection)',
        Accept: 'application/json, application/xml, text/xml, text/plain, */*'
      }
    });
    return {
      ok: response.ok || response.status === 429,
      status: response.status,
      note: response.status === 429 ? 'reachable but rate-limited' : response.ok ? 'reachable' : response.statusText || 'not reachable'
    };
  } catch (error) {
    return { ok: false, status: 0, note: error instanceof Error ? error.message : 'request failed' };
  } finally {
    clearTimeout(timeout);
  }
}

async function testUrl(url) {
  if (!/^https?:\/\//i.test(url)) {
    return { url, ok: false, status: 0, note: 'not an HTTP URL' };
  }
  const head = await fetchWithTimeout(url, 'HEAD');
  if (head.ok || (![405, 403, 404].includes(head.status) && head.status !== 0)) return { url, ...head };
  const get = await fetchWithTimeout(url, 'GET');
  return { url, ...get };
}

const localEnv = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
const env = { ...process.env, ...localEnv };

console.log('Atlas Insight provider configuration check\n');
if (!existsSync(envPath)) {
  console.log('Warning: .env.local was not found. Run npm run providers:defaults to create public defaults.');
}

const configured = [];
const missing = [];

for (const item of PUBLIC_PROVIDER_DEFAULTS) {
  const value = env[item.key];
  if (isUsefulValue(value)) configured.push({ ...item, value });
  else missing.push(item);
}

console.log('Free/public provider defaults:');
for (const item of PUBLIC_PROVIDER_DEFAULTS) {
  const value = env[item.key];
  console.log(`- ${item.key}: ${isUsefulValue(value) ? 'configured' : 'missing'} (${item.class})`);
}

console.log('\nReachability checks:');
for (const item of configured) {
  for (const url of providerUrls(item, item.value)) {
    const result = await testUrl(url);
    console.log(`- ${item.key}: ${result.ok ? 'OK' : 'CHECK'} ${result.status || ''} ${result.note} :: ${url}`);
  }
}

if (missing.length) {
  console.log('\nRecommended public defaults to add:');
  for (const item of missing) console.log(`- ${item.key}: run npm run providers:defaults (${item.note})`);
}

console.log('\nManual / key-based setup still required where needed:');
for (const item of MANUAL_PROVIDER_GUIDANCE) {
  const status = isUsefulValue(env[item.key]) ? 'configured' : 'not configured';
  console.log(`- ${item.key}: ${status}. ${item.reason}`);
}

console.log('\nNext actions:');
if (missing.length) console.log('1. Run npm run providers:defaults to append safe no-key defaults.');
console.log(`${missing.length ? '2' : '1'}. Add manual keys/endpoints only after validating terms and provider format.`);
console.log(`${missing.length ? '3' : '2'}. Run npm run providers:check again.`);
console.log(`${missing.length ? '4' : '3'}. Run ingestion/bootstrap once DATABASE_URL and admin secret are configured.`);
