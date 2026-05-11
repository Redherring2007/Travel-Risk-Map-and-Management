import { NextResponse } from 'next/server';
import { requireIngestionAccess } from '@/lib/admin-protection';
import { isNeonConfigured, query } from '@/lib/neon';

const monitoredTables = [
  'countries',
  'country_master_profiles',
  'country_health_profiles',
  'country_security_profiles',
  'country_infrastructure_profiles',
  'location_pois',
  'hotel_candidates',
  'risk_events',
  'advisories',
  'source_references',
  'data_source_freshness',
  'trips',
  'trip_risk_assessments',
  'trip_reports'
];

type FreshnessRow = { source_key: string; source_name: string; status: string; last_success_at: string | null; last_attempt_at: string | null; last_error: string | null; records_fetched: number; records_stored: number };

async function countTable(table: string) {
  try {
    const rows = await query<{ count: string }>(`select count(*)::text as count from ${table}`);
    return { table, count: Number(rows[0]?.count ?? 0) };
  } catch (error) {
    return { table, count: 0, error: error instanceof Error ? error.message : 'count failed' };
  }
}

export async function GET(request: Request) {
  const access = requireIngestionAccess(request);
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
  if (!isNeonConfigured()) {
    return NextResponse.json({
      tableCounts: [],
      latestIngestion: null,
      staleProviders: [],
      emptyTables: monitoredTables,
      fallbackRisk: 'High - DATABASE_URL is not configured; app is using demo fallback data.',
      recommendations: ['Set DATABASE_URL', 'Run migrations', 'Run npm run bootstrap:countries']
    });
  }

  const tableCounts = await Promise.all(monitoredTables.map(countTable));
  const freshness = await query<FreshnessRow>('select source_key, source_name, status, last_success_at, last_attempt_at, last_error, records_fetched, records_stored from data_source_freshness order by last_attempt_at desc').catch(() => []);
  const latestIngestion = freshness[0] ?? null;
  const staleProviders = freshness.filter((row) => row.status !== 'live' || !row.records_stored).map((row) => ({ provider: row.source_name, status: row.status, lastRun: row.last_attempt_at, error: row.last_error }));
  const emptyTables = tableCounts.filter((row) => row.count === 0).map((row) => row.table);
  const criticalEmpty = ['countries', 'source_references', 'data_source_freshness'].some((table) => emptyTables.includes(table));
  const fallbackRisk = criticalEmpty ? 'High - core persisted intelligence tables are empty.' : emptyTables.length ? 'Medium - some enrichment tables are empty; fallback remains active for those domains.' : 'Low - persisted data is available across monitored intelligence tables.';
  const recommendations = [
    criticalEmpty ? 'Run npm run bootstrap:countries to seed core provider data.' : null,
    emptyTables.includes('hotel_candidates') ? 'Enable OSM/Nominatim bootstrap and verify User-Agent/rate limits.' : null,
    emptyTables.includes('advisories') ? 'Verify FCDO/public advisory access and configured provider URLs.' : null,
    staleProviders.length ? 'Review staleProviders and provider diagnostics for failed sources.' : null,
    'Keep fallback enabled for providers that require keys or are temporarily unavailable.'
  ].filter(Boolean);

  return NextResponse.json({ tableCounts, latestIngestion, staleProviders, emptyTables, fallbackRisk, recommendations });
}
