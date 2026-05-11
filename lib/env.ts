export type EnvCheck = {
  key: string;
  label: string;
  requiredFor: string;
  configured: boolean;
  status: 'connected' | 'missing_key' | 'demo_fallback';
};

const PLACEHOLDER_VALUES = new Set(['replace-me', 'changeme', 'change-me', 'your-key-here', 'your_key_here', '']);

function isConfigured(value?: string) {
  const trimmed = value?.trim() ?? '';
  return Boolean(trimmed) && !PLACEHOLDER_VALUES.has(trimmed.toLowerCase());
}

const checks: Array<Omit<EnvCheck, 'configured' | 'status'>> = [
  { key: 'DATABASE_URL', label: 'Neon Postgres', requiredFor: 'Persistent trips, documents, reports, users, subscriptions, provider ingestion and admin actions' },
  { key: 'AUTH_SECRET', label: 'Auth secret', requiredFor: 'Production auth sessions' },
  { key: 'ADMIN_INGEST_SECRET', label: 'Admin ingest secret', requiredFor: 'Protected ingestion from cron/admin clients without demo headers' },
  { key: 'S3_ENDPOINT', label: 'S3/R2/MinIO endpoint', requiredFor: 'Document object storage' },
  { key: 'S3_REGION', label: 'S3/R2/MinIO region', requiredFor: 'Document object storage' },
  { key: 'S3_BUCKET', label: 'S3/R2/MinIO bucket', requiredFor: 'Document object storage' },
  { key: 'S3_ACCESS_KEY_ID', label: 'S3/R2/MinIO access key', requiredFor: 'Signed upload/download URLs' },
  { key: 'S3_SECRET_ACCESS_KEY', label: 'S3/R2/MinIO secret key', requiredFor: 'Signed upload/download URLs' },
  { key: 'STRIPE_PUBLIC_KEY', label: 'Stripe public key', requiredFor: 'Checkout' },
  { key: 'STRIPE_SECRET_KEY', label: 'Stripe secret key', requiredFor: 'Checkout and webhooks' },
  { key: 'AI_PROVIDER', label: 'AI provider', requiredFor: 'AI-assisted summaries, document extraction and report narrative' },
  { key: 'AI_MOCK_MODE', label: 'AI mock mode', requiredFor: 'Deterministic AI fallback testing' },
  { key: 'OLLAMA_BASE_URL', label: 'Ollama base URL', requiredFor: 'Local Ollama model serving' },
  { key: 'OLLAMA_TRAVEL_MODEL', label: 'Ollama travel model', requiredFor: 'Local Atlas travel report model' },
  { key: 'AI_MODEL', label: 'Default AI model', requiredFor: 'Default AI model fallback' },
  { key: 'AI_SCOUT_MODEL', label: 'AI scout model', requiredFor: 'Evidence triage and document/source scouting' },
  { key: 'AI_ANALYST_MODEL', label: 'AI analyst model', requiredFor: 'Country and city intelligence summaries' },
  { key: 'AI_REPORT_MODEL', label: 'AI report model', requiredFor: 'Final travel risk report writing' },
  { key: 'AI_ROUTE_MODEL', label: 'AI route model', requiredFor: 'Route and movement risk analysis' },
  { key: 'AI_HOTEL_MODEL', label: 'AI hotel model', requiredFor: 'Accommodation and site security analysis' },
  { key: 'AI_MATRIX_MODEL', label: 'AI risk matrix model', requiredFor: 'Structured risk matrix reasoning' },
  { key: 'OPENAI_API_KEY', label: 'OpenAI API key', requiredFor: 'OpenAI provider mode' },
  { key: 'AI_API_KEY', label: 'AI API key', requiredFor: 'Backwards-compatible OpenAI provider key' },
  { key: 'NEXT_PUBLIC_MAPBOX_TOKEN', label: 'Mapbox token', requiredFor: 'Optional geocoding/route mapping' },
  { key: 'OFFICIAL_PAGE_URLS', label: 'Official page URLs', requiredFor: 'Controlled extraction from official public pages' },
  { key: 'OSM_USER_AGENT', label: 'OSM User-Agent', requiredFor: 'Responsible Nominatim/OpenStreetMap requests' },
  { key: 'UK_FCDO_API_URL', label: 'UK FCDO', requiredFor: 'Official travel advisories' },
  { key: 'US_STATE_ADVISORY_API_URL', label: 'US State Department', requiredFor: 'Official travel advisories' },
  { key: 'CANADA_ADVISORY_API_URL', label: 'Canada advisories', requiredFor: 'Official travel advisories' },
  { key: 'AU_SMARTRAVELLER_API_URL', label: 'Australia Smartraveller', requiredFor: 'Official travel advisories' },
  { key: 'NZ_MFAT_ADVISORY_API_URL', label: 'New Zealand MFAT', requiredFor: 'Official travel advisories' },
  { key: 'GDELT_API_URL', label: 'GDELT/news', requiredFor: 'Live incident ingestion' },
  { key: 'NEWS_RSS_FEEDS', label: 'Public RSS/news feeds', requiredFor: 'Public travel intelligence feed ingestion' },
  { key: 'WEATHER_API_KEY', label: 'Weather/disaster provider', requiredFor: 'Weather and disaster feeds' },
  { key: 'DISASTER_FEED_URL', label: 'Disaster feed URL', requiredFor: 'GDACS or equivalent disaster feed ingestion' },
  { key: 'USGS_EARTHQUAKE_FEED_URL', label: 'USGS earthquake feed', requiredFor: 'Earthquake feed ingestion' },
  { key: 'HEALTH_OUTBREAK_FEED_URL', label: 'Health feeds', requiredFor: 'Health outbreak feeds' },
  { key: 'AVIATIONSTACK_API_KEY', label: 'Aviation disruption', requiredFor: 'Aviation/airport feeds' }
];

export function envChecks(): EnvCheck[] {
  return checks.map((check) => {
    const configured = isConfigured(process.env[check.key]);
    return {
      ...check,
      configured,
      status: configured ? 'connected' : 'demo_fallback'
    };
  });
}

export function groupedEnvStatus() {
  const items = envChecks();
  return {
    connected: items.filter((item) => item.configured).length,
    missing: items.filter((item) => !item.configured).length,
    items
  };
}
