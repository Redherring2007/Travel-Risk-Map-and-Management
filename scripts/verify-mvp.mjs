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
checks.push(['countries', () => request('/api/countries')]);
checks.push(['country search', () => request('/api/countries/search?q=Kenya')]);
checks.push(['city search', () => request('/api/cities/search?q=Nairobi')]);
checks.push(['country detail', () => request('/api/countries/KE')]);
checks.push(['city detail', () => request('/api/cities/nairobi-ke')]);
checks.push(['advisories', () => request('/api/advisories')]);
checks.push(['risk events', () => request('/api/events')]);
checks.push(['free paid block', async () => {
  const response = await fetch(`${base}/api/trips`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-demo-paid': 'false' }, body: JSON.stringify(tripPayload) });
  if (response.status !== 402) throw new Error(`expected 402, got ${response.status}`);
}]);
checks.push(['paid trip flow', async () => {
  const trip = await request('/api/trips', { method: 'POST', headers: paidHeaders, body: JSON.stringify(tripPayload) });
  const tripId = trip.data.id;
  await request(`/api/trips/${tripId}`, { method: 'PATCH', headers: paidHeaders, body: JSON.stringify({ accommodation: 'Updated hotel' }) });
  const doc = await request(`/api/trips/${tripId}/documents`, { method: 'POST', headers: paidHeaders, body: JSON.stringify({ type: 'Passport', fileName: 'passport.pdf', mimeType: 'application/pdf', size: 1234 }) });
  await request(`/api/trips/${tripId}/documents/${doc.data.id}`, { headers: { 'x-demo-paid': 'true' } });
  const report = await request('/api/reports/generate', { method: 'POST', headers: paidHeaders, body: JSON.stringify({ tripId }) });
  await request(`/api/reports/${report.data.id}/download`);
}]);
checks.push(['admin approve alert', () => request('/api/admin/alerts/a3/approve', { method: 'POST', headers: adminHeaders })]);
checks.push(['admin override risk', () => request('/api/admin/risk-score', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ countryIso2: 'KE', category: 'security', value: 60 }) })]);

for (const [name, fn] of checks) {
  await fn();
  console.log(`ok - ${name}`);
}
console.log('Atlas Insight MVP verification complete.');
