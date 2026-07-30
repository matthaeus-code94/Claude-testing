// ─── RAG Status ───
export type RAGStatus = 'green' | 'amber' | 'red';

export interface ScoredMetric {
  label: string;
  value: string | number;
  score: number; // 0-100
  status: RAGStatus;
  source: string;
  explanation?: string;
}

// ─── Module 1: Traffic Intelligence ───
export interface TrafficData {
  estimatedMonthlyVisits: number | null;
  trafficSources: {
    organic: number;
    paid: number;
    direct: number;
    referral: number;
    social: number;
  };
  topCountries: { country: string; share: number }[];
  deviceSplit: { desktop: number; mobile: number };
  bounceRate: number | null;
  avgSessionDuration: number | null;
  pagesPerSession: number | null;
  topReferrers: { domain: string; authority: number }[];
  paidSpendEstimate: number | null;
  topAdKeywords: string[];
  anomalies: string[];
  score: number;
  metrics: ScoredMetric[];
}

// ─── Module 2: SEO Health ───
export interface SEOData {
  domainAuthority: number | null;
  totalIndexedPages: number | null;
  organicKeywordCount: number | null;
  rankingDistribution: {
    top3: number;
    top10: number;
    top30: number;
  } | null;
  topKeywords: { keyword: string; position: number; volume: number }[];
  serpFeatures: {
    featuredSnippets: boolean;
    peopleAlsoAsk: boolean;
    localPacks: boolean;
  };
  coreWebVitals: {
    lcp: { value: number; status: RAGStatus };
    inp: { value: number; status: RAGStatus };
    cls: { value: number; status: RAGStatus };
  } | null;
  mobileFriendly: boolean | null;
  structuredData: string[];
  crawlIssues: string[];
  score: number;
  metrics: ScoredMetric[];
}

// ─── Module 3: GEO Engine ───
export interface GEOQuery {
  query: string;
  type: 'informational' | 'comparison' | 'best_in_class';
}

export interface GEOResponse {
  query: string;
  engine: string;
  brandMentioned: boolean;
  mentionCount: number;
  citedAsSource: boolean;
  competitorsMentioned: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'comparative';
  responseSnippet: string;
}

export interface GEOData {
  overallScore: number;
  dimensions: {
    mentionFrequency: { score: number; weight: number; detail: string };
    citationAppearance: { score: number; weight: number; detail: string };
    contentStructure: { score: number; weight: number; detail: string };
    knowledgeGraph: { score: number; weight: number; detail: string };
    schemaMarkup: { score: number; weight: number; detail: string };
    mediaCitation: { score: number; weight: number; detail: string };
  };
  queryResults: GEOResponse[];
  recommendations: string[];
  competitorComparison: {
    company: string;
    score: number;
    mentionRate: number;
  }[];
  metrics: ScoredMetric[];
}

// ─── Module 4: Tech Stack ───
export interface TechStackData {
  technologies: {
    category: string;
    name: string;
    version?: string;
    confidence: number;
  }[];
  lighthouseScores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  } | null;
  security: {
    https: boolean;
    hsts: boolean;
    csp: boolean;
    xFrameOptions: boolean;
    cookieConsent: boolean | null;
  };
  thirdPartyScripts: { name: string; category: string; riskLevel: RAGStatus }[];
  techDebtSignals: string[];
  score: number;
  metrics: ScoredMetric[];
}

// ─── Module 5: Competitive Benchmarking ───
export interface CompetitorProfile {
  domain: string;
  name: string;
  trafficEstimate: number | null;
  domainAuthority: number | null;
  geoScore: number | null;
  techTier: RAGStatus;
  paidSpendEstimate: number | null;
  shareOfVoice: {
    organic: number;
    paid: number;
    aiPresence: number;
  };
}

export interface CompetitiveData {
  competitors: CompetitorProfile[];
  whitespaceKeywords: string[];
  shareOfVoiceChart: {
    company: string;
    organic: number;
    paid: number;
    ai: number;
  }[];
  score: number;
  metrics: ScoredMetric[];
}

// ─── Module 6: Strategic Scorecard ───
export interface StrategicScorecard {
  executiveSummary: string[];
  digitalHealthScore: number;
  moduleScores: {
    module: string;
    score: number;
    weight: number;
    status: RAGStatus;
  }[];
  strengths: string[];
  risks: string[];
  opportunities: string[];
  benchmarkPercentile: number | null;
  managementQuestions: string[];
  valuationPriorities: { priority: string; impact: RAGStatus; effort: RAGStatus }[];
}

// ─── Analysis Result ───
export interface AnalysisResult {
  domain: string;
  companyName: string;
  analyzedAt: string;
  status: 'running' | 'completed' | 'error';
  progress: {
    traffic: 'pending' | 'running' | 'done' | 'error';
    seo: 'pending' | 'running' | 'done' | 'error';
    geo: 'pending' | 'running' | 'done' | 'error';
    techStack: 'pending' | 'running' | 'done' | 'error';
    competitive: 'pending' | 'running' | 'done' | 'error';
    scorecard: 'pending' | 'running' | 'done' | 'error';
  };
  traffic: TrafficData | null;
  seo: SEOData | null;
  geo: GEOData | null;
  techStack: TechStackData | null;
  competitive: CompetitiveData | null;
  scorecard: StrategicScorecard | null;
  tokenUsage: TokenUsageSummary | null;
}

// ─── Token Usage ───
export interface TokenUsageEntry {
  provider: string;
  model: string;
  module: string;
  inputTokens: number;
  outputTokens: number;
}

export interface TokenUsageSummary {
  entries: TokenUsageEntry[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// ─── API Config ───
export interface APIConfig {
  anthropicKey: string;
  openaiKey: string;
  perplexityKey: string;
  googlePsiKey: string;
  googleSearchKey: string;
  googleSearchCx: string;
  dataForSeoLogin: string;
  dataForSeoPassword: string;
  similarwebKey: string;
}
