'use client';

import { useEffect, useMemo, useState } from 'react';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { AlertTriangle, BarChart3, Bell, CircleHelp, FileText, Globe2, Home, MapPin, Plane, Search, Settings, Shield, Trash2, Upload, UserRound } from 'lucide-react';
import { alerts, cities, countries } from '@/lib/data';
import { missingDocuments } from '@/lib/report';
import { riskCategoryLabels } from '@/lib/risk-engine';
import type { Alert, CityProfile, CountryProfile, RiskLevel, Trip, TripDocument, TripReport } from '@/lib/types';

type WorldFeature = { type: 'Feature'; id?: string | number; properties: { name: string }; geometry: unknown };
type FeatureCollection = { features: WorldFeature[] };

type ViewName = 'Dashboard' | 'Risk Map' | 'Countries' | 'Cities' | 'Alerts' | 'Itineraries' | 'Reports' | 'Travel Feed' | 'Support' | 'Settings';

const nav: Array<[ViewName, typeof Home]> = [
  ['Dashboard', Home], ['Risk Map', Globe2], ['Countries', MapPin], ['Cities', Search], ['Alerts', Bell], ['Itineraries', Plane], ['Reports', FileText], ['Travel Feed', BarChart3], ['Support', CircleHelp], ['Settings', Settings]
];

const colorByLevel: Record<RiskLevel | 'Unknown', string> = {
  Low: '#63b86f', Moderate: '#f6c343', High: '#f97316', Critical: '#f04438', Unknown: '#253442'
};

const countryNameAliases: Record<string, string> = {
  'United Kingdom': 'GB', France: 'FR', Kenya: 'KE', Ukraine: 'UA', Japan: 'JP'
};

const alertCoordinates: Record<string, [number, number]> = {
  France: [2.3522, 48.8566], Kenya: [36.8219, -1.2921], Ukraine: [30.5234, 50.4501], Japan: [139.6503, 35.6762]
};

function scoreFor(profile?: CountryProfile | CityProfile | null) {
  return profile?.risk.find((risk) => risk.category === 'overall');
}

function findCountryByMapName(name: string) {
  return countries.find((country) => country.iso2 === countryNameAliases[name] || country.name === name) ?? null;
}

function useWorld() {
  const [world, setWorld] = useState<FeatureCollection | null>(null);
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then((response) => response.json())
      .then((topology) => setWorld(feature(topology, topology.objects.countries) as unknown as FeatureCollection))
      .catch(() => setWorld(null));
  }, []);
  return world;
}

function WorldMap({ mode, selectedCity, onCountry, onCity }: { mode: 'dashboard' | 'risk'; selectedCity?: CityProfile | null; onCountry?: (country: CountryProfile | null, rawName: string) => void; onCity?: (city: CityProfile) => void }) {
  const world = useWorld();
  const projection = useMemo(() => geoEqualEarth().fitSize([980, 500], { type: 'Sphere' }), []);
  const path = useMemo(() => geoPath(projection), [projection]);
  const highAlerts = alerts.filter((alert) => ['High', 'Critical'].includes(alert.severity));
  const importantCities = cities.filter((city) => (scoreFor(city)?.value ?? 0) >= 50);
  const selectedPoint = selectedCity ? projection([selectedCity.lon, selectedCity.lat]) : null;

  return (
    <svg viewBox="0 0 980 500" role="img" aria-label={mode === 'dashboard' ? 'Executive high risk event map' : 'Full country risk map'}>
      <path d={path({ type: 'Sphere' }) ?? ''} fill="#07111b" />
      {world?.features.map((item) => {
        const profile = findCountryByMapName(item.properties.name);
        const level = scoreFor(profile)?.level ?? 'Unknown';
        return (
          <path
            key={`${item.id}-${item.properties.name}`}
            className="country"
            d={path(item as never) ?? ''}
            fill={mode === 'risk' ? colorByLevel[level] : '#1c2a36'}
            opacity={mode === 'risk' ? (level === 'Unknown' ? 0.45 : 0.84) : 0.55}
            onMouseEnter={() => mode === 'risk' && onCountry?.(profile, item.properties.name)}
            onClick={() => mode === 'risk' && onCountry?.(profile, item.properties.name)}
          />
        );
      })}
      {mode === 'dashboard' ? highAlerts.map((alert) => {
        const point = projection(alertCoordinates[alert.country] ?? [0, 0]);
        if (!point) return null;
        return <g key={alert.id}><circle className="event-marker" cx={point[0]} cy={point[1]} r={alert.severity === 'Critical' ? 8 : 6} fill={colorByLevel[alert.severity]} /><title>{alert.title}</title></g>;
      }) : null}
      {mode === 'risk' ? importantCities.map((city) => {
        const point = projection([city.lon, city.lat]);
        if (!point) return null;
        const level = scoreFor(city)?.level ?? 'Moderate';
        return <circle key={city.id} className="city-marker" cx={point[0]} cy={point[1]} r="5" fill={colorByLevel[level]} onClick={() => onCity?.(city)} />;
      }) : null}
      {selectedPoint ? <circle cx={selectedPoint[0]} cy={selectedPoint[1]} r="9" fill="#f0c96b" stroke="#05080d" strokeWidth="3" /> : null}
    </svg>
  );
}

