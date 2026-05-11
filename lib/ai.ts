import type { Alert, Trip, TripDocument } from './types';
import type { AtlasRiskResult, RouteSegmentRisk } from './risk-engine';

export type AiResult = {
  configured: boolean;
  provider: string;
  model: string;
  sourceStatus: 'ai_generated' | 'manual_fallback';
  confidence: 'Low' | 'Medium' | 'High';
  text: string;
  sources: string[];
  error?: string;
  sourcesUsed?: string[];
  fallbackReason?: string;
};

export type AiReportOutput = AiResult & { markdown: string; status: 'ai_generated' | 'fallback'; groundedSourceCount: number };

type AiProvider = 'openai' | 'ollama';

export const ATLAS_TRAVEL_RISK_SYSTEM_PROMPT = `You are ATLAS-TRAVEL-RISK, a specialist travel risk assessment and executive report-writing model for Atlas Insight.

You support the final two stages of the itinerary workflow:
1. Risk Assessment
2. Full Travel Risk Report

You ONLY use the supplied evidence pack. You NEVER invent facts.

STRICT RULES:
1. Use only supplied evidence.
2. Never invent advisories, incidents, emergency numbers, laws, medical facilities, routes, airports, statistics or source claims.
3. Clearly separate confirmed information, analytical assessment, intelligence gaps and recommended mitigations.
4. Never downgrade official government advisories.
5. If evidence is weak or stale, clearly state confidence limitations.
6. Use formal UK English.
7. Maintain a calm executive-security tone.
8. Avoid hype, emojis, filler or unsupported certainty.
9. If travel should be avoided, state this clearly and explain why.
10. Prioritise operational practicality and traveller safety.
11. Cite or name underlying provider/source data where available.
12. If data is limited, state "Limited verified data available."

Risk domains include security, crime, terrorism/conflict, civil unrest, traveller profile, executive exposure, route and movement, airport/border disruption, ground transport, accommodation, meetings/events, health and medical, emergency response, natural hazards, communications/cyber and legal/cultural exposure.

Output should be professional, structured, concise, evidence-led and consultant-grade.`;

const PLACEHOLDER_VALUES = new Set(['replace-me', 'changeme', 'change-me', 'your-key-here', 'your_key_here', '']);

function configuredValue(value?: string | null) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return PLACEHOLDER_VALUES.has(trimmed.toLowerCase()) ? '' : trimmed;
}

function aiProvider(): AiProvider {
  return process.env.AI_PROVIDER?.toLowerCase() === 'ollama' ? 'ollama' : 'openai';
}

type AiTask = 'default' | 'scout' | 'analyst' | 'report' | 'route' | 'hotel' | 'matrix';

function modelFor(provider: AiProvider, task: AiTask = 'default') {
  if (provider === 'ollama') {
    const taskModel = task === 'scout' ? process.env.AI_SCOUT_MODEL
      : task === 'analyst' ? process.env.AI_ANALYST_MODEL
        : task === 'report' ? process.env.AI_REPORT_MODEL
          : task === 'route' ? process.env.AI_ROUTE_MODEL
            : task === 'hotel' ? process.env.AI_HOTEL_MODEL
              : task === 'matrix' ? process.env.AI_MATRIX_MODEL
                : undefined;
    return configuredValue(taskModel) || configuredValue(process.env.AI_REPORT_MODEL) || configuredValue(process.env.OLLAMA_TRAVEL_MODEL) || configuredValue(process.env.AI_MODEL) || 'atlas-travel-risk:latest';
  }
  return configuredValue(process.env.AI_REPORT_MODEL) || configuredValue(process.env.AI_MODEL) || 'gpt-4.1-mini';
}

function ollamaBaseUrl() {
  return (configuredValue(process.env.OLLAMA_BASE_URL) || 'http://localhost:11434').replace(/\/+$/, '');
}

