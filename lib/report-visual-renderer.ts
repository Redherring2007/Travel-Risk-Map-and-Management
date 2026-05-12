import type { VisualReportModel } from './report-visual-model';

export function scoreForMergedValue(value: number) {
  if (value >= 75) return 'Critical';
  if (value >= 50) return 'High';
  if (value >= 25) return 'Moderate';
  return 'Low';
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] ?? char));
}

function fmtDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Limited verified data available' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function riskClass(level?: string) {
  const value = (level ?? '').toLowerCase();
  if (value.includes('critical')) return 'critical';
  if (value.includes('high')) return 'high';
  if (value.includes('moderate')) return 'moderate';
  if (value.includes('low')) return 'low';
  return 'unknown';
}

function icon(name: 'shield' | 'route' | 'hotel' | 'health' | 'source' | 'gap') {
  const paths = {
    shield: '<path d="M12 2l7 3v6c0 5-3 9-7 11-4-2-7-6-7-11V5l7-3z"/>',
    route: '<path d="M5 19c4-8 10 0 14-8"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="11" r="2"/>',
    hotel: '<path d="M4 21V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14"/><path d="M16 11h2a2 2 0 0 1 2 2v8"/><path d="M8 9h3M8 13h3M8 17h3"/>',
    health: '<path d="M12 21s-7-4.6-9-9.5C1.5 7.6 4 4 7.7 4c2 0 3.4 1 4.3 2.3C12.9 5 14.3 4 16.3 4 20 4 22.5 7.6 21 11.5 19 16.4 12 21 12 21z"/>',
    source: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    gap: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>'
  };
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}

function badge(level?: string, score?: number | null) {
  return `<span class="badge ${riskClass(level)}">${escapeHtml(level ?? 'Unknown')}${score === null || score === undefined ? '' : ` ${escapeHtml(score)}/100`}</span>`;
}

