'use client';

import { useEffect, useMemo, useState } from 'react';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { AlertTriangle, BarChart3, Bell, BriefcaseBusiness, CircleHelp, FileText, Gauge, Globe2, Home, MapPin, Plane, Search, Settings, Shield, Upload, UserRound } from 'lucide-react';
import { alerts, cities, countries } from '@/lib/data';
import { missingDocuments } from '@/lib/report';
import type { CityProfile, CountryProfile, RiskLevel, Trip, TripDocument, TripReport } from '@/lib/types';

type WorldFeature = { type: 'Feature'; id?: string | number; properties: { name: string }; geometry: unknown };

type FeatureCollection = { features: WorldFeature[] };

const nav = [
  ['Dashboard', Home], ['Risk Map', Globe2], ['Countries', MapPin], ['Cities', Search], ['Alerts', Bell], ['Itineraries', Plane], ['Reports', FileText], ['Travel Feed', BarChart3], ['Support', CircleHelp], ['Settings', Settings]
] as const;

const colorByLevel: Record<RiskLevel | 'Unknown', string> = {
  Low: '#63b86f', Moderate: '#f6c343', High: '#f97316', Critical: '#f04438', Unknown: '#253442'
};

const countryNameAliases: Record<string, string> = {
  'United Kingdom': 'GB', France: 'FR', Kenya: 'KE', Ukraine: 'UA', Japan: 'JP'
};

function levelForCountryName(name: string) {
  const profile = countries.find((country) => country.iso2 === countryNameAliases[name] || country.name === name);
  return profile?.risk.find((risk) => risk.category === 'overall')?.level ?? 'Unknown';
}

function scoreFor(profile?: CountryProfile | CityProfile | null) {
  return profile?.risk.find((risk) => risk.category === 'overall');
}

function DashboardMap({ onCountry, selectedCountry, selectedCity }: { onCountry: (country: CountryProfile | null, rawName: string) => void; selectedCountry: CountryProfile | null; selectedCity: CityProfile | null }) {
  const [world, setWorld] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then((response) => response.json())
      .then((topology) => setWorld(feature(topology, topology.objects.countries) as unknown as FeatureCollection))
      .catch(() => setWorld(null));
  }, []);

  const projection = useMemo(() => geoEqualEarth().fitSize([980, 500], { type: 'Sphere' }), []);
  const path = useMemo(() => geoPath(projection), [projection]);
  const cityPoint = selectedCity ? projection([selectedCity.lon, selectedCity.lat]) : null;

  return (
    <svg viewBox="0 0 980 500" role="img" aria-label="Interactive global risk map">
      <path d={path({ type: 'Sphere' }) ?? ''} fill="#07111b" />
      {world?.features.map((item) => {
        const level = levelForCountryName(item.properties.name);
        const profile = countries.find((country) => country.iso2 === countryNameAliases[item.properties.name] || country.name === item.properties.name) ?? null;
        return (
          <path
            key={`${item.id}-${item.properties.name}`}
            className="country"
            d={path(item as never) ?? ''}
            fill={colorByLevel[level]}
            opacity={level === 'Unknown' ? 0.55 : 0.86}
            onMouseEnter={() => onCountry(profile, item.properties.name)}
            onClick={() => onCountry(profile, item.properties.name)}
          />
        );
      })}
      {selectedCountry ? <text x="28" y="468" fill="#d7a84f" fontSize="16">Selected: {selectedCountry.name}</text> : null}
      {cityPoint ? <circle cx={cityPoint[0]} cy={cityPoint[1]} r="7" fill="#f0c96b" stroke="#05080d" strokeWidth="3" /> : null}
    </svg>
  );
}