export function aiStatus() {
  const provider = aiProvider();
  const key = configuredValue(process.env.OPENAI_API_KEY) || configuredValue(process.env.AI_API_KEY);
  const mock = process.env.AI_MOCK_MODE === 'true';
  const model = modelFor(provider);
  const configured = !mock && (provider === 'ollama' || Boolean(key));
  const missingConfigurationReason = mock
    ? 'AI mock mode active - deterministic fallback is used.'
    : provider === 'openai' && !key
      ? 'OpenAI API key missing or placeholder value supplied.'
      : '';
  return {
    configured,
    mock,
    provider,
    model,
    ollamaBaseUrl: provider === 'ollama' ? ollamaBaseUrl() : undefined,
    missingConfigurationReason,
    status: configured ? 'AI provider configured' : missingConfigurationReason || 'AI extraction unavailable - manual entry required'
  };
}

function fallback(text: string, sources: string[] = [], fallbackReason = 'Deterministic fallback active.'): AiResult {
  const status = aiStatus();
  return { configured: false, provider: status.provider, model: status.model, sourceStatus: 'manual_fallback', confidence: 'Low', text, sources, sourcesUsed: sources, fallbackReason };
}

async function callOpenAi(system: string, user: string, model: string): Promise<string> {
  const status = aiStatus();
  if (status.mock) throw new Error('AI mock mode active');
  const key = configuredValue(process.env.OPENAI_API_KEY) || configuredValue(process.env.AI_API_KEY);
  if (!key) throw new Error('AI key missing');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
  const json = await response.json();
  return String(json.choices?.[0]?.message?.content ?? '');
}

