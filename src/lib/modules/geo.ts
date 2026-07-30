import { APIConfig, GEOData, GEOResponse, ScoredMetric } from '@/types';
import { fetchWithTimeout, ragFromScore } from '@/lib/utils';
import { hasKey } from '@/lib/api-config';
import { TokenTracker } from '@/lib/token-tracker';
import * as cheerio from 'cheerio';

// ─── Step 1: Query Generation ───
function generateQueries(companyName: string, industry: string): { query: string; type: 'informational' | 'comparison' | 'best_in_class' }[] {
  const ind = industry || 'technology';
  return [
    // Informational (5)
    { query: `What is ${companyName} and what do they do?`, type: 'informational' },
    { query: `How does ${companyName} work?`, type: 'informational' },
    { query: `Is ${companyName} a good ${ind} solution?`, type: 'informational' },
    { query: `What are the pros and cons of ${companyName}?`, type: 'informational' },
    { query: `${companyName} pricing and features overview`, type: 'informational' },
    // Comparison (3)
    { query: `${companyName} alternatives and competitors`, type: 'comparison' },
    { query: `How does ${companyName} compare to other ${ind} solutions?`, type: 'comparison' },
    { query: `${companyName} vs competitors in ${ind}`, type: 'comparison' },
    // Best in class (2)
    { query: `Best ${ind} tools and platforms in 2025`, type: 'best_in_class' },
    { query: `Top ${ind} companies to consider`, type: 'best_in_class' },
  ];
}

// ─── Step 2: AI Answer Harvesting ───
async function queryAnthropic(query: string, apiKey: string, tracker: TokenTracker): Promise<string> {
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: query }],
    }),
  }, 25000);
  const data = await res.json();
  if (data.usage) {
    tracker.add({ provider: 'Anthropic', model: 'claude-sonnet-4-6', module: 'GEO', inputTokens: data.usage.input_tokens ?? 0, outputTokens: data.usage.output_tokens ?? 0 });
  }
  return data.content?.[0]?.text || '';
}

async function queryOpenAI(query: string, apiKey: string, tracker: TokenTracker): Promise<string> {
  const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 600,
      messages: [{ role: 'user', content: query }],
    }),
  }, 25000);
  const data = await res.json();
  if (data.usage) {
    tracker.add({ provider: 'OpenAI', model: 'gpt-4o', module: 'GEO', inputTokens: data.usage.prompt_tokens ?? 0, outputTokens: data.usage.completion_tokens ?? 0 });
  }
  return data.choices?.[0]?.message?.content || '';
}

async function queryPerplexity(query: string, apiKey: string, tracker: TokenTracker): Promise<string> {
  const res = await fetchWithTimeout('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      max_tokens: 600,
      messages: [{ role: 'user', content: query }],
    }),
  }, 25000);
  const data = await res.json();
  if (data.usage) {
    tracker.add({ provider: 'Perplexity', model: 'sonar-pro', module: 'GEO', inputTokens: data.usage.prompt_tokens ?? 0, outputTokens: data.usage.completion_tokens ?? 0 });
  }
  return data.choices?.[0]?.message?.content || '';
}

// ─── Step 3: Brand Signal Extraction ───
function analyzeResponse(
  response: string,
  query: string,
  engine: string,
  companyName: string,
  domain: string,
  competitors: string[]
): GEOResponse {
  const lower = response.toLowerCase();
  const companyLower = companyName.toLowerCase();
  const domainLower = domain.toLowerCase();

  // Mention detection
  const brandMentioned = lower.includes(companyLower) || lower.includes(domainLower);
  const mentionCount = (lower.split(companyLower).length - 1) + (lower.split(domainLower).length - 1);

  // Citation detection
  const citedAsSource = lower.includes(domainLower) || lower.includes(`${companyLower}.com`);

  // Competitor mentions
  const competitorsMentioned = competitors.filter(c => lower.includes(c.toLowerCase()));

  // Sentiment analysis
  const positiveWords = ['excellent', 'great', 'leading', 'best', 'top', 'innovative', 'recommend', 'popular', 'trusted', 'powerful', 'robust'];
  const negativeWords = ['poor', 'weak', 'expensive', 'limited', 'complaints', 'issues', 'problems', 'difficult', 'behind', 'lacking'];
  const comparisonWords = ['compared to', 'versus', 'vs', 'alternative', 'better than', 'worse than'];

  // Only analyze sentiment near company mention
  const mentionIdx = lower.indexOf(companyLower);
  const context = mentionIdx >= 0 ? lower.slice(Math.max(0, mentionIdx - 200), mentionIdx + 200) : lower;

  const posCount = positiveWords.filter(w => context.includes(w)).length;
  const negCount = negativeWords.filter(w => context.includes(w)).length;
  const hasComparison = comparisonWords.some(w => context.includes(w));

  let sentiment: GEOResponse['sentiment'] = 'neutral';
  if (hasComparison) sentiment = 'comparative';
  else if (posCount > negCount + 1) sentiment = 'positive';
  else if (negCount > posCount + 1) sentiment = 'negative';

  return {
    query,
    engine,
    brandMentioned,
    mentionCount,
    citedAsSource,
    competitorsMentioned,
    sentiment,
    responseSnippet: response.slice(0, 300),
  };
}