function SearchBox<T extends { name: string }>({ placeholder, items, onSelect, labelFor }: { placeholder: string; items: T[]; onSelect: (item: T) => void; labelFor?: (item: T) => string }) {
  const [query, setQuery] = useState('');
  const matches = query ? items.filter((item) => (labelFor?.(item) ?? item.name).toLowerCase().includes(query.toLowerCase())).slice(0, 8) : [];
  return <div className="searchbox"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} />{matches.length ? <div className="results">{matches.map((item) => <button key={labelFor?.(item) ?? item.name} onClick={() => { onSelect(item); setQuery(''); }}>{labelFor?.(item) ?? item.name}</button>)}</div> : null}</div>;
}

function CountryPanel({ country, city, rawName }: { country: CountryProfile | null; city: CityProfile | null; rawName: string }) {
  const targetScore = scoreFor(city ?? country);
  if (!country && !city && !rawName) return null;
  if (!country && !city) return <div className="detail-panel"><h2>{rawName}</h2><p className="muted">Limited verified data available.</p></div>;
  const countryAlerts = country ? alerts.filter((alert) => alert.country === country.name) : [];
  return (
    <div className="detail-panel wide-panel">
      <div className="eyebrow">Full intelligence profile</div>
      <h2>{city ? `${city.name}, ${country?.name}` : country?.name}</h2>
      <div className="score">{targetScore?.value ?? '--'} <span className="muted">/ 100 {targetScore?.level}</span></div>
      <p className="muted">Confidence: {targetScore?.confidence}. Source status: {targetScore?.sourceStatus}. Last updated: {targetScore?.lastUpdated ? new Date(targetScore.lastUpdated).toLocaleString() : 'Unknown'}.</p>
      <p>{city ? city.overview : country?.securityOverview}</p>
      {city?.limitedData ? <p className="muted">Limited verified data available.</p> : null}
      {country ? <div className="profile-grid">
        <div className="kv"><span>Capital</span><strong>{country.capital}</strong></div><div className="kv"><span>Region</span><strong>{country.region}</strong></div><div className="kv"><span>Population</span><strong>{country.population}</strong></div><div className="kv"><span>Government</span><strong>{country.governmentType}</strong></div><div className="kv"><span>Languages</span><strong>{country.languages.join(', ')}</strong></div><div className="kv"><span>Currency</span><strong>{country.currency}</strong></div><div className="kv"><span>Timezone</span><strong>{country.timeZones.join(', ')}</strong></div>
      </div> : null}
      {country ? <div className="intel-sections"><h3>Entry and visa</h3><p>{country.entryVisaNotes}</p><h3>Security</h3><p>{country.securityOverview}</p><h3>Crime</h3><p>{country.crimeOverview}</p><h3>Terrorism/conflict</h3><p>{country.terrorismConflictOverview}</p><h3>Kidnap/extortion</h3><p>{country.kidnapExtortionRisk}</p><h3>Political stability and civil unrest</h3><p>{country.politicalStability} {country.protestCivilUnrestRisk}</p><h3>Health, water and food safety</h3><p>{country.healthRisks} {country.hygieneWaterFoodSafety}</p><h3>Medical and emergency services</h3><p>{country.medicalCapability} {country.emergencyServicesCapability}</p><h3>Natural hazards, infrastructure and transport</h3><p>{country.naturalHazards} {country.transportInfrastructureRisk} {country.airportTravelDisruptionRisk}</p><h3>Local laws/culture</h3><p>{country.localLawsCulture}</p><h3>Areas to avoid</h3><p>{country.areasToAvoid.join(', ')}</p><h3>Current alerts</h3>{countryAlerts.length ? countryAlerts.map((alert) => <p key={alert.id}><strong>{alert.severity}:</strong> {alert.title}. {alert.recommendedAction}</p>) : <p className="muted">No current demo alerts for this profile.</p>}<h3>Risk breakdown</h3>{country.risk.filter((item) => item.category !== 'overall').map((item) => <div className="risk-row compact" key={item.category}><span>{riskCategoryLabels[item.category]}</span><strong style={{ color: colorByLevel[item.level] }}>{item.value}</strong><div className="bar"><span style={{ width: `${item.value}%`, background: colorByLevel[item.level] }} /></div></div>)}<h3>Final recommendation</h3><p>{country.recommendation}</p><p className="muted">{country.verifiedDataStatus}</p></div> : null}
    </div>
  );
}

