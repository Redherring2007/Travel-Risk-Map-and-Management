import { groupedEnvStatus } from './env';
import { providers } from './providers';

export type ProviderHealth = {
  key: string;
  name: string;
  category: string;
  status: 'Live provider active' | 'Missing key' | 'Demo fallback active' | 'Public data active';
  envVars: string[];
  notes: string;
};

export function providerHealth(): ProviderHealth[] {
  return providers.map((provider) => {
    const publicProvider = provider.envVars.length === 0;
    const configured = provider.envVars.length > 0 && provider.envVars.every((key) => Boolean(process.env[key]));
    return {
      key: provider.key,
      name: provider.name,
      category: provider.category,
      status: publicProvider ? 'Public data active' : configured ? 'Live provider active' : 'Demo fallback active',
      envVars: provider.envVars,
      notes: configured || publicProvider ? provider.notes : `${provider.notes} Missing: ${provider.envVars.filter((key) => !process.env[key]).join(', ')}`
    };
  });
}

export function providerStatusReport() {
  const health = providerHealth();
  const env = groupedEnvStatus();
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      live: health.filter((item) => item.status === 'Live provider active').length,
      publicData: health.filter((item) => item.status === 'Public data active').length,
      demoFallback: health.filter((item) => item.status === 'Demo fallback active').length,
      missingEnv: env.missing
    },
    providers: health,
    environment: env.items
  };
}