// ─── Step 4: Site GEO Readiness Scan ───
async function scanSiteReadiness(domain: string): Promise<{
  hasFAQ: boolean;
  hasHowTo: boolean;
  schemaTypes: string[];
  hasAuthorInfo: boolean;
  contentDepth: number; // 0-10
}> {
  try {
    const res = await fetchWithTimeout(`https://${domain}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DDBot/1.0)' },
    }, 10000);
    const html = await res.text();
    const $ = cheerio.load(html);

    // Schema markup detection
    const schemaTypes: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).text());
        const types = Array.isArray(json) ? json.map(j => j['@type']) : [json['@type']];
        types.filter(Boolean).forEach(t => {
          if (!schemaTypes.includes(t)) schemaTypes.push(t);
        });
      } catch { /* invalid JSON-LD */ }
    });

    const htmlLower = html.toLowerCase();
    const hasFAQ = schemaTypes.includes('FAQPage') || htmlLower.includes('faq') || htmlLower.includes('frequently asked');
    const hasHowTo = schemaTypes.includes('HowTo') || htmlLower.includes('how to') || htmlLower.includes('step-by-step');
    const hasAuthorInfo = htmlLower.includes('author') || htmlLower.includes('written by') || schemaTypes.includes('Person');

    // Content depth heuristic
    let contentDepth = 3;
    if ($('article, [role="article"]').length > 0) contentDepth += 2;
    if ($('h2').length > 3) contentDepth += 1;
    if ($('h3').length > 3) contentDepth += 1;
    if (html.length > 100_000) contentDepth += 1;
    if (schemaTypes.length >= 2) contentDepth += 1;
    if (hasAuthorInfo) contentDepth += 1;

    return {
      hasFAQ,
      hasHowTo,
      schemaTypes,
      hasAuthorInfo,
      contentDepth: Math.min(10, contentDepth),
    };
  } catch {
    return { hasFAQ: false, hasHowTo: false, schemaTypes: [], hasAuthorInfo: false, contentDepth: 0 };
  }
}

// ─── Step 5: Knowledge Graph Check ───
async function checkKnowledgeGraph(companyName: string): Promise<{ found: boolean; description: string }> {
  try {
    const res = await fetchWithTimeout(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(companyName)}&language=en&format=json&limit=5`,
      {}, 10000
    );
    const data = await res.json();
    const entities = data.search || [];
    const match = entities.find((e: { label: string; description?: string }) =>
      e.label.toLowerCase() === companyName.toLowerCase() ||
      e.description?.toLowerCase().includes('company') ||
      e.description?.toLowerCase().includes('software') ||
      e.description?.toLowerCase().includes('platform')
    );
    return {
      found: !!match,
      description: match?.description || '',
    };
  } catch {
    return { found: false, description: '' };
  }
}

