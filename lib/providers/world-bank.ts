import { fallbackResult, fetchJson, type ProviderItem, type ProviderResult } from './shared';

const indicators = {
  gdpCurrentUsd: 'NY.GDP.MKTP.CD',
  inflationPercent: 'FP.CPI.TOTL.ZG',
  healthExpenditurePercentGdp: 'SH.XPD.CHEX.GD.ZS',
  internetUsersPercent: 'IT.NET.USER.ZS',
  populationTotal: 'SP.POP.TOTL',
  lifeExpectancyYears: 'SP.DYN.LE00.IN',
  airPassengers: 'IS.AIR.PSGR'
};

type WorldBankPoint = { indicator?: { id?: string; value?: string }; countryiso3code?: string; date?: string; value?: number | null };

function latestValue(points: WorldBankPoint[] = []) {
  return points.find((point) => point.value !== null && point.value !== undefined) ?? null;
}

export async function fetchWorldBankCountryIndicators(countryIso2?: string): Promise<ProviderResult> {
  const provider = 'World Bank indicators';
  const providerKey = 'world-bank';
  if (!countryIso2) return fallbackResult(provider, 'https://api.worldbank.org/v2', 'World Bank ingestion requires a countryIso2 scope.', countryIso2, providerKey);
  try {
    const entries = await Promise.all(Object.entries(indicators).map(async ([key, indicator]) => {
      const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(countryIso2)}/indicator/${indicator}?format=json&per_page=8`;
      const data = await fetchJson(url, 86400) as unknown[];
      const point = latestValue(Array.isArray(data?.[1]) ? data[1] as WorldBankPoint[] : []);
      return [key, { indicator, point, url }] as const;
    }));
    const rawPayload = Object.fromEntries(entries);
    const summaryParts = entries.map(([key, value]) => `${key}: ${value.point?.value ?? 'Limited verified data available'} (${value.point?.date ?? 'no date'})`);
    const item: ProviderItem = {
      id: `world-bank-${countryIso2}`,
      provider,
      providerKey,
      title: `${countryIso2} World Bank country indicators`,
      countryIso2,
      category: 'Country development indicators',
      severity: 'Low',
      summary: summaryParts.join('; '),
      recommendedAction: 'Use indicators as country context, not live security intelligence.',
      url: `https://api.worldbank.org/v2/country/${encodeURIComponent(countryIso2)}`,
      publishedAt: new Date().toISOString(),
      sourceStatus: 'live',
      confidence: 'High',
      rawPayload
    };
    return { provider, providerKey, status: 'live', source: 'World Bank public API', url: item.url, fetchedAt: new Date().toISOString(), message: 'World Bank public indicators fetched.', errors: [], requiredForRisk: false, items: [item] };
  } catch (error) {
    return { ...fallbackResult(provider, 'https://api.worldbank.org/v2', `World Bank unavailable: ${error instanceof Error ? error.message : 'unknown error'}`, countryIso2, providerKey), status: 'unavailable', errors: [error instanceof Error ? error.message : 'unknown error'] };
  }
}
