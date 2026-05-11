import type { Confidence, RiskLevel } from './types';

export const riskMatrixIndustries = [
  'travel',
  'HSE',
  'security',
  'events',
  'hostile environment',
  'construction',
  'facilities',
  'logistics',
  'maritime',
  'executive protection',
  'medical',
  'cyber',
  'business continuity',
  'custom'
] as const;

export type RiskMatrixIndustry = typeof riskMatrixIndustries[number];

export type RiskMatrixItemInput = {
  id?: string;
  industry?: string;
  hazard: string;
  threat?: string;
  vulnerability?: string;
  affectedAssets?: string[];
  personsAtRisk?: string[];
  likelihood: number;
  impact: number;
  exposure?: number;
  existingControls?: string[];
  residualLikelihood?: number;
  residualImpact?: number;
  recommendedControls?: string[];
  controlOwner?: string;
  reviewDate?: string;
  legalComplianceNotes?: string;
  sourceEvidence?: string[];
  confidence?: Confidence;
  assumptions?: string[];
  intelligenceGaps?: string[];
};

export type RiskMatrixItem = Required<Pick<RiskMatrixItemInput,
  'id' | 'hazard' | 'affectedAssets' | 'personsAtRisk' | 'likelihood' | 'impact' | 'exposure' |
  'existingControls' | 'residualLikelihood' | 'residualImpact' | 'recommendedControls' |
  'sourceEvidence' | 'confidence' | 'assumptions' | 'intelligenceGaps'
>> & {
  industry: RiskMatrixIndustry;
  threat: string;
  vulnerability: string;
  inherentScore: number;
  inherentLevel: RiskLevel;
  residualScore: number;
  residualLevel: RiskLevel;
  controlOwner: string;
  reviewDate: string;
  legalComplianceNotes: string;
};

export type RiskMatrixAssessmentInput = {
  industry?: string;
  activity?: string;
  location?: string;
  context?: string;
  items: RiskMatrixItemInput[];
  sourceEvidence?: string[];
};

export type RiskMatrixSummary = {
  industry: RiskMatrixIndustry;
  itemCount: number;
  highestInherentScore: number;
  highestInherentLevel: RiskLevel;
  highestResidualScore: number;
  highestResidualLevel: RiskLevel;
  criticalCount: number;
  highCount: number;
  moderateCount: number;
  lowCount: number;
  priorityActions: string[];
  intelligenceGaps: string[];
  confidence: Confidence;
};

export type RiskMatrixAssessment = RiskMatrixAssessmentInput & {
  industry: RiskMatrixIndustry;
  items: RiskMatrixItem[];
  summary: RiskMatrixSummary;
};

type TemplateHazard = {
  hazard: string;
  threat: string;
  vulnerability: string;
  commonControls: string[];
  legalComplianceNotes: string;
};

