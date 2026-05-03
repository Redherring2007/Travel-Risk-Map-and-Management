const base = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const body = await response.text();
  let json;
  try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${body}`);
  return json;
}

const tripPayload = {
  name: 'Verification Nairobi trip',
  traveller: { nationality: 'British', gender: 'Not specified', travelStyle: 'executive', highProfile: true, medicalConsiderations: 'None declared', riskTolerance: 'medium', purpose: 'Business', childrenTravelling: false, hostileEnvironmentSupport: false },
  locations: [{ countryIso2: 'KE', country: 'Kenya', city: 'Nairobi', arrivalDate: '2026-06-10', departureDate: '2026-06-14' }],
  accommodation: 'Secure business hotel',
  flightDetails: 'NBO arrival',
  internalMovements: 'Airport, hotel, office route',
  meetingsEvents: 'Client meetings'
};

const paidHeaders = { 'content-type': 'application/json', 'x-demo-paid': 'true' };
const adminHeaders = { 'content-type': 'application/json', 'x-demo-role': 'admin' };

const checks = [];
checks.push(['countries include public baseline or fallback', async () => {
  const data = await request('/api/countries');
  if (!Array.isArray(data.data) || data.data.length < 5) throw new Error('expected country data');
}]);
checks.push(['country search', () => request('/api/countries/search?q=Kenya')]);
checks.push(['city search', () => request('/api/cities/search?q=Nairobi')]);
checks.push(['country detail', () => request('/api/countries/KE')]);
checks.push(['city detail', () => request('/api/cities/nairobi-ke')]);
checks.push(['advisories', () => request('/api/advisories')]);
checks.push(['risk events', () => request('/api/events')]);
checks.push(['provider status includes env health', async () => {
  const status = await request('/api/admin/provider-status');
  if (!Array.isArray(status.providers)) throw new Error('expected provider list');
  if (!Array.isArray(status.environment)) throw new Error('expected environment list');
}]);
checks.push(['AI status fallback or configured', async () => {
  const status = await request('/api/ai/status');
  if (!('configured' in status)) throw new Error('expected AI configured flag');
}]);
checks.push(['protected ingestion blocks public users', async () => {
  const response = await fetch(`${base}/api/admin/ingest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ countryIso2: 'KE' }) });
  if (response.status !== 403) throw new Error(`expected 403, got ${response.status}`);
}]);
checks.push(['protected ingestion allows admin demo header', async () => {
  const data = await request('/api/admin/ingest', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ countryIso2: 'KE' }) });
  if (!Array.isArray(data.providers)) throw new Error('expected provider ingestion results');
}]);
checks.push(['protected country refresh allows admin demo header', async () => {
  const data = await request('/api/admin/countries/KE/refresh', { method: 'POST', headers: adminHeaders });
  if (data.requested.countryIso2 !== 'KE') throw new Error('expected country refresh');
}]);
checks.push(['protected city refresh allows admin demo header', async () => {
  const data = await request('/api/admin/cities/nairobi-ke/refresh', { method: 'POST', headers: adminHeaders });
  if (data.requested.cityId !== 'nairobi-ke') throw new Error('expected city refresh');
}]);
checks.push(['auth session', () => request('/api/auth/session', { headers: { 'x-demo-paid': 'true' } })]);
checks.push(['free paid block', async () => {
  const response = await fetch(`${base}/api/trips`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-demo-paid': 'false' }, body: JSON.stringify(tripPayload) });
  if (response.status !== 402) throw new Error(`expected 402, got ${response.status}`);
}]);
checks.push(['paid trip flow', async () => {
  const trip = await request('/api/trips', { method: 'POST', headers: paidHeaders, body: JSON.stringify(tripPayload) });
  const tripId = trip.data.id;
  await request(`/api/trips/${tripId}`, { method: 'PATCH', headers: paidHeaders, body: JSON.stringify({ accommodation: 'Updated hotel' }) });
  const upload = await request('/api/storage/upload-url', { method: 'POST', headers: paidHeaders, body: JSON.stringify({ tripId, fileName: 'passport.pdf', contentType: 'application/pdf' }) });
  const doc = await request(`/api/trips/${tripId}/documents`, { method: 'POST', headers: paidHeaders, body: JSON.stringify({ type: 'passport metadata', fileName: 'passport.pdf', mimeType: 'application/pdf', size: 1234, storageKey: upload.key }) });
  await request('/api/ai/extract-document', { method: 'POST', headers: paidHeaders, body: JSON.stringify({ fileName: 'passport.pdf' }) });
  await request(`/api/trips/${tripId}/documents/${doc.data.id}`, { headers: { 'x-demo-paid': 'true' } });
  await request('/api/storage/download-url', { method: 'POST', headers: paidHeaders, body: JSON.stringify({ key: doc.data.storageKey }) });
  const report = await request('/api/reports/generate', { method: 'POST', headers: paidHeaders, body: JSON.stringify({ tripId }) });
  await request(`/api/reports/${report.data.id}/download`);
}]);
checks.push(['billing checkout placeholder', () => request('/api/billing/checkout', { method: 'POST', headers: paidHeaders })]);
checks.push(['billing webhook placeholder', () => request('/api/billing/webhook', { method: 'POST', headers: paidHeaders, body: JSON.stringify({ userId: '00000000-0000-4000-8000-000000000002' }) })]);
checks.push(['admin approve alert', () => request('/api/admin/alerts/a3/approve', { method: 'POST', headers: adminHeaders })]);
checks.push(['admin override risk', () => request('/api/admin/risk-score', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ countryIso2: 'KE', category: 'security', value: 60 }) })]);

for (const [name, fn] of checks) {
  await fn();
  console.log(`ok - ${name}`);
}
console.log('Atlas Insight MVP verification complete.');
