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
  infrastructure_indicators jsonb not null default '{}'::jsonb,
  government_structure text,
  timezone text,
  raw_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists country_health_profiles (
  country_iso2 char(2) primary key references countries(iso2) on delete cascade,
  source text not null,
  fetched_at timestamptz not null default now(),
  confidence text not null default 'Medium',
  health_expenditure_percent_gdp numeric,
  life_expectancy_years numeric,
  emergency_numbers jsonb not null default '[]'::jsonb,
  major_hospitals jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists country_security_profiles (
  country_iso2 char(2) primary key references countries(iso2) on delete cascade,
  source text not null,
  fetched_at timestamptz not null default now(),
  confidence text not null default 'Medium',
  government_structure text,
  emergency_numbers jsonb not null default '[]'::jsonb,
  embassies jsonb not null default '[]'::jsonb,
  police_locations jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists country_infrastructure_profiles (
  country_iso2 char(2) primary key references countries(iso2) on delete cascade,
  source text not null,
  fetched_at timestamptz not null default now(),
  confidence text not null default 'Medium',
  internet_users_percent numeric,
  airports jsonb not null default '[]'::jsonb,
  transport_hubs jsonb not null default '[]'::jsonb,
  infrastructure_indicators jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table city_profiles add column if not exists source text;
alter table city_profiles add column if not exists fetched_at timestamptz;
alter table city_profiles add column if not exists confidence text not null default 'Medium';
alter table city_profiles add column if not exists infrastructure jsonb not null default '{}'::jsonb;
alter table city_profiles add column if not exists raw_payload jsonb not null default '{}'::jsonb;

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
  raw_payload jsonb not null default '{}'::jsonb
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
  raw_payload jsonb not null default '{}'::jsonb
);

create table if not exists hotel_safety_scores (
  id uuid primary key default gen_random_uuid(),
  hotel_candidate_id uuid references hotel_candidates(id) on delete cascade,
  country_iso2 char(2) references countries(iso2) on delete cascade,
  score integer check (score between 0 and 100),
  level text check (level in ('Low', 'Moderate', 'High', 'Critical')),
  rationale text,
  source text not null,
  confidence text not null default 'Low',
  generated_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb
);

create table if not exists official_page_extractions (
  id uuid primary key default gen_random_uuid(),
  country_iso2 char(2),
  source_url text not null,
  title text,
  extracted_text text not null,
  extraction_method text not null default 'controlled-public-page-fetch',
  confidence text not null default 'Medium',
  fetched_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  unique(source_url, coalesce(country_iso2, ''))
);

create index if not exists idx_location_pois_country_type on location_pois(country_iso2, poi_type);
create index if not exists idx_hotel_candidates_country_city on hotel_candidates(country_iso2, city_name);
create index if not exists idx_official_page_extractions_country on official_page_extractions(country_iso2, fetched_at desc);