const TEMPLATE_LIBRARY: Record<RiskMatrixIndustry, TemplateHazard[]> = {
  travel: [
    { hazard: 'Ground movement exposure', threat: 'Crime, disruption or unsafe routing during transfers', vulnerability: 'Unvetted transport and incomplete route planning', commonControls: ['Use vetted drivers', 'Confirm movement windows', 'Monitor local alerts', 'Share journey plan'], legalComplianceNotes: 'Align with duty of care and local transport regulations.' },
    { hazard: 'Medical access limitation', threat: 'Delayed care or evacuation during illness or injury', vulnerability: 'Unknown local medical capability', commonControls: ['Confirm insurance', 'Identify hospitals', 'Carry medication', 'Set evacuation triggers'], legalComplianceNotes: 'Maintain traveller medical privacy and consent controls.' }
  ],
  HSE: [
    { hazard: 'Working at height', threat: 'Fall from height', vulnerability: 'Inadequate edge protection or competence', commonControls: ['Permit to work', 'Edge protection', 'Harness inspection', 'Rescue plan'], legalComplianceNotes: 'Apply local occupational safety regulations and competent-person requirements.' },
    { hazard: 'Manual handling', threat: 'Musculoskeletal injury', vulnerability: 'Poor lifting method or excessive load', commonControls: ['Task redesign', 'Mechanical aids', 'Training', 'Team lifts'], legalComplianceNotes: 'Document risk assessment and worker briefing.' }
  ],
  security: [
    { hazard: 'Unauthorised access', threat: 'Intrusion, theft or hostile surveillance', vulnerability: 'Weak access control and visitor screening', commonControls: ['Access control', 'Visitor logs', 'CCTV coverage', 'Security patrols'], legalComplianceNotes: 'Respect privacy, data protection and lawful use of surveillance.' },
    { hazard: 'Public disorder near site', threat: 'Civil unrest or crowd spillover', vulnerability: 'Exposed frontage and limited lockdown procedure', commonControls: ['Monitor protest notices', 'Lockdown plan', 'Secure perimeter', 'Staff alert cascade'], legalComplianceNotes: 'Coordinate only through lawful security measures.' }
  ],
  events: [
    { hazard: 'Crowd crush', threat: 'High-density crowd movement', vulnerability: 'Poor ingress/egress design', commonControls: ['Capacity limits', 'Stewarding plan', 'Barrier design', 'Emergency egress routes'], legalComplianceNotes: 'Comply with event licensing and fire safety requirements.' },
    { hazard: 'Severe weather', threat: 'Wind, lightning or heat illness', vulnerability: 'Outdoor exposure and weak shelter plan', commonControls: ['Weather monitoring', 'Shelter plan', 'Stop-work triggers', 'Medical posts'], legalComplianceNotes: 'Record weather trigger decisions and public announcements.' }
  ],
  'hostile environment': [
    { hazard: 'Kidnap or detention', threat: 'Targeted abduction or arbitrary detention', vulnerability: 'Predictable movements and weak profile management', commonControls: ['Journey management', 'Check-in protocol', 'Profile reduction', 'Crisis response plan'], legalComplianceNotes: 'Follow local law and organisational crisis management policy.' },
    { hazard: 'Indirect fire or armed conflict', threat: 'Exposure to conflict effects', vulnerability: 'Operating near contested areas', commonControls: ['No-go areas', 'Shelter drills', 'Tracking', 'Evacuation triggers'], legalComplianceNotes: 'Comply with sanctions, insurance and security-provider laws.' }
  ],
  construction: [
    { hazard: 'Plant and vehicle interface', threat: 'Collision with moving machinery', vulnerability: 'Mixed pedestrian and vehicle routes', commonControls: ['Segregated routes', 'Banksmen', 'Speed limits', 'High-visibility PPE'], legalComplianceNotes: 'Maintain traffic management plan and inspection records.' },
    { hazard: 'Excavation collapse', threat: 'Trench collapse or buried services strike', vulnerability: 'Poor shoring and service detection', commonControls: ['Permit to dig', 'Service scan', 'Shoring', 'Daily inspection'], legalComplianceNotes: 'Comply with excavation safety and utility notification rules.' }
  ],
  facilities: [
    { hazard: 'Fire life safety failure', threat: 'Delayed evacuation or uncontrolled fire', vulnerability: 'Blocked exits or weak maintenance', commonControls: ['Fire alarm testing', 'Clear exits', 'Drills', 'Maintenance logs'], legalComplianceNotes: 'Meet local fire code and occupancy requirements.' },
    { hazard: 'Utility outage', threat: 'Loss of power, water or HVAC', vulnerability: 'Single points of failure', commonControls: ['Generator test', 'Supplier escalation', 'Critical spares', 'Business continuity plan'], legalComplianceNotes: 'Maintain statutory inspections for critical systems.' }
  ],
  logistics: [
    { hazard: 'Cargo theft', threat: 'Theft from vehicle, warehouse or route', vulnerability: 'Predictable routes and unsecured stops', commonControls: ['Route variation', 'Secure parking', 'Seal checks', 'Tracking'], legalComplianceNotes: 'Follow customs, insurance and chain-of-custody requirements.' },
    { hazard: 'Driver fatigue', threat: 'Road collision or delivery failure', vulnerability: 'Long schedules and weak monitoring', commonControls: ['Hours controls', 'Rest plan', 'Telematics', 'Fit-to-drive checks'], legalComplianceNotes: 'Comply with working time and transport regulations.' }
  ],
  maritime: [
    { hazard: 'Piracy or armed robbery', threat: 'Attack on vessel or crew', vulnerability: 'Transit through higher-risk waters', commonControls: ['BMP measures', 'Citadel readiness', 'AIS policy', 'Naval reporting'], legalComplianceNotes: 'Comply with flag-state, port-state and security-provider rules.' },
    { hazard: 'Severe sea state', threat: 'Injury, cargo loss or vessel damage', vulnerability: 'Weather routing gaps', commonControls: ['Weather routing', 'Cargo securing', 'Bridge watch', 'Contingency port plan'], legalComplianceNotes: 'Document passage planning and safety management system controls.' }
  ],
  'executive protection': [
    { hazard: 'Targeted hostile approach', threat: 'Harassment, assault or kidnapping', vulnerability: 'Public profile and predictable itinerary', commonControls: ['Advance work', 'Close protection plan', 'Secure transport', 'Profile management'], legalComplianceNotes: 'Use lawful, licensed protection measures only.' },
    { hazard: 'Venue exposure', threat: 'Crowd, protest or surveillance risk at venue', vulnerability: 'Weak access and egress planning', commonControls: ['Venue advance', 'Safe room', 'Alternate exits', 'Liaison with venue security'], legalComplianceNotes: 'Respect venue rules and local security law.' }
  ],
  medical: [
    { hazard: 'Clinical deterioration', threat: 'Delayed recognition or escalation', vulnerability: 'Limited monitoring and escalation criteria', commonControls: ['Triage protocol', 'Escalation triggers', 'Medical oversight', 'Handover notes'], legalComplianceNotes: 'Maintain clinical governance and patient confidentiality.' },
    { hazard: 'Infection exposure', threat: 'Transmission to staff or patients', vulnerability: 'Inadequate infection prevention controls', commonControls: ['PPE', 'Screening', 'Isolation protocol', 'Cleaning schedule'], legalComplianceNotes: 'Follow public health and occupational exposure requirements.' }
  ],
  cyber: [
    { hazard: 'Credential compromise', threat: 'Account takeover or data access', vulnerability: 'Weak authentication and phishing exposure', commonControls: ['MFA', 'Phishing training', 'Conditional access', 'Password manager'], legalComplianceNotes: 'Apply data protection, incident notification and access-control duties.' },
    { hazard: 'Ransomware', threat: 'Data encryption and operational disruption', vulnerability: 'Unpatched systems and weak backups', commonControls: ['Patch cadence', 'EDR', 'Offline backups', 'Incident playbook'], legalComplianceNotes: 'Maintain regulatory reporting and evidence preservation.' }
  ],
  'business continuity': [
    { hazard: 'Critical supplier failure', threat: 'Service interruption or delivery failure', vulnerability: 'Single-source dependency', commonControls: ['Supplier mapping', 'Alternate suppliers', 'SLA monitoring', 'Crisis communications'], legalComplianceNotes: 'Review contractual, regulatory and customer notification obligations.' },
    { hazard: 'Site denial', threat: 'Loss of access to primary workplace', vulnerability: 'No remote or alternate site plan', commonControls: ['Remote work plan', 'Alternate site', 'Data access testing', 'Staff communications'], legalComplianceNotes: 'Maintain safety, employment and data protection requirements.' }
  ],
  custom: [
    { hazard: 'Unspecified operational hazard', threat: 'Disruption, injury, loss or compliance failure', vulnerability: 'Incomplete context or weak controls', commonControls: ['Clarify activity', 'Identify exposed assets', 'Assign control owner', 'Set review date'], legalComplianceNotes: 'Confirm applicable legal and regulatory duties for the activity and location.' }
  ]
};

