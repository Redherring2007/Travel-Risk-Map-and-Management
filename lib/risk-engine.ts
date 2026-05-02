import type { Confidence, DataStatus, RiskCategory, RiskLevel, RiskScore } from './types';

export const riskCategories: RiskCategory[] = [
  'security',
  'crime',
  'political',
  'terrorismConflict',
  'kidnapExtortion',
  'health',
  'medical',
  'naturalDisaster',
  'transport',
  'infrastructure',
  'legalCultural',
  'travelDisruption'
];

export const riskCategoryLabels: Record<RiskCategory, string> = {
  security: 'Security',
  crime: 'Crime',
  political: 'Political',
  terrorismConflict: 'Terrorism/conflict',
  kidnapExtortion: 'Kidnap',
  health: 'Health',
  medical: 'Medical',
  naturalDisaster: 'Natural hazards',
  transport: 'Transport',
  infrastructure: 'Infrastructure',
  legalCultural: 'Legal/cultural',
  travelDisruption: 'Travel disruption'
};

export function riskLevel(value: number): RiskLevel {
  if (value >= 75) return 'Critical';
  if (value >= 50) return 'High';
  if (value >= 25) return 'Moderate';
  return 'Low';
}

export function riskMeaning(value: number): string {
  const level = riskLevel(value);
  if (level === 'Critical') return 'Severe risk; travel should be avoided or require specialist support.';
  if (level === 'High') return 'Elevated threat environment; enhanced planning and controls required.';
  if (level === 'Moderate') return 'Manageable risk with preparation, local awareness, and contingency planning.';
  return 'Generally stable operating environment; standard precautions are usually sufficient.';
}

export function score(category: RiskCategory | 'overall', value: number, sources: string[], confidence: Confidence = 'Medium', sourceStatus: DataStatus = 'demo'): RiskScore {
  const bounded = Math.max(0, Math.min(100, Math.round(value)));
  return {
    category,
    value: bounded,
    level: riskLevel(bounded),
    meaning: riskMeaning(bounded),
    confidence,
    lastUpdated: new Date().toISOString(),
    sources,
    sourceStatus
  };
}

export function overallRisk(scores: RiskScore[]): RiskScore {
  const categories = scores.filter((item) => item.category !== 'overall');
  const weighted = categories.reduce((total, item) => total + item.value, 0) / Math.max(categories.length, 1);
  const statuses = new Set(categories.map((item) => item.sourceStatus));
  return score('overall', weighted, Array.from(new Set(categories.flatMap((item) => item.sources))), 'Medium', statuses.has('live') ? 'live' : 'demo');
}

export function recommendationFromScore(value: number): 'Go' | 'Go With Caution' | 'Avoid' {
  if (value >= 75) return 'Avoid';
  if (value >= 45) return 'Go With Caution';
  return 'Go';
}
