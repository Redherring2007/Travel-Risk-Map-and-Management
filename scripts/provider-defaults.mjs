export const PUBLIC_PROVIDER_DEFAULTS = [
  {
    key: 'UK_FCDO_API_URL',
    value: 'https://www.gov.uk/api/search.json?filter_format=travel_advice&count=100',
    class: 'free/public/official',
    note: 'GOV.UK Content API search for travel advice content.'
  },
  {
    key: 'AU_SMARTRAVELLER_API_URL',
    value: 'https://www.smartraveller.gov.au/rss',
    class: 'free/public/official',
    note: 'Smartraveller public RSS feed.'
  },
  {
    key: 'DISASTER_FEED_URL',
    value: 'https://www.gdacs.org/xml/rss.xml',
    class: 'free/public/official',
    note: 'GDACS public disaster alert RSS.'
  },
  {
    key: 'USGS_EARTHQUAKE_FEED_URL',
    value: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson',
    class: 'free/public/official',
    note: 'USGS significant earthquakes GeoJSON.'
  },
  {
    key: 'HEALTH_OUTBREAK_FEED_URL',
    value: 'https://wwwnc.cdc.gov/travel/rss/notices.xml',
    class: 'free/public/official',
    note: 'CDC travel health notices feed.'
  },
  {
    key: 'GDELT_API_URL',
    value: 'https://api.gdeltproject.org/api/v2/doc/doc?query=travel%20OR%20protest%20OR%20airport%20OR%20security&mode=ArtList&format=json&maxrecords=50&sort=HybridRel',
    class: 'free/public/API',
    note: 'GDELT public document API. Can be rate-limited; treat as noisy discovery only.'
  },
  {
    key: 'NEWS_RSS_FEEDS',
    value: 'https://www.smartraveller.gov.au/rss,https://www.gdacs.org/xml/rss.xml,https://wwwnc.cdc.gov/travel/rss/notices.xml',
    class: 'free/public curated RSS',
    note: 'Starter curated public feeds. Add destination-specific official feeds later.'
  }
];

export const MANUAL_PROVIDER_GUIDANCE = [
  {
    key: 'US_STATE_ADVISORY_API_URL',
    reason: 'Current adapter expects JSON. Configure an approved JSON endpoint or extend adapter for official-page/RSS extraction.'
  },
  {
    key: 'CANADA_ADVISORY_API_URL',
    reason: 'Current adapter expects JSON. Configure an approved Canada open-data endpoint or extend adapter for official-page extraction.'
  },
  {
    key: 'NZ_MFAT_ADVISORY_API_URL',
    reason: 'Configure a supported MFAT RSS/API/official-page extraction endpoint after validating format and terms.'
  },
  {
    key: 'NEXT_PUBLIC_MAPBOX_TOKEN',
    reason: 'Optional key for production-grade geocoding/map services.'
  },
  {
    key: 'AVIATIONSTACK_API_KEY',
    reason: 'Paid/optional aviation disruption provider. Choose a provider and map to itinerary airports before scoring.'
  },
  {
    key: 'WEATHER_API_KEY',
    reason: 'Optional weather alert provider key if GDACS/USGS are insufficient for destination weather coverage.'
  },
  {
    key: 'OFFICIAL_PAGE_URLS',
    reason: 'Manual official-page extraction list for embassies, consular pages, sanctions or local authority pages.'
  }
];
