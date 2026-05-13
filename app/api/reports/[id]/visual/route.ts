import { NextResponse } from 'next/server';
import { generateVisualReportExecutiveSummary } from '@/lib/ai';
import { applyAiExecutiveSummary, buildVisualReportModel } from '@/lib/report-visual-model';
import { renderVisualReportHtml } from '@/lib/report-visual-renderer';
import { loadFreshnessSummary, loadRelevantAdvisories, loadRelevantEvents } from '@/lib/source-data';
import { store } from '@/lib/store';
import { getLatestTripAssessment } from '@/lib/trip-assessment';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await store.getReport(id);
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

  const trip = await store.getTrip(report.tripId);
  const assessment = trip ? await getLatestTripAssessment(trip.id) : null;
  const primary = trip?.locations?.[0];
  const [advisories, events, sources] = await Promise.all([
    loadRelevantAdvisories(primary?.countryIso2),
    loadRelevantEvents(primary?.countryIso2, primary?.city),
    loadFreshnessSummary()
  ]);

  const countryProfile = {
    name: primary?.country,
    advisoryPosition: advisories[0]?.title,
    advisories,
    events,
    sources,
    confidence: assessment?.confidence
  };
  const baseModel = buildVisualReportModel(report, assessment, trip, countryProfile, sources);
  const aiSummary = await generateVisualReportExecutiveSummary({
    destination: baseModel.executiveSnapshot.destination,
    score: baseModel.riskAtGlance.overallScore,
    level: baseModel.riskAtGlance.overallLevel,
    recommendation: baseModel.goNoGo.recommendation,
    confidence: baseModel.riskAtGlance.confidence,
    keyReason: baseModel.executiveSnapshot.keyReason,
    advisory: baseModel.executiveSnapshot.advisory,
    missingData: baseModel.missingDataGroups.flatMap((group) => group.missingItems),
    sourceSummary: baseModel.sourceSummary.map((source) => `${source.title}: ${source.detail}`)
  });
  const model = aiSummary.configured ? applyAiExecutiveSummary(baseModel, aiSummary.text) : baseModel;
  const html = renderVisualReportHtml(model);

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