function Dashboard({ setView }: { setView: (view: ViewName) => void }) {
  const highAlerts = alerts.filter((alert) => ['High', 'Critical'].includes(alert.severity));
  const ranked = [...countries].sort((a, b) => (scoreFor(b)?.value ?? 0) - (scoreFor(a)?.value ?? 0));
  const incidentCounts = { Security: 2, Health: 1, Natural: 1, Political: 1, Other: 1 };
  return <><section className="dashboard-grid"><div className="card map-card"><div className="card-header"><div><h2>Executive Risk Map</h2><p className="muted">High and critical events only</p></div><button className="secondary" onClick={() => setView('Risk Map')}>Open full map</button></div><div className="map-wrap executive-map"><WorldMap mode="dashboard" /></div></div><div className="side-stack"><div className="card metric"><h3>Current Alerts</h3><div><span className="metric-number red">{highAlerts.length}</span> <span className="muted">High/Critical</span></div></div><div className="card metric"><h3>Incidents Today</h3><div><span className="metric-number">{alerts.length + 23}</span> <span className="muted">Worldwide</span></div></div><div className="card metric"><h3>Travel Advisories</h3><div><span className="metric-number blue">8</span> <span className="muted">Updated today</span></div></div></div></section><section className="lower-grid"><div className="card"><div className="card-header"><h2>Risk by Country</h2></div><div className="list">{ranked.map((country) => { const value = scoreFor(country)?.value ?? 0; const level = scoreFor(country)?.level ?? 'Low'; return <div className="risk-row" key={country.iso2}><span>{country.name}</span><strong style={{ color: colorByLevel[level] }}>{level}</strong><div className="bar"><span style={{ width: `${value}%`, background: colorByLevel[level] }} /></div></div>; })}</div></div><div className="card"><div className="card-header"><h2>Incident Categories</h2></div><div className="list">{Object.entries(incidentCounts).map(([name, value]) => <div className="risk-row" key={name}><span>{name}</span><strong>{value}</strong><div className="bar"><span style={{ width: `${value * 18}%`, background: name === 'Security' ? '#5ab2d8' : name === 'Health' ? '#f97316' : name === 'Natural' ? '#f6c343' : '#63b86f' }} /></div></div>)}</div></div><div className="card"><div className="card-header"><h2>Live Travel Intelligence</h2></div><div className="list">{alerts.map((alert) => <div className="feed-item" key={alert.id}><strong>{alert.title}</strong><br /><span className="muted">{alert.country}{alert.city ? `, ${alert.city}` : ''} - {alert.severity} - {alert.source}</span><p>{alert.summary}</p></div>)}</div></div></section></>;
}

