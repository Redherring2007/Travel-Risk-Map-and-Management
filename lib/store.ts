import { randomUUID } from 'crypto';
import { alerts, countries } from './data';
import { isNeonConfigured, query } from './neon';
import type { Alert, TravellerProfile, Trip, TripDocument, TripLocation, TripReport } from './types';

type DemoStoreState = {
  trips: Map<string, Trip>;
  documents: Map<string, TripDocument[]>;
  reports: Map<string, TripReport>;
  mutableAlerts: Map<string, Alert>;
};

const globalDemoStore = globalThis as typeof globalThis & {
  __atlasTravelDemoStore?: DemoStoreState;
};

const demoState = globalDemoStore.__atlasTravelDemoStore ??= {
  trips: new Map<string, Trip>(),
  documents: new Map<string, TripDocument[]>(),
  reports: new Map<string, TripReport>(),
  mutableAlerts: new Map<string, Alert>(alerts.map((alert) => [alert.id, alert]))
};

const { trips, documents, reports, mutableAlerts } = demoState;

type TripInput = Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>;
type DocumentInput = Omit<TripDocument, 'id' | 'uploadedAt' | 'auditStatus'>;

type TripRow = {
  id: string;
  user_id: string;
  name: string;
  purpose: string | null;
  accommodation: string | null;
  flight_details: string | null;
  internal_movements: string | null;
  meetings_events: string | null;
  created_at: string;
  updated_at: string;
  traveller: TravellerProfile | null;
  locations: TripLocation[] | null;
};

type DocumentRow = {
  id: string;
  trip_id: string;
  user_id: string | null;
  document_type: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  storage_provider: 's3' | 'demo';
  storage_bucket: string | null;
  storage_key: string;
  audit_status: 'active' | 'deleted';
  uploaded_at: string;
};

type ReportRow = { id: string; trip_id: string; title: string; markdown: string; recommendation: 'Go' | 'Go With Caution' | 'Avoid'; created_at: string };