function SearchBox<T extends { name: string }>({ placeholder, items, onSelect, labelFor }: { placeholder: string; items: T[]; onSelect: (item: T) => void; labelFor?: (item: T) => string }) {
  const [query, setQuery] = useState('');
  const matches = query ? items.filter((item) => (labelFor?.(item) ?? item.name).toLowerCase().includes(query.toLowerCase())).slice(0, 7) : [];
  return (
    <div className="searchbox">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} />
      {matches.length > 0 ? (
        <div className="results">
          {matches.map((item) => (
            <button key={labelFor?.(item) ?? item.name} onClick={() => { onSelect(item); setQuery(''); }}>
              {labelFor?.(item) ?? item.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DetailPanel({ country, city, rawName }: { country: CountryProfile | null; city: CityProfile | null; rawName: string }) {
  const profileScore = scoreFor(city ?? country);
  if (!country && !city && !rawName) return null;
  if (!country && !city) {
    return <div className="detail-panel"><h2>{rawName}</h2><p className="muted">Limited verified data available. Connect country baseline and advisory providers to populate this profile.</p></div>;
  }
  return (
    <div className="detail-panel">
      <div className="eyebrow">Verified intelligence profile</div>
      <h2>{city ? `${city.name}, ${country?.name}` : country?.name}</h2>
      <div className="score">{profileScore?.value ?? '--'} <span className="muted">/ 100</span></div>
      <p>{city ? city.overview : country?.securityOverview}</p>
      {city?.limitedData ? <p className="muted">Limited verified city data available.</p> : null}
      {country ? (
        <>
          <div className="kv"><span className="muted">Capital</span><span>{country.capital}</span></div>
          <div className="kv"><span className="muted">Region</span><span>{country.region}</span></div>
          <div className="kv"><span className="muted">Languages</span><span>{country.languages.join(', ')}</span></div>
          <div className="kv"><span className="muted">Currency</span><span>{country.currency}</span></div>
          <div className="kv"><span className="muted">Visa</span><span>{country.entryVisaNotes}</span></div>
          <h3>Recommendation</h3><p>{country.recommendation}</p>
          <h3>Key risks</h3><p>{country.crimeOverview} {country.terrorismConflictOverview} {country.healthRisks}</p>
          <h3>Emergency capability</h3><p>{country.emergencyServicesCapability}</p>
          <h3>Areas to avoid</h3><p>{country.areasToAvoid.join(', ')}</p>
          <p className="muted">{country.verifiedDataStatus}</p>
        </>
      ) : null}
    </div>
  );
}

function TripFlow({ paid }: { paid: boolean }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [documents, setDocuments] = useState<TripDocument[]>([]);
  const [report, setReport] = useState<TripReport | null>(null);
  const [form, setForm] = useState({ name: 'London executive visit', countryIso2: 'GB', country: 'United Kingdom', city: 'London', arrivalDate: '2026-06-10', departureDate: '2026-06-14', nationality: 'British', purpose: 'Board meetings', accommodation: 'Central business hotel', flightDetails: 'BA arrival and departure', internalMovements: 'Airport transfer, hotel to offices, client dinner route', meetingsEvents: 'Board meeting and investor dinner' });
  const missing = missingDocuments(documents);

  async function createTrip() {
    const response = await fetch('/api/trips', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-demo-paid': paid ? 'true' : 'false' },
      body: JSON.stringify({
        name: form.name,
        traveller: { nationality: form.nationality, gender: 'Not specified', travelStyle: 'executive', highProfile: true, medicalConsiderations: 'None declared', riskTolerance: 'medium', purpose: form.purpose, childrenTravelling: false, hostileEnvironmentSupport: false },
        locations: [{ countryIso2: form.countryIso2, country: form.country, city: form.city, arrivalDate: form.arrivalDate, departureDate: form.departureDate }],
        accommodation: form.accommodation, flightDetails: form.flightDetails, internalMovements: form.internalMovements, meetingsEvents: form.meetingsEvents
      })
    });
    const json = await response.json();
    if (!response.ok) alert(json.error);
    else setTrip(json.data);
  }

  async function uploadDoc(type: string) {
    if (!trip) return;
    const response = await fetch(`/api/trips/${trip.id}/documents`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-demo-paid': paid ? 'true' : 'false' },
      body: JSON.stringify({ type, fileName: `${type.toLowerCase().replaceAll(' ', '-')}.pdf`, mimeType: 'application/pdf', size: 120000, demoContent: 'Demo document placeholder' })
    });
    const json = await response.json();
    if (response.ok) setDocuments((current) => [...current, json.data]);
  }

  async function generateReport() {
    if (!trip) return;
    const response = await fetch('/api/reports/generate', { method: 'POST', headers: { 'content-type': 'application/json', 'x-demo-paid': paid ? 'true' : 'false' }, body: JSON.stringify({ tripId: trip.id }) });
    const json = await response.json();
    if (response.ok) setReport(json.data);
  }

  return (
    <section className="card sections" id="itineraries">
      <div className="card-header"><div><div className="eyebrow">Paid client tier</div><h2>Trip Management</h2></div>{paid ? <span className="pill"><Shield size={16} /> Client access</span> : <span className="pill"><AlertTriangle size={16} /> Upgrade required</span>}</div>
      <div className="form-grid">
        {Object.entries(form).map(([key, value]) => <div className={`field ${['internalMovements', 'meetingsEvents'].includes(key) ? 'full' : ''}`} key={key}><label>{key.replace(/([A-Z])/g, ' $1')}</label><input value={value} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></div>)}
        <div className="field full"><button className="primary" onClick={createTrip}>Create Trip</button></div>
      </div>
      {trip ? <div className="list"><strong>Created:</strong> {trip.name} for {trip.locations[0].city}, {trip.locations[0].country}</div> : null}
      {trip ? <div className="list"><h3>Document Hub</h3><div className="top-actions">{['Passport', 'Visa', 'Tickets', 'Hotel booking', 'Insurance', 'Medical documents', 'Emergency contacts'].map((type) => <button className="secondary" key={type} onClick={() => uploadDoc(type)}><Upload size={15} /> {type}</button>)}</div><p className="muted">Missing: {missing.join(', ') || 'None'}</p></div> : null}
      {documents.length ? <div className="list"><table className="table"><tbody>{documents.map((doc) => <tr key={doc.id}><td>{doc.type}</td><td>{doc.fileName}</td><td>{Math.round(doc.size / 1000)} KB</td></tr>)}</tbody></table></div> : null}
      {trip ? <div className="list"><button className="primary" onClick={generateReport}>Generate Tailored Risk Report</button></div> : null}
      {report ? <div><div className="card-header"><h3>{report.title}</h3><a className="secondary" href={`/api/reports/${report.id}/download`}>Download report</a></div><div className="report">{report.markdown}</div></div> : null}
    </section>
  );
}

export default function HomePage() {
  const [active, setActive] = useState('Dashboard');
  const [paid, setPaid] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<CountryProfile | null>(countries[0]);
  const [selectedCity, setSelectedCity] = useState<CityProfile | null>(null);
  const [rawName, setRawName] = useState('');
  const ranked = [...countries].sort((a, b) => (scoreFor(b)?.value ?? 0) - (scoreFor(a)?.value ?? 0));
  const incidentCounts = { Security: 2, Health: 1, Natural: 1, Political: 1, Other: 1 };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Shield size={18} /></div><span>Aegis Travel Intelligence</span></div>
        <nav className="nav">{nav.map(([item, Icon]) => <button key={item} className={active === item ? 'active' : ''} onClick={() => setActive(item)} title={item}><Icon size={18} /> {item}</button>)}</nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div><div className="eyebrow">The platform: see it, understand it, stay ahead</div><h1>Risk Overview</h1></div>
          <div className="top-actions">
            <div className="legend"><span><i className="dot" style={{ background: colorByLevel.Low }} />Low</span><span><i className="dot" style={{ background: colorByLevel.Moderate }} />Moderate</span><span><i className="dot" style={{ background: colorByLevel.High }} />High</span><span><i className="dot" style={{ background: colorByLevel.Critical }} />Critical</span></div>
            <button className="pill" onClick={() => setPaid(!paid)}><UserRound size={16} /> {paid ? 'Client tier active' : 'Free tier'}</button>
          </div>
        </header>
        <section className="dashboard-grid">
          <div className="card map-card">
            <div className="card-header"><h2>Global Risk Map</h2><span className="muted">Public interactive layer</span></div>
            <div className="search-row">
              <SearchBox placeholder="Search countries" items={countries} onSelect={(country) => { setSelectedCountry(country); setSelectedCity(null); setRawName(country.name); }} />
              <SearchBox placeholder="Search cities" items={cities} labelFor={(city) => `${city.name}, ${countries.find((country) => country.iso2 === city.countryIso2)?.name}`} onSelect={(city) => { setSelectedCity(city); setSelectedCountry(countries.find((country) => country.iso2 === city.countryIso2) ?? null); setRawName(city.name); }} />
            </div>
            <div className="map-wrap">
              <DashboardMap selectedCountry={selectedCountry} selectedCity={selectedCity} onCountry={(country, name) => { setSelectedCountry(country); setSelectedCity(null); setRawName(name); }} />
              <DetailPanel country={selectedCountry} city={selectedCity} rawName={rawName} />
            </div>
          </div>
          <div className="side-stack">
            <div className="card metric"><h3>Current Alerts</h3><div><span className="metric-number red">{alerts.filter((alert) => ['High', 'Critical'].includes(alert.severity)).length}</span> <span className="muted">High risk alerts</span></div></div>
            <div className="card metric"><h3>Incidents Today</h3><div><span className="metric-number">{alerts.length + 23}</span> <span className="muted">Worldwide</span></div></div>
            <div className="card metric"><h3>Travel Advisories</h3><div><span className="metric-number blue">8</span> <span className="muted">Updated today</span></div></div>
          </div>
        </section>
        <section className="lower-grid">
          <div className="card"><div className="card-header"><h2>Risk by Country</h2></div><div className="list">{ranked.map((country) => { const value = scoreFor(country)?.value ?? 0; const level = scoreFor(country)?.level ?? 'Low'; return <div className="risk-row" key={country.iso2}><span>{country.name}</span><strong style={{ color: colorByLevel[level] }}>{level}</strong><div className="bar"><span style={{ width: `${value}%`, background: colorByLevel[level] }} /></div></div>; })}</div></div>
          <div className="card"><div className="card-header"><h2>Incident Categories</h2></div><div className="list">{Object.entries(incidentCounts).map(([name, value]) => <div className="risk-row" key={name}><span>{name}</span><strong>{value}</strong><div className="bar"><span style={{ width: `${value * 18}%`, background: name === 'Security' ? '#5ab2d8' : name === 'Health' ? '#f97316' : name === 'Natural' ? '#f6c343' : '#63b86f' }} /></div></div>)}</div></div>
          <div className="card"><div className="card-header"><h2>Live Travel Intelligence</h2></div><div className="list">{alerts.map((alert) => <div className="feed-item" key={alert.id}><strong>{alert.title}</strong><br /><span className="muted">{alert.country}{alert.city ? `, ${alert.city}` : ''} · {alert.severity} · {alert.source}</span><p>{alert.summary}</p></div>)}</div></div>
        </section>
        <TripFlow paid={paid} />
      </main>
    </div>
  );
}
