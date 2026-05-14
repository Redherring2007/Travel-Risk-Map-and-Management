import { countries } from './data';
import { isNeonConfigured, query } from './neon';
import { generateProviderCoverageAudit, type ConfidenceCategory } from './provider-coverage-audit';

export type ValidationStatus = 'pending_review' | 'approved' | 'rejected' | 'manual_review_required' | 'not_required';
export type HotelValidationStatus = 'verified' | 'public_map_candidate' | 'manually_validated' | 'insufficient_confidence' | 'rejected';
export type RouteValidationStatus = 'not_reviewed' | 'analyst_approved' | 'analyst_modified' | 'rejected' | 'requires_more_data';
export type SourceApprovalStatus = 'unreviewed' | 'approved_source' | 'approved_with_caution' | 'rejected_source' | 'stale_source';
export type EvidenceApprovalStatus = 'unreviewed' | 'accepted' | 'accepted_with_limitations' | 'rejected' | 'needs_corroboration';

export type AnalystValidationRecord = {
  id: string;
  entityType: 'country' | 'hotel' | 'route' | 'source' | 'evidence';
  entityId: string;
  status: ValidationStatus | HotelValidationStatus | RouteValidationStatus | SourceApprovalStatus | EvidenceApprovalStatus;
  analystNotes?: string;
  confidenceOverride?: ConfidenceCategory;
  confidenceOverrideRationale?: string;
  updatedAt: string;
};

export type ValidationQueueItem = {
  id: string;
  type: 'low_confidence_country' | 'hotel_candidate' | 'route_assessment' | 'fallback_or_stale_source';
  title: string;
  status: ValidationStatus | HotelValidationStatus | RouteValidationStatus | SourceApprovalStatus;
  priority: 'High' | 'Medium' | 'Low';
  reason: string;
  recommendedAction: string;
  source?: string;
  confidence?: ConfidenceCategory;
  metadata?: Record<string, unknown>;
};

export type ValidationSubmission = {
  entityType: AnalystValidationRecord['entityType'];
  entityId: string;
  status: AnalystValidationRecord['status'];
  analystNotes?: string;
  confidenceOverride?: ConfidenceCategory;
  confidenceOverrideRationale?: string;
};

function now() {
  return new Date().toISOString();
}

async function hotelCandidates(): Promise<ValidationQueueItem[]> {
  if (!isNeonConfigured()) return [];
  const rows = await query<{ id: string; name: string | null; country_iso2: string | null; city_name: string | null; source: string | null; confidence: string | null }>(
    `select id::text, name, country_iso2, city_name, source, confidence from hotel_candidates order by updated_at desc nulls last, created_at desc nulls last limit 25`
  ).catch(() => []);
  return rows.map((row) => ({
    id: `hotel-${row.id}`,
    type: 'hotel_candidate',
    title: row.name || 'Unnamed public-map hotel candidate',
    status: 'public_map_candidate',
    priority: 'Medium',
    reason: 'Public-map hotel candidates are not verified recommendations.',
    recommendedAction: 'Analyst should verify address, area risk, security suitability and business-travel appropriateness before endorsement.',
    source: row.source ?? 'Public map source',
    metadata: { countryIso2: row.country_iso2, city: row.city_name, confidence: row.confidence }
  }));
}

async function routeAssessments(): Promise<ValidationQueueItem[]> {
  if (!isNeonConfigured()) return [];
  const rows = await query<{ id: string; trip_id: string; segment_name: string | null; score: number | null; level: string | null }>(
    `select id::text, trip_id::text, segment_name, score, level from route_risk_segments order by created_at desc limit 25`
  ).catch(() => []);
  return rows.filter((row) => Number(row.score ?? 0) >= 50).map((row) => ({
    id: `route-${row.id}`,
    type: 'route_assessment',
    title: row.segment_name || 'Route segment requiring review',
    status: 'not_reviewed',
    priority: Number(row.score ?? 0) >= 75 ? 'High' : 'Medium',
    reason: `Route segment is assessed as ${row.level ?? 'elevated'} (${row.score ?? 'unscored'}).`,
    recommendedAction: 'Analyst should validate route, timing, control recommendations and whether secure transport is required.',
    metadata: { tripId: row.trip_id, score: row.score, level: row.level }
  }));
}

