create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  role text not null default 'free' check (role in ('free', 'client', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  status text not null default 'free',
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists countries (
  iso2 char(2) primary key,
  iso3 char(3) unique not null,
  name text not null,
  capital text,
  region text,
  population text,
  government_type text,
  languages text[] default '{}',
  currency text,
  time_zones text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cities (
  id uuid primary key default gen_random_uuid(),
  country_iso2 char(2) not null references countries(iso2) on delete cascade,
  name text not null,
  latitude numeric(10,6),
  longitude numeric(10,6),
  geocode_source text,
  unique(country_iso2, name)
);

create table if not exists country_profiles (
  country_iso2 char(2) primary key references countries(iso2) on delete cascade,
  entry_visa_notes text,
  security_overview text,
  crime_overview text,
  terrorism_conflict_overview text,
  kidnap_extortion_risk text,
  political_stability text,
  protest_civil_unrest_risk text,
  health_risks text,
  hygiene_water_food_safety text,
  medical_capability text,
  emergency_services_capability text,
  natural_hazards text,
  transport_infrastructure_risk text,
  airport_travel_disruption_risk text,
  local_laws_culture text,
  areas_to_avoid text[] default '{}',
  recommendation text,
  verified_data_status text,
  updated_at timestamptz not null default now()
);

create table if not exists city_profiles (
  city_id uuid primary key references cities(id) on delete cascade,
  overview text,
  limited_data boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists risk_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text unique not null,
  source_name text not null,
  source_type text not null,
  status text not null default 'not_configured',
  last_success_at timestamptz,
  last_error text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists country_risk_scores (
  id uuid primary key default gen_random_uuid(),
  country_iso2 char(2) not null references countries(iso2) on delete cascade,
  category text not null,
  value integer not null check (value between 0 and 100),
  level text not null check (level in ('Low', 'Moderate', 'High', 'Critical')),
  meaning text not null,
  confidence text not null check (confidence in ('Low', 'Medium', 'High')),
  source_status text not null default 'demo',
  sources text[] not null default '{}',
  last_updated timestamptz not null default now(),
  unique(country_iso2, category)
);

create table if not exists city_risk_scores (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references cities(id) on delete cascade,
  category text not null,
  value integer not null check (value between 0 and 100),
  level text not null check (level in ('Low', 'Moderate', 'High', 'Critical')),
  meaning text not null,
  confidence text not null check (confidence in ('Low', 'Medium', 'High')),
  source_status text not null default 'demo',
  sources text[] not null default '{}',
  last_updated timestamptz not null default now(),
  unique(city_id, category)
);

create table if not exists advisories (
  id uuid primary key default gen_random_uuid(),
  country_iso2 char(2) references countries(iso2),
  source text not null,
  level text,
  title text not null,
  body text not null,
  url text,
  published_at timestamptz,
  ingested_at timestamptz not null default now()
);

create table if not exists risk_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  country_iso2 char(2) references countries(iso2),
  city_id uuid references cities(id),
  category text not null,
  severity text not null check (severity in ('Low', 'Moderate', 'High', 'Critical')),
  source text not null,
  occurred_at timestamptz not null default now(),
  summary text not null,
  recommended_action text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists admin_overrides (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references users(id),
  target_type text not null,
  target_id text not null,
  field_name text not null,
  previous_value jsonb,
  new_value jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists admin_approvals (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references users(id),
  target_type text not null,
  target_id text not null,
  decision text not null check (decision in ('approved', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  purpose text,
  accommodation text,
  flight_details text,
  internal_movements text,
  meetings_events text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trip_locations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  country_iso2 char(2) references countries(iso2),
  city_id uuid references cities(id),
  city_name text,
  arrival_date date,
  departure_date date,
  sequence integer not null default 1
);

create table if not exists traveller_profiles (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  nationality text,
  gender text,
  travel_style text,
  high_profile boolean not null default false,
  medical_considerations text,
  risk_tolerance text,
  travel_purpose text,
  children_travelling boolean not null default false,
  hostile_environment_support boolean not null default false
);

create table if not exists trip_documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid references users(id),
  document_type text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  storage_provider text not null default 's3',
  storage_bucket text,
  storage_key text not null,
  checksum text,
  audit_status text not null default 'active',
  uploaded_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists trip_reports (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  title text not null,
  recommendation text not null,
  markdown text not null,
  generated_by text not null default 'rules_engine',
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cities_country on cities(country_iso2);
create index if not exists idx_events_country_severity on risk_events(country_iso2, severity);
create index if not exists idx_trips_user on trips(user_id);
create index if not exists idx_trip_documents_trip on trip_documents(trip_id);
create index if not exists idx_advisories_country on advisories(country_iso2);
