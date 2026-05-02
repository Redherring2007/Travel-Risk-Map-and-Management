# Atlas Insight Risk Map and Travel Management

Atlas Insight Risk Map and Travel Management is a portable Travel Risk Management and Security Intelligence Platform MVP. It includes a free public risk layer and a paid client travel-management workflow.

## Built MVP

- Premium dark intelligence-dashboard UI with sidebar navigation.
- Dashboard executive overview showing only high and critical risk event markers.
- Full Risk Map view with interactive real 2D world map, country risk colouring, country hover/click, city markers, country search, and global city search.
- Country intelligence profiles with risk scoring, baseline data, advisories, current alerts, and source/demo status.
- City intelligence profiles for important/high-risk cities.
- Isolated auth adapter with demo headers today and stable route contracts for production auth.
- Paid-gated trip creation and update API.
- Traveller profile capture.
- Neon-backed trip, document metadata, and report persistence when `DATABASE_URL` is configured, with explicit demo fallback when it is not.
- S3/R2/MinIO-ready signed upload and download URL endpoints.
- Tailored travel risk report generation and markdown download.
- User alerts and admin approve/override APIs.
- Provider adapter contracts with demo fallback and live REST Countries baseline enrichment.
- Neon/Postgres migration for production schema.
- Stripe checkout/webhook placeholders showing the access-tier update flow.

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- d3-geo + topojson-client for the world map
- Zod for request validation
- Neon Postgres adapter
- S3-compatible storage package and presigned URL support
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
npm run build
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
10. Request a signed upload URL if S3/R2/MinIO is configured.
11. Add document metadata from the Document Hub.
12. View and delete document metadata if needed.
13. Generate the tailored risk report.
14. Download the report.
15. Open `Reports` to re-open the latest report.
16. Open `Alerts` and `Travel Feed` for global/trip-relevant alert context.

## Production Notes

The app is a hardened working MVP, not fully production-ready yet. Before commercial launch:

- Replace demo-header auth with a real auth provider in `lib/auth.ts`.
- Replace Stripe placeholders with real Checkout session creation and signed webhook verification.
- Apply row-level authorization to every Neon-backed object.
- Wire provider ingestion jobs for FCDO, US State, Canada, Australia, GDELT/news, weather/disaster, health, aviation, and geocoding.
- Add scheduled ingestion, moderation queue operations, and richer admin screens.
- Add observability, backups, rate limiting, audit review, and VPS deployment hardening.
