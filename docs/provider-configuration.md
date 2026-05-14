# Atlas Insight Provider Configuration Guide

This guide lists free, public, official and optional paid data sources that can improve Atlas Insight confidence. Do not treat any source as operationally authoritative until licensing, reliability, freshness and analyst validation rules are confirmed.

All local configuration belongs in:

```bash
.env.local
```

Start with the safe public defaults:

```bash
npm run providers:defaults
npm run providers:check
```

After your database and protected ingestion secret are configured, run the country bootstrap workflow when available:

```bash
npm run bootstrap:countries
```

This repository currently ships provider-default helpers only; if `bootstrap:countries` is not listed in `package.json`, use the protected ingestion endpoint or add the bootstrap script before running that command.

## Source classes

- **Free/public**: no paid licence expected, but rate limits and terms still apply.
- **API required**: endpoint or key/configuration required in `.env.local`.
- **Manual/official page extraction**: controlled extraction from official public pages only; avoid aggressive scraping.
- **Paid optional**: commercial provider may be required for production-grade SLA, coverage or licensing.

## Official travel advisories

| Domain | Source | Class | Configuration | Notes |
| --- | --- | --- | --- | --- |
| UK travel advice | GOV.UK Content API travel-advice search | Free/public, no key | `UK_FCDO_API_URL=https://www.gov.uk/api/search.json?filter_format=travel_advice&count=100` | Auto-defaulted. Official source. Destination parsing still needs validation before scoring. |
| US travel advisories | US Department of State travel advisories | Free/public, adapter extension/manual endpoint required | `US_STATE_ADVISORY_API_URL` | Current adapter expects JSON. Configure an approved JSON endpoint or extend official-page extraction; do not default to HTML as if structured. |
| Canada travel advice | Government of Canada Travel Advice and Advisories | Free/public, adapter extension/manual endpoint required | `CANADA_ADVISORY_API_URL` | Current adapter expects JSON. Configure an approved Canada open-data endpoint or extend official-page extraction. |
| Australia travel advice | Smartraveller public RSS | Free/public, no key | `AU_SMARTRAVELLER_API_URL=https://www.smartraveller.gov.au/rss` | Auto-defaulted. Official source. Validate destination matching before scoring. |
| New Zealand travel advice | MFAT SafeTravel advisories | Free/public, adapter extension/manual endpoint required | `NZ_MFAT_ADVISORY_API_URL` | Configure supported RSS/API/official-page extraction after validating format and terms. |

## Health and medical feeds

| Domain | Source | Class | Configuration | Notes |
| --- | --- | --- | --- | --- |
| Global outbreaks | WHO disease outbreak news/RSS where available | Free/public or official page extraction | `HEALTH_OUTBREAK_FEED_URL` | Official source. Must be country/region matched before affecting trip risk. Configure WHO manually when a stable feed/page is selected. |
| Travel health | CDC travel health notices | Free/public, no key | `HEALTH_OUTBREAK_FEED_URL=https://wwwnc.cdc.gov/travel/rss/notices.xml` | Auto-defaulted. Official/public travel health feed. |
| Regional public health | ECDC/national health authority feeds | Free/public or official page extraction | `HEALTH_OUTBREAK_FEED_URL` | Add only where terms permit. Analyst review recommended. |

## Disaster, seismic and weather feeds

| Domain | Source | Class | Configuration | Notes |
| --- | --- | --- | --- | --- |
| Global disasters | GDACS RSS/XML | Free/public, no key | `DISASTER_FEED_URL=https://www.gdacs.org/xml/rss.xml` | Auto-defaulted. Requires geolocation/country relevance filtering. |
| Earthquakes | USGS earthquake GeoJSON feeds | Free/public, no key | `USGS_EARTHQUAKE_FEED_URL=https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson` | Auto-defaulted. Do not treat global earthquakes as country drivers unless geography matches. |
| Weather alerts | National meteorological agencies or commercial weather API | Free/public or paid optional | `WEATHER_API_KEY` / `DISASTER_FEED_URL` | Production weather alerting often needs paid provider coverage and SLA. |

## News, incidents and RSS

| Domain | Source | Class | Configuration | Notes |
| --- | --- | --- | --- | --- |
| GDELT/news discovery | GDELT API | Free/public API, no key | `GDELT_API_URL=https://api.gdeltproject.org/api/v2/doc/doc?query=travel%20OR%20protest%20OR%20airport%20OR%20security&mode=ArtList&format=json&maxrecords=50&sort=HybridRel` | Auto-defaulted. Can rate-limit and is noisy; use for discovery only with relevance scoring and analyst review. |
| Curated RSS | Official transport, airport, health, embassy and security feeds | Free/public, no key | `NEWS_RSS_FEEDS=https://www.smartraveller.gov.au/rss,https://www.gdacs.org/xml/rss.xml,https://wwwnc.cdc.gov/travel/rss/notices.xml` | Auto-defaulted starter set. Add destination-specific official feeds later. |

## Aviation and transport disruption

| Domain | Source | Class | Configuration | Notes |
| --- | --- | --- | --- | --- |
| Aviation disruption | Aviationstack or equivalent | Paid optional/API required | `AVIATIONSTACK_API_KEY` | Useful for flight status/airport disruption. Production reliability likely requires paid terms. |
| Airport official feeds | Airport status pages/RSS where available | Free/public or official page extraction | `OFFICIAL_PAGE_URLS` / `NEWS_RSS_FEEDS` | Prefer official airport or civil aviation authority sources. |
| Ground transport | National rail/road/transport authority alerts | Free/public or official page extraction | `NEWS_RSS_FEEDS` / `OFFICIAL_PAGE_URLS` | Match to itinerary route before scoring. |

## Embassy and consular context

| Domain | Source | Class | Configuration | Notes |
| --- | --- | --- | --- | --- |
| Embassy pages | Official embassy/high commission/consulate pages | Manual/official page extraction | `OFFICIAL_PAGE_URLS` | Extract contact/location context only from official pages. Manual validation recommended. |
| Consular alerts | Government consular alert pages | Free/public or official page extraction | `OFFICIAL_PAGE_URLS` / advisory URLs | Must preserve URL, timestamp and country scope. |

## Optional commercial providers

Paid intelligence, aviation, medical assistance, weather, sanctions, maritime and executive protection providers can improve coverage, licensing and SLA. Add them as optional production providers only after procurement, terms review and analyst workflow design.

Manual keys or explicit provider choices still required:

- `NEXT_PUBLIC_MAPBOX_TOKEN`: optional Mapbox key for production-grade geocoding/map services.
- `AVIATIONSTACK_API_KEY`: optional/paid aviation disruption key, or replace with another aviation provider.
- `WEATHER_API_KEY`: optional weather provider if official public disaster feeds are insufficient.
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: required for production document storage.
- `STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`: required for real subscription checkout and webhooks.
- `OPENAI_API_KEY` / `AI_API_KEY` or local Ollama configuration: required only for AI-assisted extraction/summaries outside mock/fallback mode.
- Premium/purchased intelligence, sanctions, maritime, medical assistance or executive protection feeds: optional production upgrade after procurement.

## Minimum production confidence checklist

1. At least two official advisory providers live for the destination.
2. Source freshness under 72 hours for advisory and live-event sources.
3. Health, disaster/weather and curated incident feeds configured.
4. Fallback/demo usage low and clearly labelled.
5. Event relevance confidence high after country/city matching.
6. Hotel and route recommendations reviewed where sourced from public-map data.
7. Analyst override and evidence approval workflow enabled before high-risk operational recommendations.