function RiskMapView() {
  const [selectedCountry, setSelectedCountry] = useState<CountryProfile | null>(countries[2]);
  const [selectedCity, setSelectedCity] = useState<CityProfile | null>(null);
  const [rawName, setRawName] = useState('Kenya');
  return <section className="card map-card risk-map-card"><div className="card-header"><div><h2>Full Risk Map</h2><p className="muted">Country colouring, hover snapshots, high-risk city markers, and source-labelled intelligence.</p></div><div className="legend"><span><i className="dot" style={{ background: colorByLevel.Low }} />Low</span><span><i className="dot" style={{ background: colorByLevel.Moderate }} />Moderate</span><span><i className="dot" style={{ background: colorByLevel.High }} />High</span><span><i className="dot" style={{ background: colorByLevel.Critical }} />Critical</span></div></div><div className="search-row"><SearchBox placeholder="Search countries" items={countries} onSelect={(country) => { setSelectedCountry(country); setSelectedCity(null); setRawName(country.name); }} /><SearchBox placeholder="Search cities globally" items={cities} labelFor={(city) => `${city.name}, ${countries.find((country) => country.iso2 === city.countryIso2)?.name}`} onSelect={(city) => { setSelectedCity(city); setSelectedCountry(countries.find((country) => country.iso2 === city.countryIso2) ?? null); setRawName(city.name); }} /></div><div className="map-wrap full-map"><WorldMap mode="risk" selectedCity={selectedCity} onCountry={(country, name) => { setSelectedCountry(country); setSelectedCity(null); setRawName(name); }} onCity={(city) => { setSelectedCity(city); setSelectedCountry(countries.find((country) => country.iso2 === city.countryIso2) ?? null); setRawName(city.name); }} /><CountryPanel country={selectedCountry} city={selectedCity} rawName={rawName} /></div></section>;
}

function AccountPanel({ paid, setPaid }: { paid: boolean; setPaid: (paid: boolean) => void }) {
  return <div className="card"><div className="card-header"><div><h2>Account Access</h2><p className="muted">Demo login scaffolding for free/client access. Production uses real auth and Stripe.</p></div><span className="pill"><UserRound size={16} /> {paid ? 'Client' : 'Free'}</span></div><div className="form-grid"><div className="field"><label>Email</label><input defaultValue="client@atlasinsight.example" /></div><div className="field"><label>Password</label><input type="password" defaultValue="atlas-demo" /></div><button className="primary" onClick={() => setPaid(true)}>Sign up / log in as client</button><button className="secondary" onClick={() => setPaid(false)}>Use free tier</button></div></div>;
}

