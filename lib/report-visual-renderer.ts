import type { VisualReportHotel, VisualReportListItem, VisualReportMissingGroup, VisualReportModel, VisualReportRiskBar, VisualReportRouteSegment } from './report-visual-model';

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
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toneClass(value?: string): string {
  const lower = String(value ?? '').toLowerCase();
  if (lower.includes('critical') || lower.includes('avoid')) return 'critical';
  if (lower.includes('high') || lower.includes('caution')) return 'high';
  if (lower.includes('moderate')) return 'moderate';
  if (lower.includes('low') || lower.includes('go')) return 'low';
  return 'neutral';
}

function section(title: string, body: string, wide = false): string {
  return `<section class="section ${wide ? 'wide' : ''}"><div class="section-head"><h2>${escapeHtml(title)}</h2></div>${body}</section>`;
}

function infoPair(label: string, value: unknown): string {
  return `<div class="info-pair"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function judgementCard(title: string, body: string, tone = 'neutral'): string {
  return `<article class="judgement ${toneClass(tone)}"><span>${escapeHtml(title)}</span><p>${escapeHtml(body)}</p></article>`;
}

function riskBar(bar: VisualReportRiskBar): string {
  return `<div class="risk-bar-row">
    <div class="risk-bar-label"><strong>${escapeHtml(bar.label)}</strong><small>${escapeHtml(bar.level)}</small></div>
    <div class="risk-track"><div class="risk-fill ${toneClass(bar.level)}" style="width:${Math.max(4, Math.min(100, bar.score))}%"></div></div>
    <div class="risk-score">${escapeHtml(bar.score)}</div>
    <p>${escapeHtml(bar.rationale)}</p>
  </div>`;
}

function routeTable(segments: VisualReportRouteSegment[]): string {
  if (!segments.length) return `<div class="empty-state">Manual verification required. Add confirmed route, flight and movement details to produce route-specific controls.</div>`;
  return `<table class="data-table route-table"><thead><tr><th>Route</th><th>Score</th><th>Level</th><th>Control</th></tr></thead><tbody>${segments.slice(0, 5).map((segment) => `<tr>
    <td><strong>${escapeHtml(segment.segmentName)}</strong><small>${escapeHtml(segment.from)} to ${escapeHtml(segment.to)}</small></td>
    <td class="numeric">${escapeHtml(segment.score)}</td>
    <td><span class="pill ${toneClass(segment.level)}">${escapeHtml(segment.level)}</span></td>
    <td>${escapeHtml(segment.mitigation)}</td>
  </tr>`).join('')}</tbody></table>`;
}

function hotelSection(hotels: VisualReportHotel[], note: string): string {
  if (!hotels.length) return `<div class="empty-state">No verified hotel recommendation available from current free sources. Manual accommodation review is required.</div><p class="note">${escapeHtml(note)}</p>`;
  return `<div class="hotel-list">${hotels.slice(0, 3).map((hotel) => `<article class="hotel-row">
    <div><strong>${escapeHtml(hotel.name)}</strong><small>Public-map candidate — manual verification required</small></div>
    <div><span class="pill ${toneClass(hotel.level)}">${escapeHtml(hotel.level)} ${escapeHtml(hotel.score)}</span></div>
    <p>${escapeHtml(hotel.note)}</p>
  </article>`).join('')}</div><p class="note">${escapeHtml(note)}</p>`;
}

function proseCard(title: string, items: VisualReportListItem[]): string {
  const item = items.find((entry) => !/limited verified data|manual verification/i.test(entry.detail)) ?? items[0];
  return `<article class="prose-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(item?.detail ?? 'Limited verified data available.')}</p>${item?.source || item?.meta ? `<small>${escapeHtml([item.meta, item.source].filter(Boolean).join(' | '))}</small>` : ''}</article>`;
}