// ─── Main: analyzeGEO ───
export async function analyzeGEO(
  domain: string,
  companyName: string,
  industry: string,
  competitors: string[],
  config: APIConfig,
  tracker: TokenTracker = new TokenTracker()
): Promise<GEOData> {
  const queries = generateQueries(companyName, industry);
  const queryResults: GEOResponse[] = [];

  // Determine available engines
  const engines: { name: string; fn: (q: string) => Promise<string> }[] = [];
  if (hasKey(config, 'anthropicKey')) engines.push({ name: 'Claude', fn: (q) => queryAnthropic(q, config.anthropicKey, tracker) });
  if (hasKey(config, 'openaiKey')) engines.push({ name: 'GPT-4o', fn: (q) => queryOpenAI(q, config.openaiKey, tracker) });
  if (hasKey(config, 'perplexityKey')) engines.push({ name: 'Perplexity', fn: (q) => queryPerplexity(q, config.perplexityKey, tracker) });

  if (engines.length === 0) {
    // No LLM keys — return minimal analysis with site scan only
    const siteReadiness = await scanSiteReadiness(domain);
    const kgResult = await checkKnowledgeGraph(companyName);

    return buildGEOData({
      queryResults: [],
      siteReadiness,
      kgResult,
      companyName,
      competitors,
      totalQueries: 0,
    });
  }

  // Run queries against available engines (limit to keep costs reasonable)
  const selectedQueries = queries.slice(0, 6); // 6 queries max
  const engineToUse = engines[0]; // Primary engine for most queries

  // Run primary engine queries in parallel
  const primaryResults = await Promise.allSettled(
    selectedQueries.map(async (q) => {
      try {
        const response = await engineToUse.fn(q.query);
        return analyzeResponse(response, q.query, engineToUse.name, companyName, domain, competitors);
      } catch {
        return null;
      }
    })
  );

  primaryResults.forEach(r => {
    if (r.status === 'fulfilled' && r.value) queryResults.push(r.value);
  });

  // Run secondary engine on a subset for cross-validation
  if (engines.length > 1) {
    const secondaryEngine = engines[1];
    const crossCheckQueries = selectedQueries.slice(0, 3);
    const secondaryResults = await Promise.allSettled(
      crossCheckQueries.map(async (q) => {
        try {
          const response = await secondaryEngine.fn(q.query);
          return analyzeResponse(response, q.query, secondaryEngine.name, companyName, domain, competitors);
        } catch {
          return null;
        }
      })
    );
    secondaryResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value) queryResults.push(r.value);
    });
  }

  // Site readiness and knowledge graph in parallel
  const [siteReadiness, kgResult] = await Promise.all([
    scanSiteReadiness(domain),
    checkKnowledgeGraph(companyName),
  ]);

  return buildGEOData({
    queryResults,
    siteReadiness,
    kgResult,
    companyName,
    competitors,
    totalQueries: queryResults.length,
  });
}

