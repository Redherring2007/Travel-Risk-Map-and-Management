# Atlas Insight Provider Configuration Guide

This guide lists free, public, official and optional paid data sources that can improve Atlas Insight confidence. Do not treat any source as operationally authoritative until licensing, reliability, freshness and analyst validation rules are confirmed.

## Source classes

- **Free/public**: no paid licence expected, but rate limits and terms still apply.
- **API required**: endpoint or key/configuration required in `.env.local`.
- **Manual/official page extraction**: controlled extraction from official public pages only; avoid aggressive scraping.
- **Paid optional**: commercial provider may be required for production-grade SLA, coverage or licensing.

## Official travel advisories

| Domain | Source | Class | Configuration | Notes |
| --- | --- | --- | --- | --- |
| UK travel advice | UK FCDO travel advice pages/content endpoint | Free/public, API or official page extraction | `UK_FCDO_API_URL` | Official source. Prefer structured endpoint if available; otherwise controlled official-page extraction. |
| US travel advisories | US Department of State travel advisories | Free/public, API or official page extraction | `US_STATE_ADVISORY_API_URL` | Official source. Must preserve advisory level, source URL and issue date. |
| Canada travel advice | Government of Canada Travel Advice and Advisories | Free/public, API or official page extraction | `CANADA_ADVISORY_API_URL` | Official source. Capture advisory level and destination scope. |
| Australia travel advice | Smartraveller destination advice/RSS/export where available | Free/public, API or official page extraction | `AU_SMARTRAVELLER_API_URL` | Official source. Validate destination matching before scoring. |
| New Zealand travel advice | MFAT SafeTravel advisories | Free/public, API or official page extraction | `NZ_MFAT_ADVISORY_API_URL` | Official source. Use as an additional advisory cross-check. |

## Health and medical feeds

| Domain | Source | Class | Configuration | Notes |
| --- | --- | --- | --- | --- |
| Global outbreaks | WHO disease outbreak news/RSS where available | Free/public or official page extraction | `HEALTH_OUTBREAK_FEED_URL` | Official source. Must be country/region matched before affecting trip risk. |
| Travel health | CDC travel health notices | Free/public or official page extraction | `HEALTH_OUTBREAK_FEED_URL` | Official source. Useful for vaccines, outbreaks and health notices. |
| Regional public health | ECDC/national health authority feeds | Free/public or official page extraction | `HEALTH_OUTBREAK_FEED_URL` | Add only where terms permit. Analyst review recommended. |

## Disaster, seismic and weather feeds

| Domain | Source | Class | Configuration | Notes |
| --- | --- | --- | --- | --- |
| Global disasters | GDACS RSS/XML | Free/public | `DISASTER_FEED_URL` | Public international disaster alert feed. Requires geolocation/country relevance filtering. |
| Earthquakes | USGS earthquake GeoJSON feeds | Free/public | `USGS_EARTHQUAKE_FEED_URL` | Public official source. Do not treat global earthquakes as country drivers unless geography matches. |
| Weather alerts | National meteorological agencies or commercial weather API | Free/public or paid optional | `WEATHER_API_KEY` / `DISASTER_FEED_URL` | Production weather alerting often needs paid provider coverage and SLA. |

## News, incidents and RSS

| Domain | Source | Class | Configuration | Notes |
| --- | --- | --- | --- | --- |
| GDELT/news discovery | GDELT API | Free/public API | `GDELT_API_URL` | Noisy source. Use for discovery only; relevance scoring and analyst review are required. |
| Curated RSS | Official transport, airport, health, embassy and security feeds | Free/public | `NEWS_RSS_FEEDS` | Use comma-separated curated feeds. Avoid generic news feeds as authoritative evidence. |

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

## Minimum production confidence checklist

1. At least two official advisory providers live for the destination.
2. Source freshness under 72 hours for advisory and live-event sources.
3. Health, disaster/weather and curated incident feeds configured.
4. Fallback/demo usage low and clearly labelled.
5. Event relevance confidence high after country/city matching.
6. Hotel and route recommendations reviewed where sourced from public-map data.
7. Analyst override and evidence approval workflow enabled before high-risk operational recommendations.