function advisoryEventList(advisories: VisualReportListItem[], events: VisualReportListItem[]): string {
  const items = [...advisories.slice(0, 3), ...events.slice(0, 6)].slice(0, 6);
  if (!items.length) return '<div class="empty-state">Limited verified data available. No relevant advisory or event evidence is available for this report.</div>';
  return `<div class="event-list">${items.map((item) => `<article>
    <div><strong>${escapeHtml(item.title)}</strong>${item.level ? `<span class="pill ${toneClass(item.level)}">${escapeHtml(item.level)}</span>` : ''}</div>
    <p>${escapeHtml(item.detail)}</p>
    <small>${escapeHtml([item.meta, item.source].filter(Boolean).join(' | '))}</small>
  </article>`).join('')}</div>`;
}

function missingGroups(groups: VisualReportMissingGroup[]): string {
  return `<div class="gap-grid">${groups.map((group) => `<article>
    <h3>${escapeHtml(group.category)}</h3>
    <p>${escapeHtml(group.missingItems.slice(0, 4).join(', ') || 'No material gap identified.')}</p>
    <small>${escapeHtml(group.whatToAdd)} ${escapeHtml(group.confidenceImpact)}</small>
  </article>`).join('')}</div>`;
}

function mitigationPlan(model: VisualReportModel): string {
  const controls = [
    ['Before travel', model.narrative.requiredControlsSummary],
    ['Arrival', model.routeAndMovement.note],
    ['Daily movement', model.routeAndMovement.segments[0]?.mitigation ?? 'Use movement controls proportionate to the assessed route and destination risk.'],
    ['Incident response', model.narrative.confidenceNarrative]
  ];
  return `<ol class="priority-list">${controls.map(([title, body]) => `<li><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></li>`).join('')}</ol>`;
}

function sourceFooter(items: VisualReportListItem[]): string {
  return `<div class="source-grid">${items.slice(0, 8).map((item) => `<div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml([item.detail, item.meta, item.source].filter(Boolean).join(' | '))}</span></div>`).join('')}</div>`;
}

function dataQualityStrip(model: VisualReportModel): string {
  const quality = model.dataQuality;
  return `<div class="quality-strip">
    ${infoPair('Threat rating', model.riskAtGlance.threatRating)}
    ${infoPair('Confidence rating', model.riskAtGlance.confidenceRating)}
    ${infoPair('Data quality', model.riskAtGlance.dataQualityRating)}
    ${infoPair('Excluded global events', model.riskAtGlance.excludedGlobalEventsCount)}
    ${infoPair('Live sources', quality.liveSourcesCount)}
    ${infoPair('Fallback / missing', quality.fallbackOrMissingSourcesCount)}
    ${infoPair('Latest source', formatDate(quality.latestSourceDate))}
    ${infoPair('Manual review', model.riskAtGlance.manualReviewRequirements.length ? 'Required' : 'Monitor')}
  </div>`;
}

export function renderVisualReportHtml(model: VisualReportModel): string {
  const overview = Object.fromEntries(model.tripOverview.map((item) => [item.label, item.value]));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(model.reportMeta.title)}</title>
