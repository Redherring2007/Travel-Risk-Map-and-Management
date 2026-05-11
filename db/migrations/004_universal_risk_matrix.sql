create table if not exists risk_matrix_assessments (
  id uuid primary key default gen_random_uuid(),
  industry text not null,
  activity text,
  location text,
  context text,
  overall_residual_score numeric,
  highest_residual_level text,
  summary jsonb not null default '{}'::jsonb,
  source_evidence jsonb not null default '[]'::jsonb,
  confidence text not null default 'Medium',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists risk_matrix_items (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references risk_matrix_assessments(id) on delete cascade,
  industry text not null,
  hazard text not null,
  threat text,
  vulnerability text,
  affected_assets jsonb not null default '[]'::jsonb,
  persons_at_risk jsonb not null default '[]'::jsonb,
  likelihood integer not null check (likelihood between 1 and 5),
  impact integer not null check (impact between 1 and 5),
  exposure integer not null default 3 check (exposure between 1 and 5),
  existing_controls jsonb not null default '[]'::jsonb,
  inherent_score integer not null,
  inherent_level text not null,
  residual_likelihood integer not null check (residual_likelihood between 1 and 5),
  residual_impact integer not null check (residual_impact between 1 and 5),
  residual_score integer not null,
  residual_level text not null,
  recommended_controls jsonb not null default '[]'::jsonb,
  control_owner text,
  review_date date,
  legal_compliance_notes text,
  source_evidence jsonb not null default '[]'::jsonb,
  confidence text not null default 'Medium',
  assumptions jsonb not null default '[]'::jsonb,
  intelligence_gaps jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists risk_matrix_templates (
  id uuid primary key default gen_random_uuid(),
  industry text not null,
  hazard text not null,
  common_controls jsonb not null default '[]'::jsonb,
  legal_compliance_notes text,
  source text not null default 'Atlas Insight default template',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (industry, hazard)
);

create index if not exists idx_risk_matrix_assessments_industry on risk_matrix_assessments(industry);
create index if not exists idx_risk_matrix_items_assessment on risk_matrix_items(assessment_id);
create index if not exists idx_risk_matrix_items_residual_level on risk_matrix_items(residual_level);
create index if not exists idx_risk_matrix_templates_industry on risk_matrix_templates(industry);
