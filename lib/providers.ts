export type ProviderStatus = 'not_configured' | 'demo' | 'ready';

export type ProviderDescriptor = {
  key: string;
  name: string;
  category: string;
  envVars: string[];
  status: ProviderStatus;
  notes: string;
};

function statusFor(required: string[]): ProviderStatus {
  if (required.length === 0) return 'demo';
  return required.every((key) => Boolean(process.env[key])) ? 'ready' : 'not_configured';
}

export const providers: ProviderDescriptor[] = [
  { key: 'rest-countries', name: 'REST Countries', category: 'country_baseline', envVars: [], status: 'demo', notes: 'Used for baseline fields when connected through provider jobs.' },
  { key: 'world-bank', name: 'World Bank / UN indicators', category: 'country_baseline', envVars: [], status: 'demo', notes: 'Adapter-ready for economic and population indicators.' },
  { key: 'cia-factbook', name: 'CIA World Factbook style data', category: 'country_baseline', envVars: ['CIA_FACTBOOK_SOURCE_URL'], status: statusFor(['CIA_FACTBOOK_SOURCE_URL']), notes: 'Configure source URL or internal ingestion job.' },
  { key: 'uk-fcdo', name: 'UK FCDO Travel Advice', category: 'travel_advice', envVars: ['UK_FCDO_API_URL'], status: statusFor(['UK_FCDO_API_URL']), notes: 'Connect advisory feed or scraper endpoint.' },
  { key: 'us-state', name: 'US State Department Advisories', category: 'travel_advice', envVars: ['US_STATE_ADVISORY_API_URL'], status: statusFor(['US_STATE_ADVISORY_API_URL']), notes: 'Connect official advisory source.' },
  { key: 'canada-advisories', name: 'Canada Travel Advisories', category: 'travel_advice', envVars: ['CANADA_ADVISORY_API_URL'], status: statusFor(['CANADA_ADVISORY_API_URL']), notes: 'Connect official advisory source.' },
  { key: 'smartraveller', name: 'Australia Smartraveller', category: 'travel_advice', envVars: ['AU_SMARTRAVELLER_API_URL'], status: statusFor(['AU_SMARTRAVELLER_API_URL']), notes: 'Connect official advisory source.' },
  { key: 'gdelt', name: 'GDELT', category: 'live_incidents', envVars: ['GDELT_API_URL'], status: statusFor(['GDELT_API_URL']), notes: 'Used for live event discovery and classifier queue.' },
  { key: 'rss-news', name: 'RSS / News feeds', category: 'live_incidents', envVars: ['NEWS_RSS_FEEDS'], status: statusFor(['NEWS_RSS_FEEDS']), notes: 'Comma-separated feed list for incident ingestion.' },
  { key: 'weather-disaster', name: 'Weather and disaster feeds', category: 'live_incidents', envVars: ['WEATHER_API_KEY', 'DISASTER_FEED_URL'], status: statusFor(['WEATHER_API_KEY', 'DISASTER_FEED_URL']), notes: 'Connect severe weather and natural hazard provider.' },
  { key: 'health-outbreaks', name: 'Health outbreak feeds', category: 'live_incidents', envVars: ['HEALTH_OUTBREAK_FEED_URL'], status: statusFor(['HEALTH_OUTBREAK_FEED_URL']), notes: 'Connect WHO/CDC/local outbreak feed.' },
  { key: 'aviation', name: 'Aviation and travel disruption', category: 'live_incidents', envVars: ['AVIATIONSTACK_API_KEY'], status: statusFor(['AVIATIONSTACK_API_KEY']), notes: 'Connect airport, strike, and route disruption sources.' },
  { key: 'mapbox', name: 'Mapbox / geocoding', category: 'mapping', envVars: ['NEXT_PUBLIC_MAPBOX_TOKEN'], status: statusFor(['NEXT_PUBLIC_MAPBOX_TOKEN']), notes: 'Optional for production geocoding and future route mapping.' },
  { key: 'neon', name: 'Neon Postgres', category: 'database', envVars: ['DATABASE_URL'], status: statusFor(['DATABASE_URL']), notes: 'Primary production database for users, subscriptions, intelligence records, trips, reports, and document metadata.' },
  { key: 'object-storage', name: 'S3-compatible document storage', category: 'storage', envVars: ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'], status: statusFor(['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']), notes: 'Production storage for passport, visa, ticket, insurance, medical, and emergency contact files. Neon stores metadata only.' },
  { key: 'stripe', name: 'Stripe subscriptions', category: 'payments', envVars: ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_PRO'], status: statusFor(['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_PRO']), notes: 'Production subscription billing and webhook reconciliation.' }
];
