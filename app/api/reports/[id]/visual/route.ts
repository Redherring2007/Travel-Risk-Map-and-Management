import { buildVisualReportModel } from '@/lib/report-visual-model';
import { renderVisualReportHtml } from '@/lib/report-visual-renderer';
import { mergeCountryProfile } from '@/lib/country-profile-merge';
import { store } from '@/lib/store';
import { getLatestTripAssessment } from '@/lib/trip-assessment';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await store.getReport(id);
  if (!report) return new Response('Report not found', { status: 404 });

  const trip = await store.getTrip(report.tripId);
  const assessment = trip ? await getLatestTripAssessment(trip.id) : null;
  const primary = trip?.locations[0];
  const countryProfile = primary ? await mergeCountryProfile(primary.countryIso2, primary.city) : null;
  const model = buildVisualReportModel(report, assessment, trip, countryProfile, assessment?.sourceSummary ?? []);
  const html = renderVisualReportHtml(model);

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
