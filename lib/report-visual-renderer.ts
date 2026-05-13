import type { VisualReportBadge, VisualReportHotel, VisualReportListItem, VisualReportMissingGroup, VisualReportModel, VisualReportRouteSegment } from './report-visual-model';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function toneClass(value?: string): string {
  const lower = String(value ?? '').toLowerCase();
  if (lower.includes('critical') || lower.includes('avoid')) return 'critical';
  if (lower.includes('high') || lower.includes('caution')) return 'high';
  if (lower.includes('moderate')) return 'moderate';
  if (lower.includes('low') || lower.includes('go')) return 'low';
  return 'neutral';
}

function icon(name: string): string {
  const paths: Record<string, string> = {
    shield: '<path d="M12 3l7 3v5c0 5-3.4 8.6-7 10-3.6-1.4-7-5-7-10V6l7-3z"/>',
    route: '<path d="M5 19c4-7 10 1 14-6"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="13" r="2"/>',
    hotel: '<path d="M4 20V6h8v14"/><path d="M12 10h8v10"/><path d="M7 9h2M7 13h2M15 14h2"/>',
    medical: '<path d="M12 5v14M5 12h14"/>',
    alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 9v5M12 17h.01"/>',
    source: '<path d="M6 4h9l3 3v13H6z"/><path d="M15 4v4h4M8 12h8M8 16h8"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] ?? paths.shield}</svg>`;
}

function badge(item: VisualReportBadge): string {
  return `<div class="metric ${item.tone ?? toneClass(item.value)}"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`;
}

function itemCard(item: VisualReportListItem): string {
  return `<article class="item-card ${toneClass(item.level)}">
    <div class="item-head"><strong>${escapeHtml(item.title)}</strong>${item.level ? `<span>${escapeHtml(item.level)}</span>` : ''}</div>
    <p>${escapeHtml(item.detail)}</p>
    ${(item.meta || item.source) ? `<small>${escapeHtml([item.meta, item.source].filter(Boolean).join(' | '))}</small>` : ''}
  </article>`;
}

function section(title: string, iconName: string, body: string): string {
  return `<section class="panel"><div class="section-title">${icon(iconName)}<h2>${escapeHtml(title)}</h2></div>${body}</section>`;
}

function routeTable(segments: VisualReportRouteSegment[]): string {
  if (!segments.length) return '<div class="missing-card">Manual verification required</div>';
  return `<table class="route-table"><thead><tr><th>Segment</th><th>From</th><th>To</th><th>Risk</th><th>Mitigation</th></tr></thead><tbody>${segments.map((segment) => `<tr>
    <td><strong>${escapeHtml(segment.segmentName)}</strong><small>${escapeHtml(segment.confidence)}</small></td>
    <td>${escapeHtml(segment.from)}</td>
    <td>${escapeHtml(segment.to)}</td>
    <td><span class="pill ${toneClass(segment.level)}">${escapeHtml(segment.level)} ${escapeHtml(segment.score)}</span></td>
    <td>${escapeHtml(segment.mitigation)}</td>
  </tr>`).join('')}</tbody></table>`;
}

function hotelCards(hotels: VisualReportHotel[], note: string): string {
  const cards = hotels.length ? hotels.map((hotel) => `<article class="hotel-card ${toneClass(hotel.level)}">
    <div class="item-head"><strong>${escapeHtml(hotel.name)}</strong><span>${escapeHtml(hotel.level)} ${escapeHtml(hotel.score)}</span></div>
    <p>${escapeHtml(hotel.note)}</p>
    <div class="split-list"><div><b>Strengths</b>${(hotel.strengths.length ? hotel.strengths : ['Manual verification required']).map((item) => `<small>${escapeHtml(item)}</small>`).join('')}</div><div><b>Concerns</b>${(hotel.concerns.length ? hotel.concerns : ['Limited verified data available']).map((item) => `<small>${escapeHtml(item)}</small>`).join('')}</div></div>
  </article>`).join('') : '<div class="missing-card">No verified hotel recommendations available from free sources. Manual verification required.</div>';
  return `<div class="hotel-grid">${cards}</div><p class="section-note">${escapeHtml(note)}</p>`;
}

function missingDataCards(groups: VisualReportMissingGroup[]): string {
  return `<div class="missing-grid">${groups.map((group) => `<article class="missing-action-card">
    <div class="item-head"><strong>${escapeHtml(group.category)}</strong><span>${escapeHtml(group.missingItems.length ? `${group.missingItems.length} input${group.missingItems.length === 1 ? '' : 's'}` : 'Review')}</span></div>
    <div class="missing-tags">${group.missingItems.map((item) => `<small>${escapeHtml(item)}</small>`).join('')}</div>
    <p><b>Why it matters:</b> ${escapeHtml(group.whyItMatters)}</p>
    <p><b>Add next:</b> ${escapeHtml(group.whatToAdd)}</p>
    <p><b>Confidence effect:</b> ${escapeHtml(group.confidenceImpact)}</p>
  </article>`).join('')}</div>`;
}

function dataQualityPanel(model: VisualReportModel): string {
  const quality = model.dataQuality;
  return `<div class="quality-layout">
    <div class="quality-score">
      <span>Data Quality</span>
      <strong>${escapeHtml(quality.overallDataConfidence)}</strong>
      <small>Latest source: ${formatDate(quality.latestSourceDate)}</small>
    </div>
    <div class="metric-row compact">
      ${badge({ label: 'Live sources', value: String(quality.liveSourcesCount), tone: 'low' })}
      ${badge({ label: 'Fallback / missing', value: String(quality.fallbackOrMissingSourcesCount), tone: quality.fallbackOrMissingSourcesCount ? 'moderate' : 'low' })}
      ${badge({ label: 'Visible sources', value: String(model.sourceSummary.length), tone: 'neutral' })}
      ${badge({ label: 'Events shown', value: String(model.latestEvents.length), tone: 'neutral' })}
    </div>
    <div class="cards">${quality.recommendedNextInputs.slice(0, 5).map((item) => itemCard({ title: 'Recommended next input', detail: item })).join('')}</div>
  </div>`;
}

function compactDetailCards(items: VisualReportListItem[]): string {
  return `<div class="compact-detail-grid">${items.slice(0, 6).map(itemCard).join('')}</div>`;
}

export function renderVisualReportHtml(model: VisualReportModel): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(model.reportMeta.title)}</title>
<style>
  :root { --navy:#08111f; --navy2:#0d1b2d; --ink:#172033; --muted:#607089; --line:#dce3ea; --gold:#b88a35; --gold2:#e1b76a; --paper:#f6f7f9; --low:#16794a; --moderate:#b88916; --high:#c85d1c; --critical:#b3261e; }
  * { box-sizing: border-box; }
  body { margin:0; background:#d8dde5; color:var(--ink); font-family: Arial, Helvetica, sans-serif; line-height:1.45; }
  .report { max-width:1280px; margin:0 auto; background:white; min-height:100vh; box-shadow:0 24px 70px rgba(8,17,31,.22); }
  .hero { background:linear-gradient(135deg,var(--navy),var(--navy2)); color:white; padding:34px 42px; border-bottom:4px solid var(--gold); }
  .brand { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; text-transform:uppercase; letter-spacing:.08em; font-size:12px; color:var(--gold2); }
  h1 { margin:26px 0 8px; font-size:42px; line-height:1.05; letter-spacing:0; }
  .subtitle { max-width:820px; color:#d7e1ec; font-size:16px; }
  .hero-grid { display:grid; grid-template-columns: 1.45fr .8fr; gap:24px; margin-top:26px; align-items:stretch; }
  .score-card { background:rgba(255,255,255,.08); border:1px solid rgba(225,183,106,.34); border-radius:18px; padding:22px; display:grid; grid-template-columns:160px 1fr; gap:22px; min-height:0; }
  .score-number { font-size:70px; line-height:.92; font-weight:800; color:var(--gold2); }
  .score-label { color:#b7c5d5; font-size:12px; text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px; }
  .score-summary { color:#e6edf6; font-size:14px; margin:10px 0 12px; }
  .score-reason { border-left:2px solid var(--gold); padding-left:12px; color:#d5dfeb; font-size:13px; margin:0; }
  .score-mini { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
  .recommendation { display:inline-flex; padding:7px 10px; border-radius:999px; background:rgba(225,183,106,.16); color:var(--gold2); font-weight:700; font-size:12px; }
  .meta-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .meta { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px; }
  .meta span, .metric span { display:block; color:#8fa1b7; font-size:11px; text-transform:uppercase; letter-spacing:.06em; margin-bottom:5px; }
  .meta strong, .metric strong { font-size:15px; color:inherit; }
  main { padding:30px 42px 42px; background:var(--paper); }
  .grid { display:grid; grid-template-columns:repeat(12,1fr); gap:18px; }
  .panel { grid-column:span 6; background:white; border:1px solid var(--line); border-radius:18px; padding:20px; break-inside:avoid; box-shadow:0 10px 30px rgba(23,32,51,.06); }
  .panel.wide { grid-column:span 12; }
  .section-title { display:flex; align-items:center; gap:10px; margin-bottom:14px; border-bottom:1px solid var(--line); padding-bottom:12px; }
  .section-title svg { width:22px; height:22px; stroke:var(--gold); fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; flex:none; }
  h2 { margin:0; font-size:18px; letter-spacing:0; }
  h3 { margin:16px 0 10px; font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:#5b6a7e; }
  p { margin:0 0 12px; color:#33425a; }
  .metric-row { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
  .metric-row.compact { grid-template-columns:repeat(4,minmax(0,1fr)); margin-bottom:12px; }
  .metric { border-radius:14px; padding:14px; background:#f8fafc; border:1px solid var(--line); min-height:82px; }
  .metric.low, .pill.low { border-color:rgba(22,121,74,.32); color:var(--low); }
  .metric.moderate, .pill.moderate { border-color:rgba(184,137,22,.36); color:var(--moderate); }
  .metric.high, .pill.high { border-color:rgba(200,93,28,.36); color:var(--high); }
  .metric.critical, .pill.critical { border-color:rgba(179,38,30,.36); color:var(--critical); }
  .cards { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
  .item-card, .hotel-card, .missing-card { border:1px solid var(--line); border-radius:14px; padding:14px; background:#fbfcfe; }
  .item-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:8px; }
  .item-head span, .pill { border:1px solid currentColor; border-radius:999px; padding:3px 8px; font-size:11px; font-weight:700; white-space:nowrap; }
  small { display:block; color:var(--muted); font-size:12px; margin-top:6px; }
  .route-table { width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; border-radius:14px; border:1px solid var(--line); }
  th, td { padding:12px; text-align:left; border-bottom:1px solid var(--line); vertical-align:top; font-size:13px; }
  th { background:#f2f5f8; color:#4d5d73; text-transform:uppercase; letter-spacing:.05em; font-size:11px; }
  tr:last-child td { border-bottom:0; }
  .hotel-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
  .missing-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
  .missing-action-card { border:1px solid #e2d3ad; border-radius:14px; padding:14px; background:#fffaf0; }
  .missing-tags { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0 10px; }
  .missing-tags small { margin:0; padding:4px 8px; background:white; border:1px solid #eadbb9; border-radius:999px; color:#735517; }
  .compact-detail-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
  .quality-layout { display:grid; grid-template-columns:240px 1fr; gap:16px; align-items:start; }
  .quality-score { border-radius:16px; background:linear-gradient(135deg,#101e31,#172a43); color:white; padding:18px; min-height:150px; }
  .quality-score span { display:block; color:var(--gold2); text-transform:uppercase; letter-spacing:.07em; font-size:11px; }
  .quality-score strong { display:block; margin:12px 0; font-size:32px; }
  .split-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:12px; }
  .split-list b { display:block; font-size:12px; margin-bottom:4px; color:#243149; }
  .section-note { margin-top:12px; color:var(--muted); font-size:13px; }
  .map-panel { min-height:220px; border-radius:16px; background:linear-gradient(135deg,#edf1f5,#ffffff); border:1px dashed #b8c2cf; display:flex; align-items:center; justify-content:center; color:var(--muted); text-align:center; padding:20px; }
  .footer { margin-top:18px; padding:18px 42px 30px; background:white; border-top:1px solid var(--line); color:var(--muted); font-size:12px; }
  @media (max-width:900px) { .hero-grid, .score-card, .metric-row, .hotel-grid, .missing-grid, .compact-detail-grid, .quality-layout, .cards, .meta-grid { grid-template-columns:1fr; } .panel { grid-column:span 12; } h1 { font-size:32px; } main, .hero { padding-left:22px; padding-right:22px; } }
  @media print { @page { size:A4 landscape; margin:10mm; } body { background:white; } .report { box-shadow:none; max-width:none; } .panel, .score-card, .item-card, .hotel-card { break-inside:avoid; } main { padding:18px; } .hero { padding:22px; } }
</style>
</head>
<body>
<div class="report">
  <header class="hero">
    <div class="brand"><strong>Atlas Insight</strong><span>Report ID ${escapeHtml(model.reportMeta.reportId)} | Generated ${formatDate(model.reportMeta.generatedAt)}</span></div>
    <h1>Travel Risk Report</h1>
    <p class="subtitle">${escapeHtml(model.executiveSnapshot.summary)}</p>
    <div class="hero-grid">
      <div class="score-card">
        <div>
          <div class="score-label">Overall Risk Rating</div>
          <div class="score-number">${escapeHtml(model.riskAtGlance.overallScore ?? 'N/A')}</div>
          <strong>${escapeHtml(model.riskAtGlance.overallLevel)}</strong>
          <div class="score-mini"><span class="recommendation">${escapeHtml(model.goNoGo.recommendation)}</span><span class="recommendation">${escapeHtml(model.riskAtGlance.confidence)} confidence</span></div>
        </div>
        <div>
          <div class="score-label">Executive summary ${model.executiveSnapshot.summarySource === 'ai-assisted' ? '| AI-assisted from sourced data' : '| sourced report data'}</div>
          <p class="score-summary">${escapeHtml(model.executiveSnapshot.summary)}</p>
          <p class="score-reason"><strong>Key reason:</strong> ${escapeHtml(model.executiveSnapshot.keyReason)}</p>
        </div>
      </div>
      <div class="meta-grid">${model.tripOverview.slice(0, 6).map((item) => `<div class="meta"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join('')}</div>
    </div>
  </header>
  <main class="grid">
    ${section('Executive Snapshot', 'shield', `<p>${escapeHtml(model.executiveSnapshot.summary)}</p><div class="cards">${itemCard({ title: 'Current advisory', detail: model.executiveSnapshot.advisory })}${itemCard({ title: 'Key issue', detail: model.executiveSnapshot.keyIssue })}</div>`)}
    ${section('Risk at a Glance', 'alert', `<div class="metric-row">${model.riskAtGlance.badges.map(badge).join('')}</div><div class="cards" style="margin-top:12px">${model.riskAtGlance.keyDrivers.map(itemCard).join('')}</div>`)}
    ${section('Trip Overview', 'source', `<div class="metric-row">${model.tripOverview.map(badge).join('')}</div>`)}
    ${section('Data Quality', 'source', dataQualityPanel(model)).replace('class="panel"', 'class="panel wide"')}
    ${section('Route and Movement', 'route', `${routeTable(model.routeAndMovement.segments)}<p class="section-note">${escapeHtml(model.routeAndMovement.note)}</p>`).replace('class="panel"', 'class="panel wide"')}
    ${section('Accommodation Safety', 'hotel', hotelCards(model.accommodationSafety.hotels, model.accommodationSafety.note)).replace('class="panel"', 'class="panel wide"')}
    ${section('Health and Medical', 'medical', `<div class="cards">${model.healthAndMedical.map(itemCard).join('')}</div>`)}
    ${section('Emergency and Consular', 'shield', `<div class="cards">${model.emergencyAndConsular.map(itemCard).join('')}</div>`)}
    ${section('Operational Detail Cards', 'shield', `<h3>Official advisories</h3>${compactDetailCards(model.dataDepth.officialAdvisories)}<h3>Country indicators</h3>${compactDetailCards(model.dataDepth.countryIndicators)}<h3>Route / movement controls</h3>${compactDetailCards(model.dataDepth.routeMovementControls)}<h3>Hotel safety status</h3>${compactDetailCards(model.dataDepth.hotelSafetyStatus)}<h3>Source confidence</h3>${compactDetailCards(model.dataDepth.sourceConfidence)}`).replace('class="panel"', 'class="panel wide"')}
    ${section('Current Advisories', 'alert', `<div class="cards">${model.advisories.map(itemCard).join('')}</div>`)}
    ${section('Latest Relevant Events', 'alert', `<div class="cards">${model.latestEvents.map(itemCard).join('')}</div>`)}
    ${section('Map / Area Risk', 'route', `<div class="map-panel">Structured map image not embedded in this report. Use the Atlas Insight Risk Map for live geographic exploration. Report data is limited to sourced itinerary and assessment records.</div>`)}
    ${section('Intelligence Gaps', 'source', `<div class="cards">${model.intelligenceGaps.map(itemCard).join('')}</div>`)}
    ${section('Missing Data Inputs', 'source', missingDataCards(model.missingDataGroups)).replace('class="panel"', 'class="panel wide"')}
    ${section('Mitigation Plan', 'shield', `<div class="cards">${model.mitigationPlan.map(itemCard).join('')}</div>`)}
    ${section('Go / No-Go', 'alert', `<p><strong>${escapeHtml(model.goNoGo.recommendation)}</strong></p><p>${escapeHtml(model.goNoGo.rationale)}</p>`)}
    ${section('Source Summary', 'source', `<div class="cards">${model.sourceSummary.map(itemCard).join('')}</div>`).replace('class="panel"', 'class="panel wide"')}
  </main>
  <footer class="footer">Atlas Insight Risk Map and Travel Management | Valid until ${formatDate(model.reportMeta.validUntil)} | This report uses only stored trip, assessment, advisory, event and source records supplied by the platform. Missing items are marked for manual verification.</footer>
</div>
</body>
</html>`;
}
