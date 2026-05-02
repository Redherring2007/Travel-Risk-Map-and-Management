import { randomUUID } from 'crypto';
import { alerts } from './data';
import type { Alert, Trip, TripDocument, TripReport } from './types';

const trips = new Map<string, Trip>();
const documents = new Map<string, TripDocument[]>();
const reports = new Map<string, TripReport>();
const mutableAlerts = new Map<string, Alert>(alerts.map((alert) => [alert.id, alert]));

export const store = {
  listTrips(userId: string) {
    return Array.from(trips.values()).filter((trip) => trip.userId === userId);
  },
  createTrip(input: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const trip: Trip = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    trips.set(trip.id, trip);
    return trip;
  },
  getTrip(id: string) {
    return trips.get(id) ?? null;
  },
  updateTrip(id: string, patch: Partial<Trip>) {
    const current = trips.get(id);
    if (!current) return null;
    const next = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
    trips.set(id, next);
    return next;
  },
  deleteTrip(id: string) {
    documents.delete(id);
    return trips.delete(id);
  },
  addDocument(input: Omit<TripDocument, 'id' | 'uploadedAt'>) {
    const doc: TripDocument = { ...input, id: randomUUID(), uploadedAt: new Date().toISOString() };
    const list = documents.get(doc.tripId) ?? [];
    documents.set(doc.tripId, [...list, doc]);
    return doc;
  },
  listDocuments(tripId: string) {
    return documents.get(tripId) ?? [];
  },
  deleteDocument(tripId: string, documentId: string) {
    const list = documents.get(tripId) ?? [];
    documents.set(tripId, list.filter((doc) => doc.id !== documentId));
    return true;
  },
  saveReport(report: TripReport) {
    reports.set(report.id, report);
    return report;
  },
  getReport(reportId: string) {
    return reports.get(reportId) ?? null;
  },
  listAlerts() {
    return Array.from(mutableAlerts.values());
  },
  approveAlert(id: string) {
    const alert = mutableAlerts.get(id);
    if (!alert) return null;
    const next = { ...alert, approved: true };
    mutableAlerts.set(id, next);
    return next;
  }
};
