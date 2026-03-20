import { APIConfig } from '@/types';

export function getAPIConfig(): APIConfig {
  return {
    anthropicKey: process.env.ANTHROPIC_API_KEY || '',
    openaiKey: process.env.OPENAI_API_KEY || '',
    perplexityKey: process.env.PERPLEXITY_API_KEY || '',
    googlePsiKey: process.env.GOOGLE_PSI_API_KEY || '',
    googleSearchKey: process.env.GOOGLE_SEARCH_API_KEY || '',
    googleSearchCx: process.env.GOOGLE_SEARCH_CX || '',
    dataForSeoLogin: process.env.DATAFORSEO_LOGIN || '',
    dataForSeoPassword: process.env.DATAFORSEO_PASSWORD || '',
    similarwebKey: process.env.SIMILARWEB_API_KEY || '',
  };
}

export function hasKey(config: APIConfig, key: keyof APIConfig): boolean {
  return config[key] !== '';
}