async function callOllama(system: string, user: string, model: string): Promise<string> {
  if (aiStatus().mock) throw new Error('AI mock mode active');
  const response = await fetch(`${ollamaBaseUrl()}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      options: { temperature: 0.15, top_p: 0.75, repeat_penalty: 1.12 }
    })
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  const json = await response.json();
  return String(json.message?.content ?? json.response ?? '');
}

async function callAi(system: string, user: string, task: AiTask = 'default'): Promise<{ text: string; model: string }> {
  const status = aiStatus();
  const model = modelFor(status.provider, task);
  if (!status.configured) throw new Error(status.missingConfigurationReason || 'AI provider not configured');
  const text = status.provider === 'ollama' ? await callOllama(system, user, model) : await callOpenAi(system, user, model);
  return { text, model };
}

function groundedSystem() {
  return ATLAS_TRAVEL_RISK_SYSTEM_PROMPT;
}

export async function summarizeCountry(input: { country: string; sourcedFacts: string[] }): Promise<AiResult> {
  const status = aiStatus();
  if (!status.configured) return fallback('AI summary unavailable. Showing sourced provider/demo intelligence without generated analysis.', input.sourcedFacts);
  try {
    const { text, model } = await callAi(groundedSystem(), `Country: ${input.country}\nSources:\n${input.sourcedFacts.join('\n')}`, 'analyst');
    return { configured: true, provider: status.provider, model, sourceStatus: 'ai_generated', confidence: 'Medium', text, sources: input.sourcedFacts, sourcesUsed: input.sourcedFacts };
  } catch (error) {
    return { ...fallback('AI summary failed; deterministic fallback active.', input.sourcedFacts, 'AI provider unavailable or returned an error.'), error: error instanceof Error ? error.message : 'unknown error' };
  }
}

export async function generateCountryBrief(input: { country: string; facts: string[] }) { return summarizeCountry({ country: input.country, sourcedFacts: input.facts }); }
export async function generateCityBrief(input: { city: string; facts: string[] }) { return summarizeCountry({ country: input.city, sourcedFacts: input.facts }); }

export function countryVisualPrompt(country: string, region: string, riskLevel: string) {
  return `Premium dark intelligence atlas diorama of ${country} in ${region}, low-poly terrain, subtle amber data lights, ${riskLevel} risk atmosphere, no text, original Atlas Insight style`;
}

export function travelMeaningFromScore(score: number) {
  if (score >= 75) return 'Avoid or tightly control travel with specialist security, medical contingency planning, and executive approval.';
  if (score >= 50) return 'Travel is possible with enhanced preparation, vetted movement, live alert monitoring, and clear escalation routes.';
  if (score >= 25) return 'Travel is generally manageable with itinerary awareness, disruption checks, and basic security precautions.';
  return 'Standard travel precautions are usually sufficient; continue monitoring for disruption and local rule changes.';
}

export async function extractDocumentItineraryData(fileName: string): Promise<AiResult> {
  const status = aiStatus();
  if (!status.configured) return fallback(`AI extraction unavailable - manual entry required for ${fileName}.`, [fileName]);
  return { configured: true, provider: status.provider, model: status.model, sourceStatus: 'ai_generated', confidence: 'Medium', text: `Document extraction scaffold ready for ${fileName}. Extract only dates, names, locations and booking references visible in uploaded/source data.`, sources: [fileName], sourcesUsed: [fileName] };
}

export async function generateItineraryRiskAssessment(input: { trip: Trip; assessment: AtlasRiskResult; sources: string[] }): Promise<AiResult> {
  const status = aiStatus();
  if (!status.configured) return fallback(`Deterministic assessment: ${input.assessment.level} (${input.assessment.score}/100). Key drivers: ${input.assessment.keyDrivers.join('; ') || 'baseline profile'}.`, input.sources);
  try {
    const { text, model } = await callAi(groundedSystem(), JSON.stringify({ task: 'Generate Atlas Insight itinerary risk assessment', trip: input.trip, assessment: input.assessment, sources: input.sources }, null, 2), 'matrix');
    return { configured: true, provider: status.provider, model, sourceStatus: 'ai_generated', confidence: input.assessment.confidence, text, sources: input.sources, sourcesUsed: input.sources };
  } catch (error) {
    return { ...fallback('AI itinerary assessment failed; deterministic assessment used.', input.sources, 'AI provider unavailable or returned an error.'), error: error instanceof Error ? error.message : 'unknown error' };
  }
}

export async function generateReportNarrative(sources: string[]): Promise<AiResult> {
  if (!aiStatus().configured) return fallback('Report narrative uses deterministic Atlas Insight templates because AI is not configured.', sources);
  return { configured: true, provider: aiStatus().provider, model: aiStatus().model, sourceStatus: 'ai_generated', confidence: 'Medium', text: 'AI narrative scaffold active. Generated text must cite supplied provider sources and state limitations.', sources, sourcesUsed: sources };
}

export async function generateTravelRiskReport(input: { trip: Trip; documents: TripDocument[]; assessment: AtlasRiskResult & { routeRisks?: RouteSegmentRisk[]; itineraryRisks?: Record<string, unknown> }; advisories: Alert[]; events: Alert[]; sourceList: string[] }): Promise<AiReportOutput> {
  const status = aiStatus();
  const sourceList = Array.from(new Set(input.sourceList));
  const operational = input.assessment as AtlasRiskResult & {
    routeRisk?: Array<{ segmentName: string; level: string; score: number; mitigation: string; recommendedMovementWindow?: string; secureTransportRecommended?: boolean; closeProtectionRecommended?: boolean }>;
    hotelSafety?: Array<{ hotelName: string; level: string; score: number; strengths: string[]; concerns: string[]; recommendedControls: string[]; reviewDataNote: string; confidence: string }>;
    missingTripComponents?: string[];
    recommendedActions?: string[];
    medicalSupportRecommendations?: string[];
    embassySupportRecommendations?: string[];
    operationalSupportRecommendations?: string[];
    planningChecklist?: { intelligenceGaps?: string[]; sourceSummary?: string[] };
  };
  const routeSource = operational.routeRisk?.length ? operational.routeRisk : input.assessment.routeRisks;
  const routeLines = (routeSource ?? []).map((route) => `- ${route.segmentName}: ${route.level} (${route.score}/100). ${route.mitigation}${'recommendedMovementWindow' in route && route.recommendedMovementWindow ? ` Recommended window: ${route.recommendedMovementWindow}.` : ''}`).join('\n') || '- Limited route data available.';
  const hotelLines = (operational.hotelSafety ?? []).map((hotel) => `- ${hotel.hotelName}: ${hotel.level} (${hotel.score}/100). Strengths: ${hotel.strengths.join('; ') || 'Limited verified data available.'} Concerns: ${hotel.concerns.join('; ')} Controls: ${hotel.recommendedControls.join('; ')} Review data: ${hotel.reviewDataNote} Confidence: ${hotel.confidence}.`).join('\n') || '- No sourced hotel candidates available. Add accommodation details or ingest OSM/Nominatim hotel candidates.';
  const fallbackMarkdown = `# Atlas Insight Travel Risk Report\n\n## Executive Summary\n${input.trip.name} is assessed as **${input.assessment.level} (${input.assessment.score}/100)**. Recommendation: **${input.assessment.recommendation}**.\n\n## Trip Overview\nDestination: ${input.trip.locations[0]?.city}, ${input.trip.locations[0]?.country}. Dates: ${input.trip.locations[0]?.arrivalDate} to ${input.trip.locations[0]?.departureDate}. Purpose: ${input.trip.traveller.purpose}.\n\n## Overall Risk Rating\n${input.assessment.level} (${input.assessment.score}/100). Confidence: ${input.assessment.confidence}.\n\n## Itinerary Risk Rating\n${JSON.stringify(input.assessment.itineraryRisks ?? {}, null, 2)}\n\n## Country Risk\nCountry risk is reflected in the overall score and key risk drivers.\n\n## City Risk\nCity-level data is included where available; otherwise the report states limited verified data.\n\n## Route and Transport Risk\n${routeLines}\n\n## Flight / Airport / Border Disruption\nReview flight status, airport advisories and border requirements within 24 hours of departure.\n\n## Missing Trip Data and Planning Assumptions\n${(operational.missingTripComponents ?? input.assessment.missingData).map((item) => `- ${item}`).join('\n') || '- None identified.'}\n\n## Accommodation Safety Assessment\n${input.trip.accommodation || 'Accommodation not supplied.'}\n\n## Hotel Recommendations\n${hotelLines}\n\n## Health and Medical\nReview traveller medical factors, insurance, medication availability and evacuation triggers.\n\n## Medical and Emergency Support\n${(operational.medicalSupportRecommendations ?? []).map((item) => `- ${item}`).join('\n') || '- Confirm local emergency numbers, private medical access, insurer assistance and evacuation triggers.'}\n\n## Embassy/Consular Context\n${(operational.embassySupportRecommendations ?? []).map((item) => `- ${item}`).join('\n') || '- Limited verified consular context available. Add embassy contacts manually.'}\n\n## Emergency Services\nConfirm local emergency numbers, private medical access, insurer assistance and embassy/consulate contacts.\n\n## Local Law and Cultural Notes\nBrief travellers on local law, documentation, photography restrictions and cultural expectations.\n\n## Current Advisories\n${input.advisories.map((item) => `- ${item.severity}: ${item.title} - ${item.summary}`).join('\n') || 'No live advisories connected; demo/public fallback only.'}\n\n## Latest Relevant Events\n${input.events.map((item) => `- ${item.severity}: ${item.title} - ${item.summary}`).join('\n') || 'No matching events available.'}\n\n## Traveller Profile Considerations\nStyle: ${input.trip.traveller.travelStyle}. High profile: ${input.trip.traveller.highProfile ? 'yes' : 'no'}. Medical: ${input.trip.traveller.medicalConsiderations || 'none declared'}.\n\n## Documents Checklist\nUploaded: ${input.documents.map((doc) => doc.type).join(', ') || 'None supplied'}.\n\n## Key Risk Drivers\n${input.assessment.keyDrivers.map((driver) => `- ${driver}`).join('\n') || '- Baseline profile only.'}\n\n## Suggested Movement Controls\n${routeLines}\n\n## Mitigation Advice\n${(operational.recommendedActions ?? []).map((item) => `- ${item}`).join('\n') || '- Use controls aligned to the route risk, traveller profile and advisory position.'}\n\n## Operational Support Recommendation\n${(operational.operationalSupportRecommendations ?? []).map((item) => `- ${item}`).join('\n') || '- Standard precautions and alert monitoring.'}\n\n## Source List\n${sourceList.map((source) => `- ${source}`).join('\n') || '- Demo fallback'}\n\n## Data Freshness\nStatus: ${input.assessment.freshness.status}. ${input.assessment.freshness.notes.join(' ')}\n\n## Intelligence Gaps\n${Array.from(new Set([...(input.assessment.missingData ?? []), ...(operational.planningChecklist?.intelligenceGaps ?? [])])).map((item) => `- ${item}`).join('\n') || '- None identified.'}\n\n## Final Recommendation\n${input.assessment.recommendation}.`;

  if (!status.configured) return { ...fallback('AI unavailable; deterministic Atlas Insight report generated.', sourceList, status.missingConfigurationReason || 'AI provider not configured.'), markdown: fallbackMarkdown, status: 'fallback', groundedSourceCount: sourceList.length };
  try {
    const { text: generated, model } = await callAi(groundedSystem(), `Create the requested Atlas Insight report structure in markdown using only this evidence pack JSON. Separate confirmed source data, analytical assessment and intelligence gaps. Do not invent live facts.\n${JSON.stringify({ trip: input.trip, assessment: input.assessment, advisories: input.advisories, events: input.events, documents: input.documents, sourceList }, null, 2)}`, 'report');
    return { configured: true, provider: status.provider, model, sourceStatus: 'ai_generated', confidence: input.assessment.confidence, text: 'AI-generated source-grounded report.', markdown: generated || fallbackMarkdown, status: 'ai_generated', groundedSourceCount: sourceList.length, sources: sourceList, sourcesUsed: sourceList };
  } catch (error) {
    return { ...fallback('AI report failed; deterministic Atlas Insight report generated.', sourceList, 'AI provider unavailable or returned an error.'), markdown: fallbackMarkdown, status: 'fallback', groundedSourceCount: sourceList.length, error: error instanceof Error ? error.message : 'unknown error' };
  }
}

export async function generateRiskMatrixSuggestions(input: {
  industry: string;
  activity?: string;
  location?: string;
  context?: string;
  knownHazards?: string[];
  existingControls?: string[];
  sourceEvidence?: string[];
  deterministicMatrix?: unknown;
}): Promise<AiResult> {
  const status = aiStatus();
  const sources = input.sourceEvidence ?? [];
  const fallbackText = [
    `Deterministic ${input.industry} risk matrix suggestions prepared.`,
    'AI narrative is unavailable or disabled, so no additional factual claims have been added.',
    sources.length ? 'Use the supplied source evidence when validating likelihood, impact and controls.' : 'No source evidence supplied; treat suggestions as assumptions until verified.'
  ].join(' ');
  if (!status.configured) return fallback(fallbackText, sources, status.missingConfigurationReason || 'AI provider not configured.');
  try {
    const { text, model } = await callAi(
      `${ATLAS_TRAVEL_RISK_SYSTEM_PROMPT}\n\nYou are assisting with a universal risk matrix, not live intelligence collection. Deterministic scoring is performed by code. You may only draft hazard/control narrative from supplied context and source evidence. Separate confirmed information, assumptions and intelligence gaps. Do not invent evidence, incidents, compliance duties, reviews, advisories or live facts.`,
      JSON.stringify({
        task: 'Draft concise source-grounded risk matrix suggestions and narrative only. Do not change deterministic scores.',
        industry: input.industry,
        activity: input.activity,
        location: input.location,
        context: input.context,
        knownHazards: input.knownHazards ?? [],
        existingControls: input.existingControls ?? [],
        sourceEvidence: sources,
        deterministicMatrix: input.deterministicMatrix ?? null
      }, null, 2),
      'matrix'
    );
    return { configured: true, provider: status.provider, model, sourceStatus: 'ai_generated', confidence: sources.length ? 'Medium' : 'Low', text, sources, sourcesUsed: sources };
  } catch (error) {
    return { ...fallback(fallbackText, sources, 'AI matrix model unavailable or returned an error.'), error: error instanceof Error ? error.message : 'unknown error' };
  }
}

export function recommendOperationalSupport(score: number, highProfile: boolean) {
  if (score >= 85) return ['Avoid travel / postpone travel', 'Close protection', 'On-ground medic', 'Medical evacuation planning'];
  if (score >= 70 || highProfile) return ['Secure transport', 'Close protection review', 'Remote medic'];
  if (score >= 50) return ['Vetted driver', 'Secure transport', 'Enhanced awareness'];
  return ['Standard precautions'];
}
