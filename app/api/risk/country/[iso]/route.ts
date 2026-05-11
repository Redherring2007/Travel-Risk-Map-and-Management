import { NextResponse } from 'next/server';
import { mergeCountryProfile } from '@/lib/country-profile-merge';
import { findCountry } from '@/lib/data';
import { loadPersistedCountry, sourceTransparency } from '@/lib/source-data';

export async function GET(_request: Request, { params }: { params: Promise<{ iso: string }> }) {
  const { iso } = await params;
  const persisted = await loadPersistedCountry(iso);
  const country = persisted ?? findCountry(iso);
  if (!country) return NextResponse.json({ error: 'Country not found' }, { status: 404 });
  const [mergedProfile, transparency] = await Promise.all([mergeCountryProfile(country.iso2), sourceTransparency(persisted ? 'neon-persisted' : 'fallback-demo', !persisted, country.iso2)]);
  return NextResponse.json({ data: country.risk, mergedProfile, sourcePolicy: persisted ? 'Persisted Neon scores where available; fallback risk model fills gaps.' : 'Demo scores; provider-backed scores replace these records when ingestion is configured.', ...transparency });
}
