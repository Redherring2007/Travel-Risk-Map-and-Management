export type EnvCheck = {
  key: string;
  label: string;
  requiredFor: string;
  configured: boolean;
  status: 'connected' | 'missing_key' | 'demo_fallback';
};

const checks: Array<Omit<EnvCheck, 'configured' | 'status'>> = [
  { key: 'DATABASE_URL', label: 'Neon Postgres', requiredFor: 'Persistent trips, documents, reports, users, subscriptions, admin actions' },
  { key: 'AUTH_SECRET', label: 'Auth secret', requiredFor: 'Production auth sessions' },
  { key: 'S3_ENDPOINT', label: 'S3/R2/MinIO endpoint', requiredFor: 'Document object storage' },
  { key: 'S3_REGION', label: 'S3/R2/MinIO region', requiredFor: 'Document object storage' },
  { key: 'S3_BUCKET', label: 'S3/R2/MinIO bucket', requiredFor: 'Document object storage' },
  { key: 'S3_ACCESS_KEY_ID', label: 'S3/R2/MinIO access key', requiredFor: 'Signed upload/download URLs' },
  { key: 'S3_SECRET_ACCESS_KEY', label: 'S3/R2/MinIO secret key', requiredFor: 'Signed upload/download URLs' },
  { key: 'STRIPE_PUBLIC_KEY', label: 'Stripe public key', requiredFor: 'Checkout' },
  { key: 'STRIPE_SECRET_KEY', label: 'Stripe secret key', requiredFor: 'Checkout and webhooks' },
  { key: 'NEXT_PUBLIC_MAPBOX_TOKEN', label: 'Mapbox token', requiredFor: 'Optional geocoding/route mapping' },
  { key: 'UK_FCDO_API_URL', label: 'UK FCDO', requiredFor: 'Official travel advisories' },
  { key: 'US_STATE_ADVISORY_API_URL', label: 'US State Department', requiredFor: 'Official travel advisories' },
  { key: 'CANADA_ADVISORY_API_URL', label: 'Canada advisories', requiredFor: 'Official travel advisories' },
  { key: 'AU_SMARTRAVELLER_API_URL', label: 'Australia Smartraveller', requiredFor: 'Official travel advisories' },
  { key: 'GDELT_API_URL', label: 'GDELT/news', requiredFor: 'Live incident ingestion' },
  { key: 'WEATHER_API_KEY', label: 'Weather/disaster provider', requiredFor: 'Weather and disaster feeds' },
  { key: 'HEALTH_OUTBREAK_FEED_URL', label: 'Health feeds', requiredFor: 'Health outbreak feeds' },
  { key: 'AVIATIONSTACK_API_KEY', label: 'Aviation disruption', requiredFor: 'Aviation/airport feeds' }
];

export function envChecks(): EnvCheck[] {
  return checks.map((check) => {
    const configured = Boolean(process.env[check.key]);
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