export async function buildValidationQueue(): Promise<ValidationQueueItem[]> {
  const audit = await generateProviderCoverageAudit();
  const lowConfidenceCountries: ValidationQueueItem[] = audit.countryCoverage
    .filter((country) => ['Low confidence', 'Manual review required'].includes(country.category) || country.capped)
    .slice(0, 25)
    .map((country) => ({
      id: `country-${country.iso2}`,
      type: 'low_confidence_country',
      title: `${country.country} (${country.iso2})`,
      status: 'pending_review',
      priority: country.category === 'Manual review required' ? 'High' : 'Medium',
      reason: country.gaps.join(' '),
      recommendedAction: 'Analyst should review official advisory coverage, event relevance and source freshness before client reliance.',
      confidence: country.category,
      metadata: { score: country.score, advisories: country.advisories, events: country.events, highConfidenceEvents: country.highConfidenceEvents }
    }));

  const staleSources: ValidationQueueItem[] = audit.staleSources.slice(0, 25).map((source) => ({
    id: `source-${source.provider.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    type: 'fallback_or_stale_source',
    title: source.provider,
    status: 'stale_source',
    priority: 'High',
    reason: source.reason,
    recommendedAction: 'Refresh source, verify endpoint configuration, or mark source as unavailable with rationale.',
    source: source.provider,
    metadata: { lastRun: source.lastRun }
  }));

  const fallbackSources: ValidationQueueItem[] = audit.fallbackUsage.slice(0, 25).map((source) => ({
    id: `fallback-${source.provider.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    type: 'fallback_or_stale_source',
    title: source.provider,
    status: 'unreviewed',
    priority: 'Medium',
    reason: source.reason,
    recommendedAction: 'Configure live source or document fallback limitation before operational use.',
    source: source.provider
  }));

  return [...lowConfidenceCountries, ...(await hotelCandidates()), ...(await routeAssessments()), ...staleSources, ...fallbackSources];
}

export function buildValidationRecord(input: ValidationSubmission): AnalystValidationRecord {
  return {
    id: `${input.entityType}-${input.entityId}-${Date.now()}`,
    entityType: input.entityType,
    entityId: input.entityId,
    status: input.status,
    analystNotes: input.analystNotes,
    confidenceOverride: input.confidenceOverride,
    confidenceOverrideRationale: input.confidenceOverrideRationale,
    updatedAt: now()
  };
}

export function validationArchitecture() {
  return {
    statuses: {
      hotelValidation: ['verified', 'public_map_candidate', 'manually_validated', 'insufficient_confidence', 'rejected'],
      routeValidation: ['not_reviewed', 'analyst_approved', 'analyst_modified', 'rejected', 'requires_more_data'],
      sourceApproval: ['unreviewed', 'approved_source', 'approved_with_caution', 'rejected_source', 'stale_source'],
      evidenceApproval: ['unreviewed', 'accepted', 'accepted_with_limitations', 'rejected', 'needs_corroboration']
    },
    futurePersistence: ['analyst_validation_records', 'evidence_approvals', 'hotel_validation_reviews', 'route_validation_reviews', 'source_confidence_overrides'],
    note: 'This module is scaffolding only. It does not persist validation records until a future migration is added.'
  };
}

export function fallbackValidationCountries(): ValidationQueueItem[] {
  return countries.slice(0, 5).map((country) => ({
    id: `country-${country.iso2}`,
    type: 'low_confidence_country',
    title: `${country.name} (${country.iso2})`,
    status: 'pending_review',
    priority: 'Medium',
    reason: 'Persistent source coverage is not available; demo baseline cannot support production confidence.',
    recommendedAction: 'Run ingestion, configure official sources and complete analyst validation before operational reliance.',
    confidence: 'Manual review required'
  }));
}