<style>
  :root { --navy:#07111f; --navy2:#101c2f; --ink:#172033; --muted:#627186; --line:#dce2ea; --gold:#b88a35; --gold2:#dfb868; --paper:#f4f6f8; --low:#16794a; --moderate:#ad7d14; --high:#bd5b1f; --critical:#a92822; }
  * { box-sizing:border-box; min-width:0; }
  body { margin:0; background:#d9dee6; color:var(--ink); font-family:Arial, Helvetica, sans-serif; line-height:1.42; }
  .report { max-width:1180px; margin:0 auto; background:white; box-shadow:0 22px 60px rgba(7,17,31,.18); }
  .header { background:linear-gradient(135deg,var(--navy),var(--navy2)); color:white; padding:26px 34px 28px; border-bottom:4px solid var(--gold); }
  .brand-line { display:flex; justify-content:space-between; gap:20px; color:var(--gold2); text-transform:uppercase; letter-spacing:.08em; font-size:11px; }
  .header h1 { margin:20px 0 4px; font-size:34px; line-height:1.05; letter-spacing:0; }
  .report-meta { color:#cbd7e5; font-size:12px; }
  .hero { display:grid; grid-template-columns:65fr 35fr; gap:18px; margin-top:22px; }
  .hero-main, .hero-side { border:1px solid rgba(223,184,104,.28); background:rgba(255,255,255,.075); border-radius:14px; padding:18px; }
  .risk-lockup { display:grid; grid-template-columns:128px 1fr; gap:18px; align-items:start; }
  .score { color:var(--gold2); font-size:72px; line-height:.9; font-weight:800; }
  .risk-label { display:block; color:#95a8bd; font-size:10px; text-transform:uppercase; letter-spacing:.08em; margin-bottom:6px; }
  .hero-main h2 { margin:0 0 8px; color:white; font-size:22px; }
  .hero-main p { color:#e3ebf5; margin:0 0 10px; font-size:14px; }
  .hero-drivers { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:12px; }
  .hero-drivers div { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.1); border-radius:10px; padding:9px; color:#dce6f1; font-size:12px; }
  .hero-side { display:flex; flex-direction:column; gap:10px; }
  .fact-row { display:grid; grid-template-columns:112px 1fr; gap:10px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,.1); font-size:12px; }
  .fact-row span { color:#98a9bc; text-transform:uppercase; letter-spacing:.06em; font-size:10px; }
  .fact-row strong { color:white; font-weight:700; overflow-wrap:anywhere; }
  .badge-row { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
  .badge, .pill { display:inline-flex; align-items:center; border:1px solid currentColor; border-radius:999px; padding:4px 8px; font-size:11px; font-weight:700; }
  .badge { color:var(--gold2); background:rgba(223,184,104,.12); }
  main { background:var(--paper); padding:22px 30px 30px; display:grid; grid-template-columns:repeat(12,1fr); gap:14px; }
  .section { grid-column:span 6; background:white; border:1px solid var(--line); border-radius:14px; padding:16px; page-break-inside:avoid; break-inside:avoid; box-shadow:0 8px 24px rgba(23,32,51,.055); }
  .section.wide { grid-column:span 12; }
  .section-head { border-bottom:1px solid var(--line); margin:-2px 0 12px; padding-bottom:8px; }
  .section h2 { margin:0; font-size:16px; letter-spacing:0; }
  .section h3 { margin:0 0 6px; font-size:13px; }
  p { margin:0; overflow-wrap:anywhere; }
  small { display:block; color:var(--muted); font-size:11px; margin-top:5px; overflow-wrap:anywhere; }
  .quality-strip { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-top:12px; }
  .info-pair { background:#f7f9fb; border:1px solid var(--line); border-radius:10px; padding:9px; }
  .info-pair span { display:block; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; font-size:10px; margin-bottom:4px; }
  .info-pair strong { font-size:13px; overflow-wrap:anywhere; }
  .risk-bars { display:grid; gap:9px; }
  .risk-bar-row { display:grid; grid-template-columns:150px 1fr 44px; gap:10px; align-items:center; padding:8px 0; border-bottom:1px solid #edf1f5; }
  .risk-bar-row:last-child { border-bottom:0; }
  .risk-bar-row p { grid-column:2 / 4; color:var(--muted); font-size:12px; }
  .risk-bar-label small { color:var(--muted); font-size:11px; }
  .risk-track { height:9px; border-radius:999px; background:#e8edf3; overflow:hidden; }
  .risk-fill { height:100%; border-radius:999px; background:var(--muted); }
  .risk-score { text-align:right; font-weight:800; color:var(--ink); }
  .low { color:var(--low); } .moderate { color:var(--moderate); } .high { color:var(--high); } .critical { color:var(--critical); }
  .risk-fill.low { background:var(--low); } .risk-fill.moderate { background:var(--moderate); } .risk-fill.high { background:var(--high); } .risk-fill.critical { background:var(--critical); }
  .judgement-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
  .judgement { border:1px solid var(--line); border-left:4px solid var(--gold); border-radius:12px; padding:14px; background:#fbfcfe; min-height:150px; }
  .judgement span { display:block; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; font-size:10px; margin-bottom:8px; }
  .data-table { width:100%; border-collapse:collapse; table-layout:fixed; }
  th, td { padding:10px; border-bottom:1px solid var(--line); vertical-align:top; text-align:left; font-size:12px; overflow-wrap:anywhere; }
  th { background:#f3f6f9; color:#596a80; text-transform:uppercase; letter-spacing:.05em; font-size:10px; }
  .numeric { font-weight:800; width:68px; }
  .route-table th:nth-child(1) { width:28%; } .route-table th:nth-child(2) { width:8%; } .route-table th:nth-child(3) { width:12%; }
  .hotel-list, .event-list, .source-grid, .gap-grid { display:grid; gap:10px; }
  .hotel-row { display:grid; grid-template-columns:1.3fr auto 2fr; gap:12px; align-items:start; border:1px solid var(--line); border-radius:12px; padding:12px; background:#fbfcfe; }
  .prose-pair { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .prose-card { border:1px solid var(--line); border-radius:12px; padding:14px; background:#fbfcfe; min-height:130px; }
  .event-list article { border:1px solid var(--line); border-radius:10px; padding:10px; background:#fbfcfe; }
  .event-list article div { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; margin-bottom:5px; }
  .gap-grid { grid-template-columns:repeat(3,1fr); }
  .gap-grid article { border:1px solid #eadab9; background:#fffaf0; border-radius:10px; padding:11px; }
  .priority-list { margin:0; padding-left:22px; display:grid; gap:9px; }
  .priority-list li { padding-left:4px; }
  .priority-list p { color:#3b4a5f; font-size:13px; margin-top:3px; }
  .final-card { border-radius:14px; padding:18px; background:linear-gradient(135deg,#0e1b2c,#172a43); color:white; }
  .final-card h3 { margin:0 0 8px; color:var(--gold2); font-size:22px; }
  .final-card p { color:#e4edf6; }
  .source-grid { grid-template-columns:repeat(4,1fr); }
  .source-grid div { border-top:1px solid var(--line); padding-top:8px; }
  .source-grid span { display:block; color:var(--muted); font-size:11px; margin-top:3px; overflow-wrap:anywhere; }
  .empty-state, .note { color:var(--muted); font-size:13px; }
  .note { margin-top:8px; }
  .footer { padding:16px 30px 24px; color:var(--muted); font-size:11px; border-top:1px solid var(--line); }
  @media (max-width:900px) { .hero, .risk-lockup, .quality-strip, .judgement-grid, .prose-pair, .hotel-row, .gap-grid, .source-grid { grid-template-columns:1fr; } main { grid-template-columns:1fr; padding:16px; } .section, .section.wide { grid-column:1; } .risk-bar-row { grid-template-columns:1fr 1fr 44px; } .risk-bar-row p { grid-column:1 / 4; } }
  @media print { @page { size:A4; margin:11mm; } body { background:white; } .report { max-width:none; box-shadow:none; } .header { padding:18px 22px; } main { padding:14px; gap:10px; } .section { box-shadow:none; padding:12px; page-break-inside:avoid; break-inside:avoid; } .hero-main, .hero-side, .judgement, .prose-card, .hotel-row, .event-list article, .gap-grid article { page-break-inside:avoid; break-inside:avoid; } .score { font-size:56px; } }
</style>
</head>
<body>
<div class="report">
  <header class="header">
    <div class="brand-line"><strong>Atlas Insight</strong><span>Report ID ${escapeHtml(model.reportMeta.reportId)}</span></div>
    <h1>${escapeHtml(model.reportMeta.title || 'Travel Risk Report')}</h1>
    <div class="report-meta">Generated ${formatDate(model.reportMeta.generatedAt)} | Valid until ${formatDate(model.reportMeta.validUntil)}</div>
    <div class="hero">
      <div class="hero-main">
        <div class="risk-lockup">
          <div>
            <span class="risk-label">Overall Risk Score</span>
            <div class="score">${escapeHtml(model.riskAtGlance.overallScore ?? 'N/A')}</div>
            <div class="badge-row"><span class="badge">${escapeHtml(model.riskAtGlance.overallLevel)}</span><span class="badge">${escapeHtml(model.goNoGo.recommendation)}</span></div>
          </div>
          <div>
            <span class="risk-label">Executive Position ${model.narrative.source === 'ai-assisted' ? '| AI-assisted from sourced data' : '| Deterministic'}</span>
            <h2>${escapeHtml(model.executiveSnapshot.destination)}</h2>
            <p>${escapeHtml(model.narrative.executivePosition)}</p>
          </div>
        </div>
        <div class="hero-drivers">${model.riskAtGlance.keyDrivers.slice(0, 3).map((driver) => `<div><strong>${escapeHtml(driver.title)}</strong><br/>${escapeHtml(driver.detail)}</div>`).join('')}</div>
      </div>
      <aside class="hero-side">
        ${infoPair('Destination', overview.Destination ?? model.executiveSnapshot.destination)}
        ${infoPair('Dates', overview.Dates ?? 'Manual verification required')}
        ${infoPair('Purpose', overview.Purpose ?? 'Manual verification required')}
        ${infoPair('Threat rating', model.riskAtGlance.threatRating)}
        ${infoPair('Confidence rating', model.riskAtGlance.confidenceRating)}
        ${infoPair('Data quality', model.riskAtGlance.dataQualityRating)}
        ${infoPair('Excluded global events', model.riskAtGlance.excludedGlobalEventsCount)}
      </aside>
    </div>
  </header>
  <main>
    ${section('Risk at a Glance', `<div class="risk-bars">${model.riskAtGlance.bars.slice(0, 8).map(riskBar).join('')}</div>`, true)}
    ${section('Key Intelligence Judgements', `<div class="judgement-grid">${judgementCard('Principal concern', model.narrative.principalJudgement, model.riskAtGlance.overallLevel)}${judgementCard('Operational impact', model.narrative.operationalImpact, model.riskAtGlance.overallLevel)}${judgementCard('Immediate control requirement', model.narrative.requiredControlsSummary, model.goNoGo.recommendation)}</div>`, true)}
    ${section('Trip Overview', dataQualityStrip(model), true)}
    ${section('Route and Movement', routeTable(model.routeAndMovement.segments), true)}
    ${section('Accommodation and Area Safety', hotelSection(model.accommodationSafety.hotels, model.accommodationSafety.note), true)}
    ${section('Health, Emergency and Consular', `<div class="prose-pair">${proseCard('Health and Medical', model.healthAndMedical)}${proseCard('Emergency and Consular', model.emergencyAndConsular)}</div>`, true)}
    ${section('Advisories and Relevant Events', advisoryEventList(model.advisories, model.latestEvents), true)}
    ${section('Intelligence Gaps', missingGroups(model.missingDataGroups), true)}
    ${section('Mitigation Plan', mitigationPlan(model), true)}
    ${section('Final Recommendation', `<div class="final-card"><h3>${escapeHtml(model.goNoGo.recommendation)}</h3><p>${escapeHtml(model.narrative.finalRationale)}</p></div>`, true)}
    ${section('Source Summary', sourceFooter(model.sourceSummary), true)}
  </main>
  <footer class="footer">Atlas Insight Risk Map and Travel Management. This visual report uses stored trip, assessment, advisory, event and source records supplied by the platform. Public-map accommodation candidates are not verified hotel recommendations unless separately validated.</footer>
</div>
</body>
</html>`;
}
