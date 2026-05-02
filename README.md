# Atlas Insight Risk Map and Travel Management

Atlas Insight Risk Map and Travel Management is a portable Travel Risk Management and Security Intelligence Platform MVP. It includes a free public risk layer and a paid client travel-management workflow.

## Built MVP

- Premium dark intelligence-dashboard UI with sidebar navigation.
- Dashboard executive overview showing only high and critical risk event markers.
- Full Risk Map view with interactive real 2D world map, country risk colouring, country hover/click, city markers, country search, and global city search.
- Country intelligence profiles with risk scoring, baseline data, advisories, current alerts, and source/demo status.
- City intelligence profiles for important/high-risk cities.
- Demo account access with free/client tier switching.
- Paid-gated trip creation and update API.
- Traveller profile capture.
- Document hub storing metadata and S3-ready storage keys. Neon stores metadata only; S3-compatible storage stores files in production.
- Tailored travel risk report generation and markdown download.
- User alerts and admin approve/override APIs.
- Provider adapter contracts with demo fallback.
- Neon/Postgres migration for production schema.

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- d3-geo + topojson-client for the world map
- Zod for request validation
- Neon Postgres adapter
- S3-compatible storage package
- Playwright tests

## Environment Variables

Copy `.env.example` to `.env.local` for local development.

Required for production:

- `NEXT_PUBLIC_APP_URL`
- `AUTH_SECRET`
- `DATABASE_URL`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `STRIPE_PUBLIC_KEY`
- `STRIPE_SECRET_KEY`

Optional provider feeds:

- `CIA_FACTBOOK_SOURCE_URL`
- `UK_FCDO_API_URL`
- `US_STATE_ADVISORY_API_URL`
- `CANADA_ADVISORY_API_URL`
- `AU_SMARTRAVELLER_API_URL`
- `GDELT_API_URL`
- `NEWS_RSS_FEEDS`
- `WEATHER_API_KEY`
- `DISASTER_FEED_URL`
- `HEALTH_OUTBREAK_FEED_URL`
- `AVIATIONSTACK_API_KEY`
- `NEXT_PUBLIC_MAPBOX_TOKEN`

## Neon Migration

Run the migration in Neon SQL editor or with `psql`:

```bash
psql "$DATABASE_URL" -f db/migrations/001_initial_neon_schema.sql
```

The migration creates users, subscriptions, countries, cities, country/city profiles, risk scores, advisories, risk events, risk sources, admin approvals/overrides, trips, trip locations, traveller profiles, document metadata, reports, and audit logs.

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

With the dev server running:

```bash
npm run verify:mvp
npm run test:e2e
```

## Full MVP Test Journey

1. Open the dashboard at `/`.
2. Confirm the executive map shows only high/critical markers.
3. Open `Risk Map` from the sidebar.
4. Search for `Kenya` and open the country panel.
5. Search for `Nairobi` and open city intelligence.
6. Open `Itineraries`.
7. Try `Create Trip` as a free user and confirm paid gating blocks it.
8. Click `Sign up / log in as client`.
9. Create a trip.
10. Add document metadata from the Document Hub.
11. View and delete document metadata if needed.
12. Generate the tailored risk report.
13. Download the report.
14. Open `Reports` to re-open the latest report.
15. Open `Alerts` and `Travel Feed` for global/trip-relevant alert context.

## Production Notes

This MVP is source-ready and commercially structured, but it still uses demo in-memory storage for local interactions. For production:

- Replace demo auth with a real auth provider using `users` and `subscriptions` tables.
- Connect Stripe checkout and webhooks.
- Persist trips, documents, reports, alerts, approvals, and overrides to Neon.
- Store actual document bytes in S3-compatible storage and keep only metadata in Neon.
- Add signed URL generation for document view/download.
- Connect provider ingestion jobs for country baselines, advisories, live incidents, weather, health, aviation, and geocoding.
- Add row-level authorization and audit logging around all paid/admin endpoints.
- Deploy as a Next.js Node service on a VPS behind Nginx/Caddy, or to a managed Node host.