function fromTripRow(row: TripRow): Trip {
  return {
    id: row.id,
    userId: row.user_id,
    paid: true,
    name: row.name,
    traveller: row.traveller ?? {
      nationality: '', gender: '', travelStyle: 'corporate', highProfile: false,
      medicalConsiderations: '', riskTolerance: 'medium', purpose: row.purpose ?? '', childrenTravelling: false, hostileEnvironmentSupport: false
    },
    locations: row.locations ?? [],
    accommodation: row.accommodation ?? '',
    flightDetails: row.flight_details ?? '',
    internalMovements: row.internal_movements ?? '',
    meetingsEvents: row.meetings_events ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fromDocumentRow(row: DocumentRow): TripDocument {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id ?? undefined,
    type: row.document_type,
    fileName: row.file_name,
    mimeType: row.mime_type ?? 'application/octet-stream',
    size: Number(row.file_size ?? 0),
    uploadedAt: row.uploaded_at,
    storageProvider: row.storage_provider,
    storageBucket: row.storage_bucket ?? undefined,
    storageKey: row.storage_key,
    auditStatus: row.audit_status
  };
}

function fromReportRow(row: ReportRow): TripReport {
  return { id: row.id, tripId: row.trip_id, title: row.title, markdown: row.markdown, recommendation: row.recommendation, createdAt: row.created_at };
}

async function ensureUser(userId: string) {
  await query('insert into users (id, email, role) values ($1, $2, $3) on conflict (id) do nothing', [userId, `${userId}@atlasinsight.local`, 'client']);
}

async function ensureCountry(location: TripLocation) {
  const profile = countries.find((country) => country.iso2 === location.countryIso2);
  await query(
    `insert into countries (iso2, iso3, name, capital, region, population, government_type, languages, currency, time_zones)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (iso2) do update set name = excluded.name, updated_at = now()`,
    [location.countryIso2, profile?.iso3 ?? `${location.countryIso2}X`.slice(0, 3), location.country, profile?.capital ?? null, profile?.region ?? null, profile?.population ?? null, profile?.governmentType ?? null, profile?.languages ?? [], profile?.currency ?? null, profile?.timeZones ?? []]
  );
}

async function fetchTrip(id: string) {
  const rows = await query<TripRow>(
    `select t.*, 
      (select row_to_json(tp) from (
        select nationality, gender, travel_style as "travelStyle", high_profile as "highProfile", medical_considerations as "medicalConsiderations", risk_tolerance as "riskTolerance", travel_purpose as purpose, children_travelling as "childrenTravelling", hostile_environment_support as "hostileEnvironmentSupport"
        from traveller_profiles where trip_id = t.id limit 1
      ) tp) as traveller,
      coalesce((select json_agg(json_build_object('countryIso2', tl.country_iso2, 'country', c.name, 'city', tl.city_name, 'arrivalDate', tl.arrival_date::text, 'departureDate', tl.departure_date::text) order by tl.sequence) from trip_locations tl left join countries c on c.iso2 = tl.country_iso2 where tl.trip_id = t.id), '[]'::json) as locations
     from trips t where t.id = $1`,
    [id]
  );
  return rows[0] ? fromTripRow(rows[0]) : null;
}

export const store = {
  async listTrips(userId: string) {
    if (!isNeonConfigured()) return Array.from(trips.values()).filter((trip) => trip.userId === userId);
    const rows = await query<TripRow>(
      `select t.*,
        (select row_to_json(tp) from (
          select nationality, gender, travel_style as "travelStyle", high_profile as "highProfile", medical_considerations as "medicalConsiderations", risk_tolerance as "riskTolerance", travel_purpose as purpose, children_travelling as "childrenTravelling", hostile_environment_support as "hostileEnvironmentSupport"
          from traveller_profiles where trip_id = t.id limit 1
        ) tp) as traveller,
        coalesce((select json_agg(json_build_object('countryIso2', tl.country_iso2, 'country', c.name, 'city', tl.city_name, 'arrivalDate', tl.arrival_date::text, 'departureDate', tl.departure_date::text) order by tl.sequence) from trip_locations tl left join countries c on c.iso2 = tl.country_iso2 where tl.trip_id = t.id), '[]'::json) as locations
       from trips t where t.user_id = $1 order by t.updated_at desc`,
      [userId]
    );
    return rows.map(fromTripRow);
  },
  async createTrip(input: TripInput) {
    if (!isNeonConfigured()) {
      const now = new Date().toISOString();
      const trip: Trip = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
      trips.set(trip.id, trip);
      return trip;
    }
    await ensureUser(input.userId);
    await Promise.all(input.locations.map(ensureCountry));
    const inserted = await query<{ id: string }>(
      `insert into trips (user_id, name, purpose, accommodation, flight_details, internal_movements, meetings_events)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [input.userId, input.name, input.traveller.purpose, input.accommodation, input.flightDetails, input.internalMovements, input.meetingsEvents]
    );
    const tripId = inserted[0].id;
    await query(
      `insert into traveller_profiles (trip_id, nationality, gender, travel_style, high_profile, medical_considerations, risk_tolerance, travel_purpose, children_travelling, hostile_environment_support)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [tripId, input.traveller.nationality, input.traveller.gender, input.traveller.travelStyle, input.traveller.highProfile, input.traveller.medicalConsiderations, input.traveller.riskTolerance, input.traveller.purpose, input.traveller.childrenTravelling, input.traveller.hostileEnvironmentSupport]
    );
    for (const [index, location] of input.locations.entries()) {
      await query(
        `insert into trip_locations (trip_id, country_iso2, city_name, arrival_date, departure_date, sequence)
         values ($1,$2,$3,$4,$5,$6)`,
        [tripId, location.countryIso2, location.city, location.arrivalDate, location.departureDate, index + 1]
      );
    }
    return (await fetchTrip(tripId))!;
  },
  async getTrip(id: string) {
    if (!isNeonConfigured()) return trips.get(id) ?? null;
    return fetchTrip(id);
  },
  async updateTrip(id: string, patch: Partial<Trip>) {
    if (!isNeonConfigured()) {
      const current = trips.get(id);
      if (!current) return null;
      const next = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
      trips.set(id, next);
      return next;
    }
    await query(
      `update trips set name = coalesce($2, name), accommodation = coalesce($3, accommodation), flight_details = coalesce($4, flight_details), internal_movements = coalesce($5, internal_movements), meetings_events = coalesce($6, meetings_events), updated_at = now() where id = $1`,
      [id, patch.name ?? null, patch.accommodation ?? null, patch.flightDetails ?? null, patch.internalMovements ?? null, patch.meetingsEvents ?? null]
    );
    return fetchTrip(id);
  },
  async deleteTrip(id: string) {
    if (!isNeonConfigured()) {
      documents.delete(id);
      return trips.delete(id);
    }
    await query('delete from trips where id = $1', [id]);
    return true;
  },
  async addDocument(input: DocumentInput) {
    if (!isNeonConfigured()) {
      const doc: TripDocument = { ...input, id: randomUUID(), uploadedAt: new Date().toISOString(), auditStatus: 'active' };
      const list = documents.get(doc.tripId) ?? [];
      documents.set(doc.tripId, [...list, doc]);
      return doc;
    }
    const rows = await query<DocumentRow>(
      `insert into trip_documents (trip_id, user_id, document_type, file_name, mime_type, file_size, storage_provider, storage_bucket, storage_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [input.tripId, input.userId ?? null, input.type, input.fileName, input.mimeType, input.size, input.storageProvider, input.storageBucket ?? null, input.storageKey]
    );
    return fromDocumentRow(rows[0]);
  },
  async listDocuments(tripId: string) {
    if (!isNeonConfigured()) return (documents.get(tripId) ?? []).filter((doc) => doc.auditStatus === 'active');
    const rows = await query<DocumentRow>('select * from trip_documents where trip_id = $1 and audit_status = $2 order by uploaded_at desc', [tripId, 'active']);
    return rows.map(fromDocumentRow);
  },
  async getDocument(tripId: string, documentId: string) {
    if (!isNeonConfigured()) return (documents.get(tripId) ?? []).find((doc) => doc.id === documentId && doc.auditStatus === 'active') ?? null;
    const rows = await query<DocumentRow>('select * from trip_documents where trip_id = $1 and id = $2 and audit_status = $3', [tripId, documentId, 'active']);
    return rows[0] ? fromDocumentRow(rows[0]) : null;
  },
  async deleteDocument(tripId: string, documentId: string) {
    if (!isNeonConfigured()) {
      const list = documents.get(tripId) ?? [];
      documents.set(tripId, list.map((doc) => doc.id === documentId ? { ...doc, auditStatus: 'deleted' } : doc));
      return true;
    }
    await query('update trip_documents set audit_status = $3, deleted_at = now() where trip_id = $1 and id = $2', [tripId, documentId, 'deleted']);
    return true;
  },
  async saveReport(report: TripReport) {
    if (!isNeonConfigured()) {
      reports.set(report.id, report);
      return report;
    }
    const rows = await query<ReportRow>(
      `insert into trip_reports (id, trip_id, title, recommendation, markdown) values ($1,$2,$3,$4,$5) returning *`,
      [report.id, report.tripId, report.title, report.recommendation, report.markdown]
    );
    return fromReportRow(rows[0]);
  },
  async getReport(reportId: string) {
    if (!isNeonConfigured()) return reports.get(reportId) ?? null;
    const rows = await query<ReportRow>('select * from trip_reports where id = $1', [reportId]);
    return rows[0] ? fromReportRow(rows[0]) : null;
  },
  async listAlerts() {
    return Array.from(mutableAlerts.values());
  },
  async approveAlert(id: string) {
    const alert = mutableAlerts.get(id);
    if (!alert) return null;
    const next = { ...alert, approved: true };
    mutableAlerts.set(id, next);
    if (isNeonConfigured()) {
      await query('update risk_events set status = $2 where id::text = $1', [id, 'approved']).catch(() => []);
    }
    return next;
  }
};
