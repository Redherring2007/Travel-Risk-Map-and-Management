import { NextResponse } from 'next/server';
import { requireIngestionAccess } from '@/lib/admin-protection';
import { isNeonConfigured, query } from '@/lib/neon';
import { providerStatusReport } from '@/lib/provider-status';

type FreshnessRow = { source_key: string; source_name: string; status: string; last_success_at: string | null; last_attempt_at: string | null; last_error: string | null; records_fetched: number; records_stored: number };

export async function GET(request: Request) {
  const access = requireIngestionAccess(request);
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
  const report = providerStatusReport();
  const freshness = isNeonConfigured()
    ? await query<FreshnessRow>('select source_key, source_name, status, last_success_at, last_attempt_at, last_error, records_fetched, records_stored from data_source_freshness order by source_name').catch(() => [])
    : [];
  const rows = report.providers.map((provider) => {
    const key = provider.key ?? provider.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const fresh = freshness.find((item) => item.source_key === key || item.source_name.toLowerCase() === provider.name.toLowerCase());
    const attempts = fresh ? Math.max(1, Number(fresh.records_fetched || 0)) : 0;
    const stored = fresh ? Number(fresh.records_stored || 0) : 0;
    return {
      provider: provider.name,
      enabled: true,
      configured: provider.status === 'Live provider active' || provider.status === 'Public data active',
      lastRun: fresh?.last_attempt_at ?? null,
      successRate: attempts ? stored / attempts : fresh?.status === 'live' ? 1 : 0,
      freshness: fresh ? { status: fresh.status, lastSuccessAt: fresh.last_success_at, recordsFetched: fresh.records_fetched, recordsStored: fresh.records_stored } : null,
      fallbackMode: !fresh || fresh.status !== 'live' || stored === 0,
      errors: [provider.notes, fresh?.last_error].filter(Boolean)
    };
  });
  return NextResponse.json({ providers: rows });
}