function buildGEOData(params: {
  queryResults: GEOResponse[];
  siteReadiness: Awaited<ReturnType<typeof scanSiteReadiness>>;
  kgResult: Awaited<ReturnType<typeof checkKnowledgeGraph>>;
  companyName: string;
  competitors: string[];
  totalQueries: number;
}): GEOData {
  const { queryResults, siteReadiness, kgResult, companyName, competitors, totalQueries } = params;

  // ─── Step 5: Score Dimensions ───
  // 1. AI Mention Frequency (25%)
  const mentionRate = totalQueries > 0
    ? queryResults.filter(r => r.brandMentioned).length / totalQueries
    : 0;
  const mentionScore = Math.round(mentionRate * 10);

  // 2. Citation Appearance (25%)
  const citationRate = totalQueries > 0
    ? queryResults.filter(r => r.citedAsSource).length / totalQueries
    : 0;
  const citationScore = Math.round(citationRate * 10);

  // 3. Content Structure / E-E-A-T (20%)
  let contentScore = siteReadiness.contentDepth;
  if (siteReadiness.hasFAQ) contentScore = Math.min(10, contentScore + 1);
  if (siteReadiness.hasHowTo) contentScore = Math.min(10, contentScore + 1);
  if (siteReadiness.hasAuthorInfo) contentScore = Math.min(10, contentScore + 1);

  // 4. Knowledge Graph (15%)
  const kgScore = kgResult.found ? 8 : 2;

  // 5. Schema Markup (10%)
  const schemaCount = siteReadiness.schemaTypes.length;
  const schemaScore = Math.min(10, schemaCount * 2);

  // 6. Media/PR Citation (5%) - inferred from mentions + citations
  const mediaScore = Math.min(10, Math.round((mentionRate + citationRate) * 5 + (kgResult.found ? 3 : 0)));

  // Weighted overall (0-100)
  const overallScore = Math.round(
    mentionScore * 2.5 +
    citationScore * 2.5 +
    contentScore * 2.0 +
    kgScore * 1.5 +
    schemaScore * 1.0 +
    mediaScore * 0.5
  );

  // ─── Step 6: Recommendations ───
  const recommendations: string[] = [];
  if (mentionScore < 5) {
    recommendations.push('Increase brand visibility in AI training data by publishing original research, statistics, and industry reports that LLMs are likely to reference.');
  }
  if (citationScore < 5) {
    recommendations.push('Create authoritative, citation-worthy content: case studies with verifiable metrics, industry benchmarks, and expert analysis.');
  }
  if (!siteReadiness.hasFAQ) {
    recommendations.push('Add FAQ schema markup to top landing pages — FAQ content is heavily cited by AI answer engines.');
  }
  if (!siteReadiness.hasHowTo) {
    recommendations.push('Create how-to and step-by-step guides with HowTo schema — high-value content type for AI citation.');
  }
  if (!kgResult.found) {
    recommendations.push('Secure a Wikipedia/Wikidata entity — critical for knowledge graph presence and AI brand recognition.');
  }
  if (schemaScore < 5) {
    recommendations.push(`Expand structured data coverage (currently ${schemaCount} types). Target: Organization, Product, FAQ, HowTo, Article schemas.`);
  }
  if (!siteReadiness.hasAuthorInfo) {
    recommendations.push('Add author bios with credentials (E-E-A-T signals) to blog posts and content pages.');
  }
  if (recommendations.length < 3) {
    recommendations.push('Monitor AI answer inclusion monthly by running representative queries against major LLMs.');
  }

  // Competitor comparison from AI results
  const compMentions: Record<string, number> = {};
  competitors.forEach(c => { compMentions[c] = 0; });
  queryResults.forEach(r => {
    r.competitorsMentioned.forEach(c => {
      compMentions[c] = (compMentions[c] || 0) + 1;
    });
  });

  const competitorComparison = [
    { company: companyName, score: overallScore, mentionRate },
    ...competitors.map(c => ({
      company: c,
      score: Math.round((compMentions[c] || 0) / Math.max(totalQueries, 1) * 100),
      mentionRate: totalQueries > 0 ? (compMentions[c] || 0) / totalQueries : 0,
    })),
  ];

  const metrics: ScoredMetric[] = [
    {
      label: 'GEO Readiness Score',
      value: `${overallScore}/100`,
      score: overallScore,
      status: ragFromScore(overallScore),
      source: 'Multi-engine AI query analysis',
      explanation: 'Composite of 6 weighted dimensions',
    },
    {
      label: 'AI Mention Rate',
      value: `${(mentionRate * 100).toFixed(0)}%`,
      score: mentionScore * 10,
      status: ragFromScore(mentionScore * 10),
      source: `${totalQueries} AI queries across ${new Set(queryResults.map(r => r.engine)).size} engine(s)`,
    },
    {
      label: 'Citation Rate',
      value: `${(citationRate * 100).toFixed(0)}%`,
      score: citationScore * 10,
      status: ragFromScore(citationScore * 10),
      source: 'AI response source analysis',
    },
    {
      label: 'Knowledge Graph',
      value: kgResult.found ? 'Present' : 'Absent',
      score: kgScore * 10,
      status: kgResult.found ? 'green' : 'red',
      source: 'Wikidata API',
      explanation: kgResult.description || undefined,
    },
  ];

  return {
    overallScore,
    dimensions: {
      mentionFrequency: {
        score: mentionScore,
        weight: 0.25,
        detail: `Brand mentioned in ${(mentionRate * 100).toFixed(0)}% of AI responses (${queryResults.filter(r => r.brandMentioned).length}/${totalQueries} queries)`,
      },
      citationAppearance: {
        score: citationScore,
        weight: 0.25,
        detail: `Domain cited as source in ${(citationRate * 100).toFixed(0)}% of AI responses`,
      },
      contentStructure: {
        score: contentScore,
        weight: 0.20,
        detail: `Content depth: ${siteReadiness.contentDepth}/10. FAQ: ${siteReadiness.hasFAQ ? 'Yes' : 'No'}, HowTo: ${siteReadiness.hasHowTo ? 'Yes' : 'No'}, Author E-E-A-T: ${siteReadiness.hasAuthorInfo ? 'Yes' : 'No'}`,
      },
      knowledgeGraph: {
        score: kgScore,
        weight: 0.15,
        detail: kgResult.found ? `Wikidata entity found: ${kgResult.description}` : 'No Wikidata entity found — brand absent from knowledge graph',
      },
      schemaMarkup: {
        score: schemaScore,
        weight: 0.10,
        detail: schemaCount > 0 ? `${schemaCount} schema types: ${siteReadiness.schemaTypes.join(', ')}` : 'No structured data / schema markup detected',
      },
      mediaCitation: {
        score: mediaScore,
        weight: 0.05,
        detail: `Inferred media footprint score based on AI citation patterns and knowledge graph presence`,
      },
    },
    queryResults,
    recommendations,
    competitorComparison,
    metrics,
  };
}