function TripFlow({ paid, latestReport, setLatestReport }: { paid: boolean; latestReport: TripReport | null; setLatestReport: (report: TripReport | null) => void }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [documents, setDocuments] = useState<TripDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<TripDocument | null>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: 'Nairobi executive visit', countryIso2: 'KE', country: 'Kenya', city: 'Nairobi', arrivalDate: '2026-06-10', departureDate: '2026-06-14', nationality: 'British', gender: 'Not specified', travelStyle: 'executive', medicalConsiderations: 'None declared', riskTolerance: 'medium', purpose: 'Board meetings', accommodation: 'Secure business hotel near meeting site', flightDetails: 'International arrival and departure via NBO', internalMovements: 'Airport transfer, hotel to offices, client dinner route', meetingsEvents: 'Board meeting and investor dinner' });
  const missing = missingDocuments(documents);

  async function createTrip() {
    setMessage('');
    const response = await fetch('/api/trips', { method: 'POST', headers: { 'content-type': 'application/json', 'x-demo-paid': paid ? 'true' : 'false' }, body: JSON.stringify({ name: form.name, traveller: { nationality: form.nationality, gender: form.gender, travelStyle: form.travelStyle, highProfile: form.travelStyle === 'executive', medicalConsiderations: form.medicalConsiderations, riskTolerance: form.riskTolerance, purpose: form.purpose, childrenTravelling: false, hostileEnvironmentSupport: (scoreFor(countries.find((country) => country.iso2 === form.countryIso2))?.value ?? 0) > 60 }, locations: [{ countryIso2: form.countryIso2, country: form.country, city: form.city, arrivalDate: form.arrivalDate, departureDate: form.departureDate }], accommodation: form.accommodation, flightDetails: form.flightDetails, internalMovements: form.internalMovements, meetingsEvents: form.meetingsEvents }) });
    const json = await response.json();
    if (!response.ok) setMessage(json.error ?? 'Unable to create trip'); else { setTrip(json.data); setMessage('Trip created and saved in demo store.'); }
  }
  async function uploadDoc(type: string) {
    if (!trip) return;
    const response = await fetch(`/api/trips/${trip.id}/documents`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-demo-paid': paid ? 'true' : 'false' }, body: JSON.stringify({ type, fileName: `${type.toLowerCase().replaceAll(' ', '-')}.pdf`, mimeType: 'application/pdf', size: 120000, demoContent: 'Demo document placeholder' }) });
    const json = await response.json();
    if (response.ok) setDocuments((current) => [...current, json.data]);
  }
  async function viewDoc(doc: TripDocument) {
    if (!trip) return;
    const response = await fetch(`/api/trips/${trip.id}/documents/${doc.id}`, { headers: { 'x-demo-paid': paid ? 'true' : 'false' } });
    const json = await response.json();
    if (response.ok) setSelectedDocument(json.data);
  }
  async function deleteDoc(doc: TripDocument) {
    if (!trip) return;
    const response = await fetch(`/api/trips/${trip.id}/documents/${doc.id}`, { method: 'DELETE', headers: { 'x-demo-paid': paid ? 'true' : 'false' } });
    if (response.ok) setDocuments((current) => current.filter((item) => item.id !== doc.id));
  }
  async function generateReport() {
    if (!trip) return;
    const response = await fetch('/api/reports/generate', { method: 'POST', headers: { 'content-type': 'application/json', 'x-demo-paid': paid ? 'true' : 'false' }, body: JSON.stringify({ tripId: trip.id }) });
    const json = await response.json();
    if (response.ok) setLatestReport(json.data);
  }
  return <section className="card sections"><div className="card-header"><div><div className="eyebrow">Paid client tier</div><h2>Trip Management</h2></div>{paid ? <span className="pill"><Shield size={16} /> Client access</span> : <span className="pill"><AlertTriangle size={16} /> Upgrade required</span>}</div><div className="form-grid">{Object.entries(form).map(([key, value]) => <div className={`field ${['internalMovements', 'meetingsEvents'].includes(key) ? 'full' : ''}`} key={key}><label>{key.replace(/([A-Z])/g, ' $1')}</label><input value={value} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></div>)}<div className="field full"><button className="primary" onClick={createTrip}>Create Trip</button></div></div>{message ? <div className="list"><p className="muted">{message}</p></div> : null}{trip ? <div className="list"><strong>Re-opened trip:</strong> {trip.name} for {trip.locations[0].city}, {trip.locations[0].country}<p className="muted">Trip alerts: {alerts.filter((alert) => alert.country === trip.locations[0].country).map((alert) => alert.title).join('; ') || 'No linked demo alerts.'}</p></div> : null}{trip ? <div className="list"><h3>Document Hub</h3><div className="top-actions">{['Passport', 'Visa', 'Tickets', 'Hotel booking', 'Insurance', 'Medical documents', 'Emergency contacts'].map((type) => <button className="secondary" key={type} onClick={() => uploadDoc(type)}><Upload size={15} /> {type}</button>)}</div><p className="muted">Missing: {missing.join(', ') || 'None'}</p></div> : null}{documents.length ? <div className="list"><table className="table"><tbody>{documents.map((doc) => <tr key={doc.id}><td>{doc.type}</td><td>{doc.fileName}</td><td>{doc.storageKey}</td><td><button className="secondary" onClick={() => viewDoc(doc)}>View</button></td><td><button className="icon-button" onClick={() => deleteDoc(doc)} title="Delete document"><Trash2 size={16} /></button></td></tr>)}</tbody></table>{selectedDocument ? <p className="muted">Viewing metadata: {selectedDocument.fileName} stored at {selectedDocument.storageKey}</p> : null}</div> : null}{trip ? <div className="list"><button className="primary" onClick={generateReport}>Run Assessment and Generate Report</button></div> : null}{latestReport ? <ReportView report={latestReport} /> : null}</section>;
}

