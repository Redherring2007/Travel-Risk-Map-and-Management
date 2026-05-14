create table if not exists country_master_profiles (
  country_iso2 char(2) primary key references countries(iso2) on delete cascade,
  source text not null,
  fetched_at timestamptz not null default now(),
  confidence text not null default 'Medium',
  gdp_current_usd numeric,
  inflation_percent numeric,
  population_total numeric,
  life_expectancy_years numeric,
  internet_users_percent numeric,
  health_expenditure_percent_gdp numeric,
  government_structure text,
  timezone text,
  infrastructure_indicators jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists country_health_profiles (
  country_iso2 char(2) primary key references countries(iso2) on delete cascade,
  source text not null,
  fetched_at timestamptz not null default now(),
  confidence text not null default 'Medium',
  health_expenditure_percent_gdp numeric,
  life_expectancy_years numeric,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists country_security_profiles (
  country_iso2 char(2) primary key references countries(iso2) on delete cascade,
  source text not null,
  fetched_at timestamptz not null default now(),
  confidence text not null default 'Medium',
  government_structure text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists country_infrastructure_profiles (
  country_iso2 char(2) primary key references countries(iso2) on delete cascade,
  source text not null,
  fetched_at timestamptz not null default now(),
  confidence text not null default 'Medium',
  internet_users_percent numeric,
  infrastructure_indicators jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists location_pois (
  id uuid primary key default gen_random_uuid(),
  country_iso2 char(2) references countries(iso2) on delete cascade,
  city_name text,
  poi_type text not null,
  name text not null,
  latitude numeric(10,6),
  longitude numeric(10,6),
  address text,
  source text not null,
  source_url text,
  confidence text not null default 'Medium',
  fetched_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hotel_candidates (
  id uuid primary key default gen_random_uuid(),
  country_iso2 char(2) references countries(iso2) on delete cascade,
  city_name text,
  name text not null,
  latitude numeric(10,6),
  longitude numeric(10,6),
  address text,
  source text not null,
  source_url text,
  confidence text not null default 'Medium',
  fetched_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists official_page_extractions (
  id uuid primary key default gen_random_uuid(),
  country_iso2 char(2) references countries(iso2) on delete set null,
  source_url text not null,
  title text,
  extracted_text text,
  extraction_method text not null default 'controlled-public-page-fetch',
  confidence text not null default 'Medium',
  fetched_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table risk_events add column if not exists relevance_score integer;
alter table risk_events add column if not exists source_trust numeric;
alter table risk_events add column if not exists geo_confidence numeric;
alter table risk_events add column if not exists freshness_weight numeric;
alter table risk_events add column if not exists operational_impact numeric;

create unique index if not exists idx_location_pois_dedupe on location_pois (country_iso2, poi_type, lower(name), coalesce(latitude, 0), coalesce(longitude, 0));
create unique index if not exists idx_hotel_candidates_dedupe on hotel_candidates (country_iso2, lower(name), coalesce(latitude, 0), coalesce(longitude, 0));
create unique index if not exists idx_official_page_extractions_dedupe on official_page_extractions (source_url, coalesce(country_iso2, ''));
create index if not exists idx_risk_events_relevance on risk_events(country_iso2, relevance_score desc);
