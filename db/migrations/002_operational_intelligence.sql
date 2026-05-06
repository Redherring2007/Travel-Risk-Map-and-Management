create table if not exists data_source_freshness (
  source_key text primary key,
  source_name text not null,
  status text not null default 'not_configured',
  last_success_at timestamptz,
  last_attempt_at timestamptz not null default now(),
  last_error text,
  records_fetched integer not null default 0,
  records_stored integer not null default 0,
  freshness_minutes integer,
  required_for_risk boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists trip_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  overall_score integer not null check (overall_score between 0 and 100),
  overall_level text not null check (overall_level in ('Low', 'Moderate', 'High', 'Critical')),
  confidence text not null check (confidence in ('Low', 'Medium', 'High')),
  key_drivers jsonb not null default '[]'::jsonb,
  itinerary_risks jsonb not null default '{}'::jsonb,
  route_risks jsonb not null default '[]'::jsonb,
  missing_data jsonb not null default '[]'::jsonb,
  source_summary jsonb not null default '[]'::jsonb,
  freshness jsonb not null default '{}'::jsonb,
  generated_by text not null default 'rules_engine',
  created_at timestamptz not null default now()
);

create table if not exists route_risk_segments (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references trip_risk_assessments(id) on delete cascade,
  trip_id uuid not null references trips(id) on delete cascade,
  sequence integer not null default 1,
  segment_name text not null,
  from_location text,
  to_location text,
  score integer not null check (score between 0 and 100),
  level text not null check (level in ('Low', 'Moderate', 'High', 'Critical')),
  drivers jsonb not null default '[]'::jsonb,
  mitigation text,
  created_at timestamptz not null default now()
);

create table if not exists ai_report_runs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  report_id uuid references trip_reports(id) on delete set null,
  provider text,
  model text,
  prompt_version text not null default 'atlas-risk-report-v1',
  grounded_source_count integer not null default 0,
  status text not null default 'fallback',
  error text,
  created_at timestamptz not null default now()
);

create table if not exists source_references (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  source_name text not null,
  source_type text not null,
  title text not null,
  url text,
  country_iso2 char(2),
  city_name text,
  confidence text not null default 'Medium',
  source_status text not null default 'demo',
  published_at timestamptz,
  ingested_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb
);

alter table countries add column if not exists area text;
alter table countries add column if not exists gdp text;
alter table countries add column if not exists country_image_url text;
alter table countries add column if not exists country_visual_prompt text;

alter table advisories add column if not exists source_url text;
alter table advisories add column if not exists severity text;
alter table advisories add column if not exists summary text;
alter table advisories add column if not exists issued_at timestamptz;
alter table advisories add column if not exists status text not null default 'demo';
alter table advisories add column if not exists confidence text not null default 'Medium';
alter table advisories add column if not exists raw_payload jsonb not null default '{}'::jsonb;

alter table risk_events add column if not exists city_name text;
alter table risk_events add column if not exists event_time timestamptz;
alter table risk_events add column if not exists confidence text not null default 'Medium';

create index if not exists idx_data_source_freshness_status on data_source_freshness(status);
create index if not exists idx_trip_risk_assessments_trip on trip_risk_assessments(trip_id, created_at desc);
create index if not exists idx_route_risk_segments_trip on route_risk_segments(trip_id);
create index if not exists idx_ai_report_runs_trip on ai_report_runs(trip_id, created_at desc);
create index if not exists idx_source_references_country on source_references(country_iso2, source_type);
create unique index if not exists idx_source_references_dedupe on source_references (source_key, title, coalesce(country_iso2, ''), coalesce(city_name, ''));