function ReportView({ report }: { report: TripReport }) {
  return <div><div className="card-header"><h3>{report.title}</h3><a className="secondary" href={`/api/reports/${report.id}/download`}>Download report</a></div><div className="report">{report.markdown}</div></div>;
}

function SimpleListView({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card"><div className="card-header"><h2>{title}</h2></div><div className="list">{children}</div></section>;
}

export default function HomePage() {
  const [active, setActive] = useState<ViewName>('Dashboard');
  const [paid, setPaid] = useState(false);
  const [latestReport, setLatestReport] = useState<TripReport | null>(null);
  const highCities = cities.filter((city) => (scoreFor(city)?.value ?? 0) >= 50);

  return <div className="shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><Shield size={18} /></div><span>Atlas Insight</span></div><nav className="nav">{nav.map(([item, Icon]) => <button key={item} className={active === item ? 'active' : ''} onClick={() => setActive(item)} title={item}><Icon size={18} /> {item}</button>)}</nav></aside><main className="main"><header className="topbar"><div><div className="eyebrow">Atlas Insight Risk Map and Travel Management</div><h1>{active === 'Dashboard' ? 'Executive Overview' : active}</h1></div><div className="top-actions"><button className="pill" onClick={() => setPaid(!paid)}><UserRound size={16} /> {paid ? 'Client tier active' : 'Free tier'}</button></div></header>{active === 'Dashboard' ? <Dashboard setView={setActive} /> : null}{active === 'Risk Map' ? <RiskMapView /> : null}{active === 'Countries' ? <SimpleListView title="Country Intelligence">{countries.map((country) => <div className="feed-item" key={country.iso2}><strong>{country.name}</strong><p>{country.securityOverview}</p><span className="muted">{scoreFor(country)?.level} - {scoreFor(country)?.value}/100 - {country.verifiedDataStatus}</span></div>)}</SimpleListView> : null}{active === 'Cities' ? <SimpleListView title="High-Risk and Important Cities">{highCities.map((city) => <div className="feed-item" key={city.id}><strong>{city.name}, {countries.find((country) => country.iso2 === city.countryIso2)?.name}</strong><p>{city.overview}</p><span className="muted">{scoreFor(city)?.level} - {scoreFor(city)?.value}/100</span></div>)}</SimpleListView> : null}{active === 'Alerts' ? <SimpleListView title="Alerts and Advisories">{alerts.map((alert) => <div className="feed-item" key={alert.id}><strong>{alert.severity}: {alert.title}</strong><p>{alert.summary}</p><span className="muted">{alert.source} - {new Date(alert.timestamp).toLocaleString()}</span></div>)}</SimpleListView> : null}{active === 'Itineraries' ? <><AccountPanel paid={paid} setPaid={setPaid} /><TripFlow paid={paid} latestReport={latestReport} setLatestReport={setLatestReport} /></> : null}{active === 'Reports' ? <SimpleListView title="Reports">{latestReport ? <ReportView report={latestReport} /> : <p className="muted">No report generated yet. Open Itineraries, create a trip, add documents, then generate a tailored report.</p>}</SimpleListView> : null}{active === 'Travel Feed' ? <SimpleListView title="Live Travel Intelligence">{alerts.map((alert) => <div className="feed-item" key={alert.id}><strong>{alert.title}</strong><p>{alert.summary}</p><span className="muted">{alert.category} - {alert.recommendedAction}</span></div>)}</SimpleListView> : null}{active === 'Support' ? <SimpleListView title="Support"><p>Use this area for emergency contacts, client support routing, and escalation procedures. Production support integrations can connect ticketing, phone bridge, and duty officer workflows.</p></SimpleListView> : null}{active === 'Settings' ? <SimpleListView title="Settings"><AccountPanel paid={paid} setPaid={setPaid} /><p className="muted">Provider status, Neon connection health, S3 storage, Stripe, and admin controls are exposed through API endpoints and documented in setup.</p></SimpleListView> : null}</main></div>;
}