function list(items: string[], empty = 'Limited verified data available') {
  const safe = items.filter(Boolean);
  if (!safe.length) return `<p class="muted">${escapeHtml(empty)}</p>`;
  return `<ul>${safe.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function card(title: string, body: string, iconName?: Parameters<typeof icon>[0]) {
  return `<section class="card"><h2>${iconName ? icon(iconName) : ''}${escapeHtml(title)}</h2>${body}</section>`;
}

export function renderVisualReportHtml(model: VisualReportModel) {
  const riskBars = model.riskAtGlance.map((item) => `<div class="bar-row"><span>${escapeHtml(item.label)}</span><div class="bar"><i class="${riskClass(String(item.level))}" style="width:${Math.max(8, Math.min(100, item.score ?? 12))}%"></i></div>${badge(String(item.level), item.score)}</div>`).join('');
  const routes = model.itineraryRisk.length ? model.itineraryRisk.map((route) => `<tr><td>${escapeHtml(route.segment)}</td><td>${escapeHtml(route.from ?? 'Manual verification required')}</td><td>${escapeHtml(route.to ?? 'Manual verification required')}</td><td>${badge(String(route.level), route.score)}</td><td>${escapeHtml(route.mitigation)}</td></tr>`).join('') : '<tr><td colspan="5">Limited verified route data available</td></tr>';
  const hotels = model.accommodationSafety.hotels.length ? model.accommodationSafety.hotels.map((hotel) => `<article class="mini"><div class="mini-head"><strong>${escapeHtml(hotel.name)}</strong>${badge(String(hotel.level), hotel.score)}</div><p>${escapeHtml(hotel.note)}</p><small>Confidence: ${escapeHtml(hotel.confidence ?? 'Low')}</small>${list([...hotel.strengths, ...hotel.concerns, ...hotel.controls].slice(0, 5), 'Manual verification required')}</article>`).join('') : `<p class="muted">${escapeHtml(model.accommodationSafety.summary)}</p>`;
  const advisories = model.advisories.length ? model.advisories.map((item) => `<article class="feed"><strong>${escapeHtml(item.title)}</strong>${badge(String(item.level))}<p>${escapeHtml(item.detail)}</p><small>${escapeHtml(item.source ?? 'Source unavailable')} / ${escapeHtml(item.date ? fmtDate(item.date) : 'Date unavailable')}</small></article>`).join('') : '<p class="muted">Limited verified data available</p>';
  const events = model.latestEvents.length ? model.latestEvents.map((item) => `<article class="feed"><strong>${escapeHtml(item.title)}</strong>${badge(String(item.level))}<p>${escapeHtml(item.detail)}</p><small>${escapeHtml(item.source ?? 'Source unavailable')} / ${escapeHtml(item.date ? fmtDate(item.date) : 'Date unavailable')}</small></article>`).join('') : '<p class="muted">No destination-specific relevant events available after evidence filtering.</p>';
  const sources = model.sourceSummary.length ? model.sourceSummary.map((source) => `<span>${escapeHtml(source.source)} / ${escapeHtml(source.status)} / ${escapeHtml(source.confidence)} / ${escapeHtml(source.lastUpdated ? fmtDate(source.lastUpdated) : 'not dated')}</span>`).join('') : '<span>Limited verified data available</span>';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(model.reportMeta.title)} - ${escapeHtml(model.reportMeta.id)}</title><style>
@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#e8edf2;color:#14202b;font-family:Inter,Arial,sans-serif}.page{max-width:1280px;margin:0 auto;background:#f8fafc;min-height:100vh}.atlas-header{background:linear-gradient(135deg,#06111d,#0d1f30 70%,#1b2634);color:#fff;padding:28px 34px;display:flex;justify-content:space-between;gap:24px;border-bottom:4px solid #c79a3b}.brand{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#e7c46a}.atlas-header h1{margin:8px 0 0;font-size:34px}.meta{display:grid;gap:6px;text-align:right;color:#d7e0ea;font-size:12px}.canvas{padding:24px;display:grid;gap:18px}.hero-grid{display:grid;grid-template-columns:1.1fr 2fr;gap:18px}.card{background:#fff;border:1px solid #dce3ea;border-radius:14px;padding:18px;box-shadow:0 10px 28px rgba(16,32,48,.08)}.card h2{margin:0 0 14px;display:flex;align-items:center;gap:9px;font-size:16px;color:#102033}.risk-card{background:#102033;color:#fff;border-color:#102033}.score{font-size:58px;font-weight:800;line-height:1;color:#efc85a}.badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800;border:1px solid #95a3b3;color:#475569;background:#f8fafc}.badge.low{border-color:#2f9e71;color:#197149}.badge.moderate{border-color:#d6a02f;color:#8a5d00}.badge.high{border-color:#e87328;color:#9d3e00}.badge.critical{border-color:#d73737;color:#9b1c1c}.risk-card .badge{background:rgba(255,255,255,.09);color:#fff}.overview{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kv{border-left:3px solid #c79a3b;padding-left:10px}.kv span{display:block;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.08em}.kv strong{font-size:14px}.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}.three{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.bar-row{display:grid;grid-template-columns:110px 1fr auto;gap:10px;align-items:center;margin:10px 0}.bar{height:10px;background:#e5ebf0;border-radius:999px;overflow:hidden}.bar i{display:block;height:100%;border-radius:999px}.bar i.low{background:#2f9e71}.bar i.moderate{background:#d6a02f}.bar i.high{background:#e87328}.bar i.critical{background:#d73737}.ico{width:18px;height:18px;stroke:#c79a3b;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e2e8f0;vertical-align:top}th{color:#64748b;text-transform:uppercase;font-size:11px;letter-spacing:.08em}.mini,.feed{border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin:10px 0;background:#fbfdff}.mini-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.muted,small{color:#64748b}.mapbox{min-height:220px;border-radius:14px;background:linear-gradient(135deg,#102033,#1d3347);color:#dbe7f2;padding:18px;position:relative;overflow:hidden}.mapbox:before{content:"";position:absolute;inset:20px;background:radial-gradient(circle at 35% 45%,rgba(239,200,90,.25),transparent 23%),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:auto,44px 44px,44px 44px}.mapbox>*{position:relative}.source-footer{display:flex;flex-wrap:wrap;gap:8px}.source-footer span{background:#eef3f7;border-radius:999px;padding:7px 10px;font-size:11px}.decision{font-size:28px;font-weight:900;color:#102033}.print-note{display:none}@media(max-width:900px){.hero-grid,.two,.three,.overview{grid-template-columns:1fr}.atlas-header{display:block}.meta{text-align:left;margin-top:16px}}@media print{body{background:#fff}.page{max-width:none}.card{box-shadow:none;break-inside:avoid}.print-note{display:block}}
</style></head><body><main class="page"><header class="atlas-header"><div><div class="brand">Atlas Insight</div><h1>Travel Risk Report</h1><p>${escapeHtml(model.tripOverview.destination)} / ${escapeHtml(model.tripOverview.dates)}</p></div><div class="meta"><span>Report ID: ${escapeHtml(model.reportMeta.id)}</span><span>Generated: ${fmtDate(model.reportMeta.generatedDate)}</span><span>Valid until: ${fmtDate(model.reportMeta.validUntil)}</span></div></header><div class="canvas"><section class="hero-grid"><div class="card risk-card"><h2>${icon('shield')}Overall Risk</h2><div class="score">${escapeHtml(model.overallRisk.score ?? '--')}</div>${badge(String(model.overallRisk.level), model.overallRisk.score)}<p>${escapeHtml(model.overallRisk.narrative)}</p></div><div class="card"><h2>Trip Overview</h2><div class="overview"><div class="kv"><span>Country</span><strong>${escapeHtml(model.tripOverview.country)}</strong></div><div class="kv"><span>City</span><strong>${escapeHtml(model.tripOverview.city)}</strong></div><div class="kv"><span>Purpose</span><strong>${escapeHtml(model.tripOverview.purpose)}</strong></div><div class="kv"><span>Traveller</span><strong>${escapeHtml(model.tripOverview.travellerProfile)}</strong></div><div class="kv"><span>Accommodation</span><strong>${escapeHtml(model.tripOverview.accommodation)}</strong></div><div class="kv"><span>Flights</span><strong>${escapeHtml(model.tripOverview.flights)}</strong></div><div class="kv"><span>Recommendation</span><strong>${escapeHtml(model.overallRisk.recommendation)}</strong></div><div class="kv"><span>Confidence</span><strong>${escapeHtml(model.confidence.level)}</strong></div></div></div></section><section class="two">${card('Risk at a Glance', riskBars, 'shield')}${card('Evidence Confidence', `<p><strong>${escapeHtml(model.confidence.evidenceConfidence)}</strong></p><p>${escapeHtml(model.confidence.note)}</p>`, 'source')}</section><section class="two">${card('Key Risk Drivers', list(model.keyRiskDrivers), 'gap')}<section class="card"><h2>${icon('route')}Map / Area Risk</h2><div class="mapbox"><h3>${escapeHtml(model.mapPanel.title)}</h3><p>${escapeHtml(model.mapPanel.detail)}</p>${list(model.mapPanel.locations.map((item)=>`${item.label}: ${item.detail}`))}</div></section></section>${card('Itinerary Route Risk', `<table><thead><tr><th>Segment</th><th>From</th><th>To</th><th>Risk</th><th>Controls</th></tr></thead><tbody>${routes}</tbody></table>`, 'route')}<section class="two">${card('Accommodation and Hotel Safety', `<p>${escapeHtml(model.accommodationSafety.summary)}</p><p class="muted">${escapeHtml(model.accommodationSafety.warning)}</p>${hotels}`, 'hotel')}${card('Health and Medical', `<p>${escapeHtml(model.healthMedical.summary)}</p>${list(model.healthMedical.items)}`, 'health')}</section><section class="two">${card('Emergency and Consular', `<p>${escapeHtml(model.emergencyConsular.summary)}</p>${list(model.emergencyConsular.items)}`, 'shield')}${card('Current Advisories', advisories, 'source')}</section><section class="two">${card('Latest Relevant Events', events, 'source')}${card('Intelligence Gaps', list(model.intelligenceGaps), 'gap')}</section><section class="two">${card('Mitigation Plan', list(model.mitigationPlan), 'shield')}${card('Go / No-Go Recommendation', `<div class="decision">${escapeHtml(model.goNoGoRecommendation.decision)}</div><p>${escapeHtml(model.goNoGoRecommendation.detail)}</p>`, 'shield')}</section><footer class="card"><h2>${icon('source')}Source Summary</h2><div class="source-footer">${sources}</div></footer></div></main></body></html>`;
}