function clampScale(value: number | undefined, fallbackValue: number) {
  const number = Number.isFinite(value) ? Number(value) : fallbackValue;
  return Math.min(5, Math.max(1, Math.round(number)));
}

function unique(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

export function normaliseRiskMatrixIndustry(industry?: string): RiskMatrixIndustry {
  const requested = industry?.trim().toLowerCase();
  return riskMatrixIndustries.find((item) => item.toLowerCase() === requested) ?? 'custom';
}

export function riskMatrixLevel(score: number): RiskLevel {
  if (score >= 17) return 'Critical';
  if (score >= 10) return 'High';
  if (score >= 5) return 'Moderate';
  return 'Low';
}

export function suggestControlsForIndustry(industryInput?: string, hazard?: string): string[] {
  const industry = normaliseRiskMatrixIndustry(industryInput);
  const hazardText = hazard?.toLowerCase() ?? '';
  const templates = TEMPLATE_LIBRARY[industry];
  const matched = templates.find((item) => hazardText && (item.hazard.toLowerCase().includes(hazardText) || hazardText.includes(item.hazard.toLowerCase())));
  const base = matched ? matched.commonControls : templates.flatMap((item) => item.commonControls).slice(0, 6);
  return unique([...base, 'Assign a control owner', 'Set review date', 'Record evidence for control effectiveness']);
}

export function validateRiskMatrixInput(input: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return { valid: false, errors: ['Request body must be an object.'] };
  const body = input as Partial<RiskMatrixAssessmentInput>;
  if (!Array.isArray(body.items) || body.items.length === 0) errors.push('At least one matrix item is required.');
  body.items?.forEach((item, index) => {
    if (!item.hazard?.trim()) errors.push(`items[${index}].hazard is required.`);
    if (!Number.isFinite(item.likelihood)) errors.push(`items[${index}].likelihood must be a number from 1 to 5.`);
    if (!Number.isFinite(item.impact)) errors.push(`items[${index}].impact must be a number from 1 to 5.`);
  });
  return { valid: errors.length === 0, errors };
}

export function generateIndustryTemplate(industryInput?: string) {
  const industry = normaliseRiskMatrixIndustry(industryInput);
  const hazards = TEMPLATE_LIBRARY[industry].map((item) => ({ ...item, industry }));
  return {
    industry,
    scoring: {
      likelihood: '1-5',
      impact: '1-5',
      exposure: '1-5 optional context modifier; deterministic score remains likelihood x impact.',
      bands: { Low: '1-4', Moderate: '5-9', High: '10-16', Critical: '17-25' }
    },
    hazards,
    commonControls: unique(hazards.flatMap((item) => item.commonControls))
  };
}

function templateForItem(industry: RiskMatrixIndustry, hazard: string) {
  const lowered = hazard.toLowerCase();
  return TEMPLATE_LIBRARY[industry].find((item) => lowered.includes(item.hazard.toLowerCase()) || item.hazard.toLowerCase().includes(lowered));
}

export function calculateRiskMatrixItem(input: RiskMatrixItemInput, fallbackIndustry: RiskMatrixIndustry = 'custom'): RiskMatrixItem {
  const industry = normaliseRiskMatrixIndustry(input.industry ?? fallbackIndustry);
  const likelihood = clampScale(input.likelihood, 3);
  const impact = clampScale(input.impact, 3);
  const exposure = clampScale(input.exposure, 3);
  const existingControls = unique(input.existingControls ?? []);
  const hasControls = existingControls.length > 0;
  const residualLikelihood = clampScale(input.residualLikelihood, hasControls ? Math.max(1, likelihood - 1) : likelihood);
  const residualImpact = clampScale(input.residualImpact, impact);
  const inherentScore = likelihood * impact;
  const residualScore = residualLikelihood * residualImpact;
  const template = templateForItem(industry, input.hazard);
  const recommendedControls = unique([...(input.recommendedControls ?? []), ...suggestControlsForIndustry(industry, input.hazard)]).filter((control) => !existingControls.includes(control));
  const assumptions = unique([
    ...(input.assumptions ?? []),
    exposure >= 4 ? 'High exposure increases monitoring and review priority, although the deterministic score remains likelihood x impact.' : undefined,
    hasControls ? undefined : 'Residual score assumes no verified existing controls were supplied.'
  ]);
  const intelligenceGaps = unique([
    ...(input.intelligenceGaps ?? []),
    input.sourceEvidence?.length ? undefined : 'No source evidence supplied for this item.',
    input.controlOwner ? undefined : 'Control owner not assigned.',
    input.reviewDate ? undefined : 'Review date not set.'
  ]);

  return {
    id: input.id ?? globalThis.crypto?.randomUUID?.() ?? `matrix-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    industry,
    hazard: input.hazard.trim(),
    threat: input.threat?.trim() || template?.threat || 'Threat not specified.',
    vulnerability: input.vulnerability?.trim() || template?.vulnerability || 'Vulnerability not specified.',
    affectedAssets: unique(input.affectedAssets ?? []),
    personsAtRisk: unique(input.personsAtRisk ?? []),
    likelihood,
    impact,
    exposure,
    existingControls,
    inherentScore,
    inherentLevel: riskMatrixLevel(inherentScore),
    residualLikelihood,
    residualImpact,
    residualScore,
    residualLevel: riskMatrixLevel(residualScore),
    recommendedControls,
    controlOwner: input.controlOwner?.trim() || 'Unassigned',
    reviewDate: input.reviewDate?.trim() || '',
    legalComplianceNotes: input.legalComplianceNotes?.trim() || template?.legalComplianceNotes || 'Confirm applicable legal, regulatory and client-specific duties.',
    sourceEvidence: unique(input.sourceEvidence ?? []),
    confidence: input.confidence ?? (input.sourceEvidence?.length ? 'Medium' : 'Low'),
    assumptions,
    intelligenceGaps
  };
}

function aggregateConfidence(items: RiskMatrixItem[]): Confidence {
  if (!items.length) return 'Low';
  if (items.some((item) => item.confidence === 'Low')) return 'Low';
  if (items.every((item) => item.confidence === 'High')) return 'High';
  return 'Medium';
}

export function summariseRiskMatrix(items: RiskMatrixItem[], industryInput?: string): RiskMatrixSummary {
  const industry = normaliseRiskMatrixIndustry(industryInput ?? items[0]?.industry);
  const highestInherentScore = Math.max(0, ...items.map((item) => item.inherentScore));
  const highestResidualScore = Math.max(0, ...items.map((item) => item.residualScore));
  const residualLevels = items.map((item) => item.residualLevel);
  const priorityActions = items
    .filter((item) => item.residualLevel === 'Critical' || item.residualLevel === 'High')
    .flatMap((item) => item.recommendedControls.slice(0, 2).map((control) => `${item.hazard}: ${control}`))
    .slice(0, 10);
  return {
    industry,
    itemCount: items.length,
    highestInherentScore,
    highestInherentLevel: riskMatrixLevel(highestInherentScore),
    highestResidualScore,
    highestResidualLevel: riskMatrixLevel(highestResidualScore),
    criticalCount: residualLevels.filter((level) => level === 'Critical').length,
    highCount: residualLevels.filter((level) => level === 'High').length,
    moderateCount: residualLevels.filter((level) => level === 'Moderate').length,
    lowCount: residualLevels.filter((level) => level === 'Low').length,
    priorityActions,
    intelligenceGaps: unique(items.flatMap((item) => item.intelligenceGaps)),
    confidence: aggregateConfidence(items)
  };
}

export function calculateRiskMatrix(input: RiskMatrixAssessmentInput): RiskMatrixAssessment {
  const validation = validateRiskMatrixInput(input);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const industry = normaliseRiskMatrixIndustry(input.industry);
  const sharedSources = input.sourceEvidence ?? [];
  const items = input.items.map((item) => calculateRiskMatrixItem({ ...item, sourceEvidence: unique([...(item.sourceEvidence ?? []), ...sharedSources]) }, industry));
  return { ...input, industry, items, summary: summariseRiskMatrix(items, industry) };
}
